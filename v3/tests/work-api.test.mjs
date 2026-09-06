import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAiccV3Server} from '../server.mjs';

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-work-api-'));const repo=join(root,'repo'),home=join(root,'state');
  mkdirSync(repo);mkdirSync(home);git(repo,'init','-b','test/work-api');
  git(repo,'config','user.email','aicc-v3@example.invalid');git(repo,'config','user.name','AICC V3 Test');
  writeFileSync(join(repo,'README.md'),'work api\n');git(repo,'add','README.md');git(repo,'commit','-m','fixture');
  writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',repositoryIdentity:'example/work-api',repositoryPath:repo}));
  let id=0,tick=0;
  return {env:{AICC_V3_HOME:home},workStoreOptions:{uuid:()=>`00000000-0000-4000-8000-${String(++id).padStart(12,'0')}`,now:()=>`2026-09-04T07:00:${String(tick++).padStart(2,'0')}.000Z`}};
}

async function request(base,path,method='GET',body){
  const response=await fetch(`${base}${path}`,{method,headers:body?{'content-type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  return {response,body:await response.json()};
}
test('five minimal work APIs persist explicit WP and Task facts',async()=>{
  const fixtureData=fixture();const server=createAiccV3Server(fixtureData);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const initial=await request(base,'/api/work');
    assert.equal(initial.response.status,200);assert.equal(initial.body.store.revision,1);
    const wp=await request(base,'/api/work-packages','POST',{title:'WP API',status:'OPEN'});
    assert.equal(wp.response.status,201);assert.equal(wp.body.workPackage.status,'OPEN');assert.equal(wp.body.revision,2);
    const task=await request(base,'/api/tasks','POST',{workPackageId:wp.body.workPackage.id,title:'Task API',status:'TODO'});
    assert.equal(task.response.status,201);assert.equal(task.body.task.workPackageId,wp.body.workPackage.id);assert.equal(task.body.revision,3);
    const wpPatch=await request(base,`/api/work-packages/${wp.body.workPackage.id}/status`,'PATCH',{status:'ACTIVE'});
    assert.equal(wpPatch.response.status,200);assert.equal(wpPatch.body.workPackage.status,'ACTIVE');assert.equal(wpPatch.body.revision,4);
    const taskPatch=await request(base,`/api/tasks/${task.body.task.id}/status`,'PATCH',{status:'IN_PROGRESS'});
    assert.equal(taskPatch.response.status,200);assert.equal(taskPatch.body.task.status,'IN_PROGRESS');assert.equal(taskPatch.body.revision,5);
    const final=await request(base,'/api/work');
    assert.equal(final.body.store.revision,5);assert.equal(final.body.store.workPackages[0].status,'ACTIVE');assert.equal(final.body.store.tasks[0].status,'IN_PROGRESS');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
test('work APIs fail closed on invalid binding and lifecycle commands',async()=>{
  const fixtureData=fixture();const server=createAiccV3Server(fixtureData);
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}`;
  try{
    const detached=await request(base,'/api/tasks','POST',{workPackageId:'missing',title:'Detached',status:'TODO'});
    assert.equal(detached.response.status,404);assert.equal(detached.body.errorCode,'TASK_WORK_PACKAGE_NOT_FOUND');
    const invalid=await request(base,'/api/work-packages','POST',{title:'WP',status:'AUTO'});
    assert.equal(invalid.response.status,400);assert.equal(invalid.body.errorCode,'WORK_STATUS_INVALID');
    const wp=await request(base,'/api/work-packages','POST',{title:'WP',status:'OPEN'});
    const unchanged=await request(base,`/api/work-packages/${wp.body.workPackage.id}/status`,'PATCH',{status:'OPEN'});
    assert.equal(unchanged.response.status,409);assert.equal(unchanged.body.errorCode,'WORK_STATUS_UNCHANGED');
    const done=await request(base,`/api/work-packages/${wp.body.workPackage.id}/status`,'PATCH',{status:'DONE'});
    assert.equal(done.response.status,200);
    const terminal=await request(base,`/api/work-packages/${wp.body.workPackage.id}/status`,'PATCH',{status:'ACTIVE'});
    assert.equal(terminal.response.status,409);assert.equal(terminal.body.errorCode,'WORK_STATUS_TERMINAL');
  }finally{await new Promise(resolve=>server.close(resolve));}
});
