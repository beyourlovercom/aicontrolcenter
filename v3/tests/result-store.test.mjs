import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadProjectContext} from '../lib/project-context.mjs';
import {appendRunEvent,createRunFiles} from '../lib/run-store.mjs';
import {materializeResult,readResult,resultFile} from '../lib/result-store.mjs';
function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function sha(value){return createHash('sha256').update(value,'utf8').digest('hex');}
function fixture({state='EXITED',messages=['first','  final\nmessage  ']}={}){
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-result-'));const repo=join(root,'repo');const home=join(root,'state');
  mkdirSync(repo);mkdirSync(home);git(repo,'init','-b','test/result');git(repo,'config','user.email','aicc@example.invalid');git(repo,'config','user.name','AICC Test');
  writeFileSync(join(repo,'README.md'),'result\n');git(repo,'add','.');git(repo,'commit','-m','fixture');
  writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',repositoryIdentity:'example/result',repositoryPath:repo}));
  const env={AICC_V3_HOME:home};const context=loadProjectContext(env);const runId='run-result-fixture';
  const run={schema:'aicc.v3.run.v1',runId,taskId:'task-1',workPackageId:'wp-1',projectId:context.project.id,repositoryIdentity:context.repository.identity,repositoryPath:context.repository.path,branchAtStart:context.repository.branch,headAtStart:context.repository.head,dirtyAtStart:context.repository.dirty,instructionSha256:'x',instructionPath:'instruction.txt',executorPath:'/fake/codex',executorVersion:'fake',executorModel:'fake',executorAuthMode:'test',codexSessionId:'session-1',workerPid:1,codexPid:2,exitCode:7,state,createdAt:'2026-09-04T00:00:00.000Z',updatedAt:'2026-09-04T00:00:01.000Z'};
  createRunFiles(context,run,'instruction\n',env);
  if(state==='EXITED'){
    appendRunEvent(context,runId,'CODEX_STDOUT','CODEX',{raw:'not-json'},env);
    for(const text of messages)appendRunEvent(context,runId,'CODEX_STDOUT','CODEX',{raw:JSON.stringify({type:'item.completed',item:{type:'agent_message',text}})},env);
    appendRunEvent(context,runId,'PROCESS_EXITED','EXECUTOR_WORKER',{exitCode:7,signal:null},env);
  }
  return {root,repo,home,env,context,runId,messages};
}
test('canonical Result preserves exact final agent message and evidence hashes',()=>{
  const f=fixture();const result=materializeResult(f.context,f.runId,f.env,{now:()=> '2026-09-04T00:01:00.000Z'});
  assert.equal(result.resultId,`result:${f.runId}`);assert.equal(result.content,f.messages.at(-1));assert.equal(result.contentSha256,sha(f.messages.at(-1)));
  const raw=JSON.stringify({type:'item.completed',item:{type:'agent_message',text:f.messages.at(-1)}});
  assert.equal(result.sourceRawSha256,sha(raw));assert.equal(result.sourceEventSeq,3);assert.equal(result.exitCode,7);
  assert.equal('status' in result,false);assert.equal('pass' in result,false);assert.equal('fail' in result,false);
});
test('materialization is create-once and idempotent',()=>{
  const f=fixture();const first=materializeResult(f.context,f.runId,f.env,{now:()=> '2026-09-04T00:01:00.000Z'});const before=readFileSync(resultFile(f.context,f.runId,f.env),'utf8');
  const second=materializeResult(f.context,f.runId,f.env,{now:()=> '2030-01-01T00:00:00.000Z'});const after=readFileSync(resultFile(f.context,f.runId,f.env),'utf8');
  assert.deepEqual(second,first);assert.equal(after,before);assert.equal(second.createdAt,'2026-09-04T00:01:00.000Z');
});
test('non-EXITED Run and missing executor final message fail closed',()=>{
  const active=fixture({state:'RUNNING'});assert.throws(()=>materializeResult(active.context,active.runId,active.env),e=>e.code==='RESULT_NOT_READY');
  const missing=fixture({messages:[]});assert.throws(()=>materializeResult(missing.context,missing.runId,missing.env),e=>e.code==='RESULT_SOURCE_NOT_FOUND');
});
test('Result validates worktree identity and immutable content evidence',()=>{
  const f=fixture();materializeResult(f.context,f.runId,f.env);
  const other=join(f.root,'other-worktree');mkdirSync(other);const foreign={project:{id:f.context.project.id},repository:{identity:f.context.repository.identity,path:other}};
  assert.throws(()=>readResult(foreign,f.runId,f.env),e=>e.code==='RESULT_PROJECT_MISMATCH');
  const path=resultFile(f.context,f.runId,f.env);const corrupted=JSON.parse(readFileSync(path,'utf8'));corrupted.content='rewritten';writeFileSync(path,JSON.stringify(corrupted));
  assert.throws(()=>readResult(f.context,f.runId,f.env),e=>e.code==='RESULT_INVALID');
});
