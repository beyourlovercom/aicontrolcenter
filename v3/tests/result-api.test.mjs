import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadProjectContext} from '../lib/project-context.mjs';
import {appendRunEvent,createRunFiles} from '../lib/run-store.mjs';
import {createAiccV3Server} from '../server.mjs';
function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-result-api-'));const repo=join(root,'repo');const home=join(root,'state');mkdirSync(repo);mkdirSync(home);
  git(repo,'init','-b','test/result-api');git(repo,'config','user.email','aicc@example.invalid');git(repo,'config','user.name','AICC Test');writeFileSync(join(repo,'README.md'),'api\n');git(repo,'add','.');git(repo,'commit','-m','fixture');
  writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',repositoryIdentity:'example/result-api',repositoryPath:repo}));
  const env={AICC_V3_HOME:home};const context=loadProjectContext(env);const runId='api-result-run';
  const run={schema:'aicc.v3.run.v1',runId,taskId:'task-api',workPackageId:'wp-api',projectId:context.project.id,repositoryIdentity:context.repository.identity,repositoryPath:context.repository.path,branchAtStart:context.repository.branch,headAtStart:context.repository.head,dirtyAtStart:false,codexSessionId:'session-api',exitCode:0,state:'EXITED',createdAt:'2026-09-04T00:00:00.000Z',updatedAt:'2026-09-04T00:00:01.000Z'};
  createRunFiles(context,run,'instruction\n',env);appendRunEvent(context,runId,'CODEX_STDOUT','CODEX',{raw:JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'API RESULT\n'}})},env);appendRunEvent(context,runId,'PROCESS_EXITED','EXECUTOR_WORKER',{exitCode:0,signal:null},env);
  return {env,runId};
}
async function jsonFetch(url,options){const response=await fetch(url,options);return {response,body:await response.json()};}
test('GET exact Run Result reconciles once and remains reload-safe',async()=>{
  const f=fixture();const server=createAiccV3Server({env:f.env,executorOptions:{preflight:()=>({ready:true,path:'/fake/codex'})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const first=await jsonFetch(`${base}/api/runs/${f.runId}/result`);assert.equal(first.response.status,200);assert.equal(first.body.result.content,'API RESULT\n');
    const second=await jsonFetch(`${base}/api/runs/${f.runId}/result`);assert.deepEqual(second.body.result,first.body.result);
    const write=await jsonFetch(`${base}/api/runs/${f.runId}/result`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'});assert.equal(write.response.status,404);
  }finally{await new Promise(r=>server.close(r));}
});
