import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {chmodSync,mkdtempSync,mkdirSync,readFileSync,realpathSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadProjectContext} from '../lib/project-context.mjs';
import {createTask,createWorkPackage} from '../lib/work-store.mjs';
import {readLease,readRun,readRunEvents} from '../lib/run-store.mjs';
import {readResult} from '../lib/result-store.mjs';
import {cachedDefaultPreflight,preflightCodex,resetExecutorPreflightCache,reconcileExecutor,startRun,stopRun} from '../lib/executor-runtime.mjs';

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fixture(mode='exit'){
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-executor-'));const repo=join(root,'repo');const home=join(root,'state');
  mkdirSync(repo);mkdirSync(home);git(repo,'init','-b','test/executor');git(repo,'config','user.email','aicc@example.invalid');git(repo,'config','user.name','AICC Test');
  writeFileSync(join(repo,'README.md'),'executor\n');git(repo,'add','.');git(repo,'commit','-m','fixture');
  writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',repositoryIdentity:'example/executor',repositoryPath:repo}));
  const fake=join(root,'fake-codex');
  const script=`#!/usr/bin/env node
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{
  console.log(JSON.stringify({type:'thread.started',thread_id:'fake-session',cwd:process.cwd(),argv:process.argv.slice(2),input}));
  console.log(JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'FAKE EXECUTOR RESULT\\n'}}));
  if(process.env.AICC_FAKE_MODE==='wait')setInterval(()=>{},1000);else setTimeout(()=>process.exit(0),60);
});
`;
  writeFileSync(fake,script);chmodSync(fake,0o755);
  const env={AICC_V3_HOME:home,AICC_FAKE_MODE:mode};const context=loadProjectContext(env);
  const wp=createWorkPackage(context,{title:'WP',status:'ACTIVE'},env).workPackage;
  const task=createTask(context,{workPackageId:wp.id,title:'Task',status:'TODO'},env).task;
  const options={preflight:()=>({ready:true,path:fake,version:'fake-1',model:'fake-model',authMode:'test'})};
  return {root,repo,home,env,context,wp,task,fake,options};
}
async function waitFor(context,runId,env,predicate,timeout=15000){
  const end=Date.now()+timeout;
  while(Date.now()<end){const run=readRun(context,runId,env);if(predicate(run))return run;await new Promise(r=>setTimeout(r,40));}
  throw new Error(`timeout waiting for ${runId}`);
}
async function waitForLeaseRelease(context,env,timeout=2000){
  const end=Date.now()+timeout;
  while(Date.now()<end){if(readLease(context,env)===null)return;await new Promise(r=>setTimeout(r,20));}
  assert.equal(readLease(context,env),null);
}
async function waitForResult(context,runId,env,timeout=3000){
  const end=Date.now()+timeout;
  while(Date.now()<end){try{return readResult(context,runId,env);}catch(error){if(error?.code!=='RESULT_NOT_FOUND')throw error;}await new Promise(r=>setTimeout(r,20));}
  return readResult(context,runId,env);
}
test('preflight repairs launchd-minimal PATH locally without global mutation',()=>{
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-preflight-'));const fake=join(root,'codex');
  const script=`#!/usr/bin/env node
if(process.argv[2]==='doctor'){console.log(JSON.stringify({overallStatus:'ok',codexVersion:'fake-2',checks:{installation:{status:'ok'},'auth.credentials':{status:'ok',details:{'stored auth mode':'chatgpt'}},'network.provider_reachability':{status:'ok'},'config.load':{status:'ok',details:{model:'fake-model'}}}}));}else process.exit(2);
`;
  writeFileSync(fake,script);chmodSync(fake,0o755);
  const result=preflightCodex({PATH:'/usr/bin:/bin'},{codexPath:fake});
  assert.equal(result.ready,true);assert.equal(result.version,'fake-2');assert.equal(result.authMode,'chatgpt');
});
test('preflight accepts non-critical doctor warning when required checks are healthy',()=>{
  const report={overallStatus:'warning',codexVersion:'fake-warning',checks:{
    installation:{id:'installation',status:'ok',summary:'installed'},
    'auth.credentials':{id:'auth.credentials',status:'ok',summary:'auth ok',details:{'stored auth mode':'chatgpt'}},
    'network.provider_reachability':{id:'network.provider_reachability',status:'ok',summary:'reachable'},
    'config.load':{id:'config.load',status:'ok',summary:'config ok',details:{model:'gpt-test'}},
    'app_server.status':{id:'app_server.status',status:'warning',summary:'background server is not running'}
  }};
  const result=preflightCodex({}, {codexPath:'/tmp/fake-codex',execFile:()=>JSON.stringify(report)});
  assert.equal(result.ready,true);assert.equal(result.doctorStatus,'warning');
  assert.equal(result.diagnostics.length,1);assert.equal(result.diagnostics[0].id,'app_server.status');
});

test('detached worker binds exact cwd, args, session and append-only events',async()=>{
  const f=fixture('exit');const instruction='Implement only the scoped fixture.\n';
  const created=startRun(f.context,{taskId:f.task.id,instruction},f.env,f.options);
  const run=await waitFor(f.context,created.runId,f.env,r=>r.state==='EXITED');
  assert.equal(run.exitCode,0);assert.equal(run.codexSessionId,'fake-session');
  const result=await waitForResult(f.context,run.runId,f.env);assert.equal(result.content,'FAKE EXECUTOR RESULT\n');assert.equal(result.runId,run.runId);
  assert.equal(run.repositoryPath,f.repo);assert.equal(readFileSync(run.instructionPath,'utf8'),instruction);
  await waitForLeaseRelease(f.context,f.env);
  const events=readRunEvents(f.context,run.runId,0,f.env);
  assert.deepEqual(events.map(e=>e.seq),events.map((_,i)=>i+1));
  assert.ok(events.some(e=>e.type==='RUN_CREATED'));
  assert.ok(events.some(e=>e.type==='WORKER_STARTED'));
  assert.ok(events.some(e=>e.type==='CODEX_SESSION_IDENTIFIED'));
  assert.ok(events.some(e=>e.type==='PROCESS_EXITED'));
  const stdout=events.find(e=>e.type==='CODEX_STDOUT'&&e.payload.raw.includes('thread.started'));
  const raw=JSON.parse(stdout.payload.raw);
  assert.equal(realpathSync(raw.cwd),realpathSync(f.repo));assert.equal(raw.input,instruction);
  assert.ok(raw.argv.includes('--json'));assert.ok(raw.argv.includes('--strict-config'));
  assert.ok(raw.argv.includes('workspace-write'));assert.ok(raw.argv.includes('multi_agent'));
  assert.equal(raw.argv.includes('--dangerously-bypass-approvals-and-sandbox'),false);
});
test('one lease rejects second start and exact stop reaches only owned worker',async()=>{
  const f=fixture('wait');const first=startRun(f.context,{taskId:f.task.id,instruction:'wait\n'},f.env,f.options);
  await waitFor(f.context,first.runId,f.env,r=>r.state==='RUNNING');
  assert.throws(()=>startRun(f.context,{taskId:f.task.id,instruction:'second\n'},f.env,f.options),e=>e.code==='EXECUTOR_LEASE_ACTIVE');
  assert.throws(()=>stopRun(f.context,'missing-run',f.env,f.options),e=>e.code==='RUN_NOT_FOUND');
  const stopped=stopRun(f.context,first.runId,f.env,f.options);assert.equal(stopped.stopRequested,true);
  const final=await waitFor(f.context,first.runId,f.env,r=>r.state==='STOPPED');
  assert.equal(final.state,'STOPPED');await waitForLeaseRelease(f.context,f.env);
  const types=readRunEvents(f.context,first.runId,0,f.env).map(e=>e.type);
  assert.ok(types.includes('STOP_REQUESTED'));assert.ok(types.includes('PROCESS_STOPPED'));
});

test('same project identity cannot discover a Run from a different worktree runtime bucket',()=>{
  const f=fixture('exit');
  const options={...f.options,spawnWorker:()=>31337,processProbe:()=>true,uuid:()=> '00000000-0000-4000-8000-000000000002'};
  const run=startRun(f.context,{taskId:f.task.id,instruction:'binding fixture\n'},f.env,options);
  const other=join(f.root,'other-worktree');mkdirSync(other);
  const foreign={project:{id:f.context.project.id},repository:{identity:f.context.repository.identity,path:other}};
  assert.throws(()=>readRun(foreign,run.runId,f.env),e=>e.code==='RUN_NOT_FOUND');
});

test('restart reconciliation marks unprovable active run ORPHANED and releases lease',()=>{
  const f=fixture('exit');
  const options={...f.options,spawnWorker:()=>424242,processProbe:()=>true,uuid:()=> '00000000-0000-4000-8000-000000000001'};
  const run=startRun(f.context,{taskId:f.task.id,instruction:'orphan fixture\n'},f.env,options);
  assert.ok(readLease(f.context,f.env));
  reconcileExecutor(f.context,f.env,{...options,processProbe:()=>false});
  assert.equal(readRun(f.context,run.runId,f.env).state,'ORPHANED');
  assert.equal(readLease(f.context,f.env),null);
  assert.equal(readRunEvents(f.context,run.runId,0,f.env).at(-1).type,'RUN_ORPHANED');
});


test('default executor readiness cache avoids repeated doctor calls',()=>{
  const root=mkdtempSync(join(tmpdir(),'aicc-executor-preflight-cache-'));
  const fake=join(root,'fake-codex-doctor');const count=join(root,'count.txt');
  writeFileSync(fake,`#!/bin/sh
COUNT_FILE="$AICC_TEST_COUNT_FILE"
N=0
[ -f "$COUNT_FILE" ] && N=$(cat "$COUNT_FILE")
echo $((N+1)) > "$COUNT_FILE"
cat <<'JSON'
{"codexVersion":"fake-cache","overallStatus":"ok","checks":{"installation":{"id":"installation","status":"ok"},"auth.credentials":{"id":"auth.credentials","status":"ok","details":{"stored auth mode":"test"}},"network.provider_reachability":{"id":"network.provider_reachability","status":"ok"}}}
JSON
`);
  chmodSync(fake,0o755);
  const env={...process.env,AICC_CODEX_PATH:fake,AICC_TEST_COUNT_FILE:count};
  resetExecutorPreflightCache();
  const first=cachedDefaultPreflight(env);const second=cachedDefaultPreflight(env);
  assert.equal(first.version,'fake-cache');assert.equal(second.version,'fake-cache');
  assert.equal(readFileSync(count,'utf8').trim(),'1');
  resetExecutorPreflightCache();
});
