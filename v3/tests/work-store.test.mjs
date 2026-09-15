import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {dirname} from 'node:path';
import {mkdirSync} from 'node:fs';
import {createTask,createWorkPackage,readWorkStore,updateTaskStatus,updateWorkPackageStatus,workStorePath} from '../lib/work-store.mjs';

function fixture(){
  const home=mkdtempSync(`${tmpdir()}/aicc-v3-work-`);
  const context={project:{id:'project-a'},repository:{identity:'example/repo-a'}};
  return {home,env:{AICC_V3_HOME:home},context};
}
function ids(){let n=0;return()=>`00000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;}
function clock(){let n=0;return()=>`2026-09-04T06:00:${String(n++).padStart(2,'0')}.000Z`;}

test('missing store projects as revision 1 empty envelope',()=>{
  const {env,context}=fixture();
  const store=readWorkStore(context,env);
  assert.equal(store.revision,1);
  assert.deepEqual(store.workPackages,[]);
  assert.deepEqual(store.tasks,[]);
});
test('create WP and Task persists durable binding and increments revision',()=>{
  const {env,context}=fixture();const uuid=ids(),now=clock();
  const wp=createWorkPackage(context,{title:'WP One',status:'OPEN'},env,{uuid,now});
  assert.equal(wp.revision,2);
  const task=createTask(context,{workPackageId:wp.workPackage.id,title:'Task One',status:'TODO'},env,{uuid,now});
  assert.equal(task.revision,3);
  const reloaded=readWorkStore(context,env);
  assert.equal(reloaded.revision,3);
  assert.equal(reloaded.workPackages[0].id,wp.workPackage.id);
  assert.equal(reloaded.tasks[0].workPackageId,wp.workPackage.id);
});

test('Task cannot bind to a missing Work Package',()=>{
  const {env,context}=fixture();
  assert.throws(()=>createTask(context,{workPackageId:'missing',title:'Task',status:'TODO'},env),error=>error.code==='TASK_WORK_PACKAGE_NOT_FOUND');
});

test('store project binding mismatch fails closed',()=>{
  const {env,context}=fixture();
  createWorkPackage(context,{title:'WP',status:'OPEN'},env,{uuid:ids(),now:clock()});
  const path=workStorePath(context,env);const store=JSON.parse(readFileSync(path,'utf8'));
  store.project.repositoryIdentity='other/repo';writeFileSync(path,JSON.stringify(store));
  assert.throws(()=>readWorkStore(context,env),error=>error.code==='WORK_STORE_PROJECT_MISMATCH');
});
test('invalid store JSON fails closed',()=>{
  const {env,context}=fixture();const path=workStorePath(context,env);
  mkdirSync(dirname(path),{recursive:true});writeFileSync(path,'{broken');
  assert.throws(()=>readWorkStore(context,env),error=>error.code==='WORK_STORE_INVALID');
});

test('status updates persist, increment once, reject unchanged and terminal mutations',()=>{
  const {env,context}=fixture();const uuid=ids(),now=clock();
  const wp=createWorkPackage(context,{title:'WP',status:'OPEN'},env,{uuid,now}).workPackage;
  const task=createTask(context,{workPackageId:wp.id,title:'Task',status:'TODO'},env,{uuid,now}).task;
  assert.equal(updateWorkPackageStatus(context,wp.id,'ACTIVE',env,{now}).revision,4);
  assert.equal(updateTaskStatus(context,task.id,'IN_PROGRESS',env,{now}).revision,5);
  assert.throws(()=>updateTaskStatus(context,task.id,'IN_PROGRESS',env,{now}),error=>error.code==='WORK_STATUS_UNCHANGED');
  assert.equal(readWorkStore(context,env).revision,5);
  assert.equal(updateTaskStatus(context,task.id,'DONE',env,{now}).revision,6);
  assert.throws(()=>updateTaskStatus(context,task.id,'TODO',env,{now}),error=>error.code==='WORK_STATUS_TERMINAL');
  assert.equal(updateWorkPackageStatus(context,wp.id,'DONE',env,{now}).revision,7);
  assert.throws(()=>updateWorkPackageStatus(context,wp.id,'OPEN',env,{now}),error=>error.code==='WORK_STATUS_TERMINAL');
  assert.equal(readWorkStore(context,env).revision,7);
});

test('invalid explicit status is rejected without mutation',()=>{
  const {env,context}=fixture();
  assert.throws(()=>createWorkPackage(context,{title:'WP',status:'GUESSED'},env),error=>error.code==='WORK_STATUS_INVALID');
  assert.equal(readWorkStore(context,env).revision,1);
});

test('Room-scoped work projection isolates WP/Task while preserving one project ledger',async()=>{
  const {env,context}=fixture();const uuid=ids(),now=clock();
  const {readRoomWorkStore}=await import('../lib/work-store.mjs');
  const a=createWorkPackage(context,{title:'WP A',status:'ACTIVE',roomId:'room-a',workstreamId:'stream-a'},env,{uuid,now}).workPackage;
  const b=createWorkPackage(context,{title:'WP B',status:'ACTIVE',roomId:'room-b',workstreamId:'stream-b'},env,{uuid,now}).workPackage;
  createTask(context,{workPackageId:a.id,title:'Task A',status:'TODO',roomId:'room-a',workstreamId:'stream-a'},env,{uuid,now});
  createTask(context,{workPackageId:b.id,title:'Task B',status:'TODO',roomId:'room-b',workstreamId:'stream-b'},env,{uuid,now});
  const all=readWorkStore(context,env);assert.equal(all.workPackages.length,2);assert.equal(all.tasks.length,2);
  const roomA=readRoomWorkStore(context,'room-a','stream-a',env);assert.deepEqual(roomA.workPackages.map(x=>x.title),['WP A']);assert.deepEqual(roomA.tasks.map(x=>x.title),['Task A']);
  const roomB=readRoomWorkStore(context,'room-b','stream-b',env);assert.deepEqual(roomB.workPackages.map(x=>x.title),['WP B']);assert.deepEqual(roomB.tasks.map(x=>x.title),['Task B']);
});
