import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {runtimeStorageKey,type RuntimeState} from './runtimeManager.ts';

const script=join(process.cwd(),'scripts','aicc-run-supervisor.ts');
const nodeArgs=['--experimental-strip-types','--experimental-specifier-resolution=node'];
const stateDir=mkdtempSync(join(tmpdir(),'aicc-supervisor-scope-'));
const runId='shared-supervisor-run';
const scopeA={projectId:'project-a',repositoryIdentity:'repo/a'};
const scopeB={projectId:'project-b',repositoryIdentity:'repo/b'};

function state(scope:typeof scopeA):RuntimeState{
  const now=new Date().toISOString();
  return {runId,...scope,workPackageId:null,entityType:'global_task',entityId:'GLOBAL_TASK',authorizationId:'test',authoritySha:'test',branch:'main',startingHeadSha:'head',pid:null,threadId:null,phase:'STARTING',currentTask:'',latestEvent:'launch',startedAt:now,lastActivityAt:now,events:[],executionType:'READ_ONLY_AUDIT',sandboxMode:'read-only',authorizedHead:'head',passThrough:true} as RuntimeState;
}

async function run(scope:typeof scopeA){
  const s=state(scope),specPath=join(stateDir,`spec-${scope.projectId}.json`);
  const code=`process.stdout.write(JSON.stringify({type:'thread.started',thread_id:'thread-${scope.projectId}'})+'\\n');setTimeout(()=>process.exit(0),20)`;
  writeFileSync(specPath,JSON.stringify({state:s,stateDir,repositoryRoot:process.cwd(),lockFile:join(stateDir,`lock-${scope.projectId}`),prompt:'test',command:process.execPath,args:['-e',code]}));
  const child=spawn(process.execPath,[...nodeArgs,script,specPath],{stdio:'ignore'});
  await new Promise<void>((resolve,reject)=>{child.on('exit',()=>resolve());child.on('error',reject)});
  return join(stateDir,`runtime-run-scoped-${runtimeStorageKey(s)}.json`);
}
const fileA=await run(scopeA);
const fileB=await run(scopeB);
assert.notEqual(fileA,fileB,'same raw runId has distinct supervisor storage files per Project');
const storedA=JSON.parse(readFileSync(fileA,'utf8')) as RuntimeState;
const storedB=JSON.parse(readFileSync(fileB,'utf8')) as RuntimeState;
assert.equal(storedA.projectId,scopeA.projectId);
assert.equal(storedB.projectId,scopeB.projectId);
assert.equal(storedA.runId,runId);
assert.equal(storedB.runId,runId);
const history=JSON.parse(readFileSync(join(stateDir,'runtime-history.json'),'utf8')) as RuntimeState[];
const colliding=history.filter(item=>item.runId===runId);
assert.equal(colliding.length,2,'terminal history retains both project-scoped identities for same raw runId');
assert.deepEqual(new Set(colliding.map(item=>`${item.projectId}\x00${item.repositoryIdentity}`)),new Set([`${scopeA.projectId}\x00${scopeA.repositoryIdentity}`,`${scopeB.projectId}\x00${scopeB.repositoryIdentity}`]));
console.log('supervisor runtime storage project scope regression passed');
