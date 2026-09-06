import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadProjectContext} from '../lib/project-context.mjs';
import {createTask,createWorkPackage} from '../lib/work-store.mjs';
import {createAiccV3Server} from '../server.mjs';

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-executor-api-'));const repo=join(root,'repo');const home=join(root,'state');
  mkdirSync(repo);mkdirSync(home);git(repo,'init','-b','test/api');git(repo,'config','user.email','aicc@example.invalid');git(repo,'config','user.name','AICC Test');
  writeFileSync(join(repo,'README.md'),'api\n');git(repo,'add','.');git(repo,'commit','-m','fixture');
  writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',repositoryIdentity:'example/api',repositoryPath:repo}));
  const env={AICC_V3_HOME:home};const context=loadProjectContext(env);
  const wp=createWorkPackage(context,{title:'WP',status:'ACTIVE'},env).workPackage;
  const task=createTask(context,{workPackageId:wp.id,title:'Task',status:'TODO'},env).task;
  return {env,context,task};
}
async function withServer(f,run){
  const signalled=[];
  const executorOptions={
    preflight:()=>({ready:true,path:'/fake/codex',version:'fake',model:'fake',authMode:'test'}),
    spawnWorker:()=>77777,processProbe:()=>true,signalWorker:(pid,runId)=>signalled.push({pid,runId})
  };
  const server=createAiccV3Server({env:f.env,executorOptions});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{await run(base,signalled);}finally{await new Promise(resolve=>server.close(resolve));}
}
async function jsonFetch(url,options){const response=await fetch(url,options);return {response,body:await response.json()};}

test('five frozen executor APIs expose durable transport facts only',async()=>{
  const f=fixture();
  await withServer(f,async(base,signalled)=>{
    const created=await jsonFetch(`${base}/api/runs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({taskId:f.task.id,instruction:'API fixture\n'})});
    assert.equal(created.response.status,201);const runId=created.body.run.runId;
    const status=await jsonFetch(`${base}/api/executor`);assert.equal(status.response.status,200);assert.equal(status.body.executor.activeLease.runId,runId);
    const run=await jsonFetch(`${base}/api/runs/${runId}`);assert.equal(run.body.run.state,'CREATED');assert.equal(run.body.run.taskId,f.task.id);
    const events=await jsonFetch(`${base}/api/runs/${runId}/events?after=0`);assert.deepEqual(events.body.events.map(e=>e.type),['RUN_CREATED']);
    const second=await jsonFetch(`${base}/api/runs`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({taskId:f.task.id,instruction:'second'})});
    assert.equal(second.response.status,409);assert.equal(second.body.errorCode,'EXECUTOR_LEASE_ACTIVE');
    const stop=await jsonFetch(`${base}/api/runs/${runId}/stop`,{method:'POST'});assert.equal(stop.response.status,200);assert.equal(stop.body.stopRequested,true);
    assert.deepEqual(signalled,[{pid:77777,runId}]);
  });
});
