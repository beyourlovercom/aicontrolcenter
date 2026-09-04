import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {stateRoot} from './project-context.mjs';

export const WORK_STORE_SCHEMA='aicc.v3.work-store.v1';
export const WORK_PACKAGE_STATUSES=Object.freeze(['OPEN','ACTIVE','BLOCKED','DONE']);
export const TASK_STATUSES=Object.freeze(['TODO','IN_PROGRESS','BLOCKED','DONE','CANCELLED']);

function fail(code,detail=''){
  const error=new Error(detail?`${code}: ${detail}`:code);
  error.code=code;
  throw error;
}

function projectIdentity(context){
  const id=context?.project?.id;
  const repositoryIdentity=context?.repository?.identity;
  if(!id||!repositoryIdentity)fail('WORK_PROJECT_CONTEXT_INVALID');
  return {id,repositoryIdentity};
}

export function workStorePath(context,env=process.env){
  const project=projectIdentity(context);
  const key=createHash('sha256').update(project.id).update('\0').update(project.repositoryIdentity).digest('hex');
  return join(stateRoot(env),'projects',key,'work-store.v1.json');
}
function emptyStore(context){
  const project=projectIdentity(context);
  return {schema:WORK_STORE_SCHEMA,revision:1,project,workPackages:[],tasks:[]};
}

function validTimestamp(value){return typeof value==='string'&&!Number.isNaN(Date.parse(value));}
function validTitle(value){return typeof value==='string'&&value.trim().length>0;}

function validateEntityArrays(store){
  if(!Array.isArray(store.workPackages)||!Array.isArray(store.tasks))fail('WORK_STORE_INVALID');
  const wpIds=new Set();
  for(const wp of store.workPackages){
    if(!wp||typeof wp.id!=='string'||!validTitle(wp.title)||!WORK_PACKAGE_STATUSES.includes(wp.status)||!validTimestamp(wp.createdAt)||!validTimestamp(wp.updatedAt))fail('WORK_STORE_INVALID');
    if(wpIds.has(wp.id))fail('WORK_STORE_INVALID');
    wpIds.add(wp.id);
  }
  const taskIds=new Set();
  for(const task of store.tasks){
    if(!task||typeof task.id!=='string'||typeof task.workPackageId!=='string'||!validTitle(task.title)||!TASK_STATUSES.includes(task.status)||!validTimestamp(task.createdAt)||!validTimestamp(task.updatedAt))fail('WORK_STORE_INVALID');
    if(taskIds.has(task.id)||!wpIds.has(task.workPackageId))fail('WORK_STORE_INVALID');
    taskIds.add(task.id);
  }
}
function validateStore(store,context){
  const project=projectIdentity(context);
  if(!store||store.schema!==WORK_STORE_SCHEMA||!Number.isInteger(store.revision)||store.revision<1)fail('WORK_STORE_INVALID');
  if(store.project?.id!==project.id||store.project?.repositoryIdentity!==project.repositoryIdentity)fail('WORK_STORE_PROJECT_MISMATCH');
  validateEntityArrays(store);
  return store;
}

export function readWorkStore(context,env=process.env){
  const path=workStorePath(context,env);
  if(!existsSync(path))return emptyStore(context);
  let store;
  try{store=JSON.parse(readFileSync(path,'utf8'));}catch{fail('WORK_STORE_INVALID');}
  return validateStore(store,context);
}

function writeStore(context,store,env){
  const path=workStorePath(context,env);
  mkdirSync(dirname(path),{recursive:true});
  const temp=`${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temp,`${JSON.stringify(store,null,2)}\n`,{encoding:'utf8',flag:'wx'});
  renameSync(temp,path);
}

function deps(options={}){
  return {now:options.now||(()=>new Date().toISOString()),uuid:options.uuid||randomUUID};
}
function requireTitle(value){if(!validTitle(value))fail('WORK_INPUT_INVALID','title');return value.trim();}
function requireStatus(value,allowed){if(!allowed.includes(value))fail('WORK_STATUS_INVALID');return value;}

export function createWorkPackage(context,input,env=process.env,options={}){
  const store=readWorkStore(context,env);
  const {now,uuid}=deps(options);
  const stamp=now();
  const workPackage={id:uuid(),title:requireTitle(input?.title),status:requireStatus(input?.status,WORK_PACKAGE_STATUSES),createdAt:stamp,updatedAt:stamp};
  const next={...store,revision:store.revision+1,workPackages:[...store.workPackages,workPackage]};
  validateStore(next,context);writeStore(context,next,env);
  return {workPackage,revision:next.revision};
}

export function createTask(context,input,env=process.env,options={}){
  const store=readWorkStore(context,env);
  const workPackageId=input?.workPackageId;
  if(typeof workPackageId!=='string'||!store.workPackages.some(item=>item.id===workPackageId))fail('TASK_WORK_PACKAGE_NOT_FOUND');
  const {now,uuid}=deps(options);const stamp=now();
  const task={id:uuid(),workPackageId,title:requireTitle(input?.title),status:requireStatus(input?.status,TASK_STATUSES),createdAt:stamp,updatedAt:stamp};
  const next={...store,revision:store.revision+1,tasks:[...store.tasks,task]};
  validateStore(next,context);writeStore(context,next,env);
  return {task,revision:next.revision};
}
function updateStatus(context,kind,id,status,env,options){
  const store=readWorkStore(context,env);
  const allowed=kind==='workPackage'?WORK_PACKAGE_STATUSES:TASK_STATUSES;
  requireStatus(status,allowed);
  const listName=kind==='workPackage'?'workPackages':'tasks';
  const notFound=kind==='workPackage'?'WORK_PACKAGE_NOT_FOUND':'TASK_NOT_FOUND';
  const terminal=kind==='workPackage'?['DONE']:['DONE','CANCELLED'];
  const index=store[listName].findIndex(item=>item.id===id);
  if(index<0)fail(notFound);
  const current=store[listName][index];
  if(current.status===status)fail('WORK_STATUS_UNCHANGED');
  if(terminal.includes(current.status))fail('WORK_STATUS_TERMINAL');
  const {now}=deps(options);const updated={...current,status,updatedAt:now()};
  const list=[...store[listName]];list[index]=updated;
  const next={...store,revision:store.revision+1,[listName]:list};
  validateStore(next,context);writeStore(context,next,env);
  return {[kind]:updated,revision:next.revision};
}

export function updateWorkPackageStatus(context,id,status,env=process.env,options={}){
  return updateStatus(context,'workPackage',id,status,env,options);
}

export function updateTaskStatus(context,id,status,env=process.env,options={}){
  return updateStatus(context,'task',id,status,env,options);
}
