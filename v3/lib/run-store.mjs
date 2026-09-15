import {randomUUID} from 'node:crypto';
import {appendFileSync,existsSync,mkdirSync,readFileSync,readdirSync,renameSync,rmSync,statSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {stateRoot} from './project-context.mjs';
import {projectBinding} from './work-store.mjs';
import {runtimeStateKey} from './runtime-state.mjs';

export const RUN_SCHEMA='aicc.v3.run.v1';
export const LEASE_SCHEMA='aicc.v3.executor-lease.v1';
export const RUN_EVENT_SCHEMA='aicc.v3.run-event.v1';
export const STOP_REQUEST_SCHEMA='aicc.v3.stop-request.v1';
export const RUN_STATES=Object.freeze(['CREATED','STARTING','RUNNING','STOPPING','EXITED','STOPPED','ORPHANED','SPAWN_ERROR']);
export const TERMINAL_RUN_STATES=Object.freeze(['EXITED','STOPPED','ORPHANED','SPAWN_ERROR']);

function fail(code,detail=''){
  const error=new Error(detail?`${code}: ${detail}`:code);
  error.code=code;
  throw error;
}
function atomicJson(path,value){
  mkdirSync(dirname(path),{recursive:true});
  const temp=`${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temp,`${JSON.stringify(value,null,2)}\n`,{encoding:'utf8',flag:'wx'});
  renameSync(temp,path);
}
export function executorRoot(context,env=process.env){
  return join(stateRoot(env),'runtimes',runtimeStateKey(context),'executor');
}
export function runsRoot(context,env=process.env){
  return join(stateRoot(env),'runtimes',runtimeStateKey(context),'runs');
}
export function runDir(context,runId,env=process.env){return join(runsRoot(context,env),runId);}
export function runFile(context,runId,env=process.env){return join(runDir(context,runId,env),'run.v1.json');}
export function eventsFile(context,runId,env=process.env){return join(runDir(context,runId,env),'events.jsonl');}
export function instructionFile(context,runId,env=process.env){return join(runDir(context,runId,env),'instruction.txt');}
export function stopRequestFile(context,runId,env=process.env){return join(runDir(context,runId,env),'stop-request.v1.json');}
export function leaseFile(context,env=process.env){return join(executorRoot(context,env),'lease.v1.json');}

function sameRepositoryPath(a,b){
  if(typeof a!=='string'||typeof b!=='string')return false;
  try{const left=statSync(a),right=statSync(b);return left.dev===right.dev&&left.ino===right.ino;}catch{return a===b;}
}
function bindingMatches(value,context){
  const project=projectBinding(context);
  return value?.projectId===project.id&&value?.repositoryIdentity===project.repositoryIdentity&&sameRepositoryPath(value?.repositoryPath,context?.repository?.path);
}
function validateRun(run,context){
  if(!run||run.schema!==RUN_SCHEMA||typeof run.runId!=='string'||!RUN_STATES.includes(run.state))fail('RUN_NOT_FOUND');
  if(!bindingMatches(run,context))fail('RUN_PROJECT_MISMATCH');
  return run;
}
export function readRun(context,runId,env=process.env){
  const path=runFile(context,runId,env);
  if(!existsSync(path))fail('RUN_NOT_FOUND');
  let run;
  try{run=JSON.parse(readFileSync(path,'utf8'));}catch{fail('RUN_NOT_FOUND');}
  return validateRun(run,context);
}
export function writeRun(context,run,env=process.env){
  validateRun(run,context);
  atomicJson(runFile(context,run.runId,env),run);
  return run;
}
export function updateRun(context,runId,patch,env=process.env,options={}){
  const run=readRun(context,runId,env);
  const next={...run,...patch,updatedAt:(options.now||(()=>new Date().toISOString()))()};
  if(!RUN_STATES.includes(next.state))fail('RUN_EVENT_STREAM_INVALID');
  writeRun(context,next,env);
  return next;
}
export function createRunFiles(context,run,instruction,env=process.env){
  const dir=runDir(context,run.runId,env);
  mkdirSync(runsRoot(context,env),{recursive:true});
  mkdirSync(dir,{recursive:false});
  writeFileSync(instructionFile(context,run.runId,env),instruction,{encoding:'utf8',flag:'wx'});
  writeRun(context,run,env);
  writeFileSync(eventsFile(context,run.runId,env),'',{encoding:'utf8',flag:'wx'});
}
function parseEvents(path,runId){
  if(!existsSync(path))fail('RUN_EVENT_STREAM_INVALID');
  const text=readFileSync(path,'utf8');
  if(!text)return [];
  const lines=text.split('\n').filter(Boolean);const events=[];
  for(let i=0;i<lines.length;i++){
    let event;try{event=JSON.parse(lines[i]);}catch{fail('RUN_EVENT_STREAM_INVALID');}
    if(event?.schema!==RUN_EVENT_SCHEMA||event.runId!==runId||event.seq!==i+1)fail('RUN_EVENT_STREAM_INVALID');
    events.push(event);
  }
  return events;
}
export function readRunEvents(context,runId,after=0,env=process.env){
  readRun(context,runId,env);
  if(!Number.isInteger(after)||after<0)fail('RUN_EVENT_STREAM_INVALID');
  return parseEvents(eventsFile(context,runId,env),runId).filter(event=>event.seq>after);
}
export function appendRunEvent(context,runId,type,source,payload={},env=process.env,options={}){
  readRun(context,runId,env);
  const path=eventsFile(context,runId,env);
  const seq=parseEvents(path,runId).length+1;
  const event={schema:RUN_EVENT_SCHEMA,seq,at:(options.now||(()=>new Date().toISOString()))(),runId,type,source,payload};
  appendFileSync(path,`${JSON.stringify(event)}\n`,{encoding:'utf8'});
  return event;
}
export function readLease(context,env=process.env){
  const path=leaseFile(context,env);
  if(!existsSync(path))return null;
  let lease;try{lease=JSON.parse(readFileSync(path,'utf8'));}catch{fail('EXECUTOR_LEASE_MISMATCH');}
  if(lease?.schema!==LEASE_SCHEMA||typeof lease.runId!=='string'||!bindingMatches(lease,context))fail('EXECUTOR_LEASE_MISMATCH');
  return lease;
}
export function reserveLease(context,runId,env=process.env,options={}){
  const path=leaseFile(context,env);mkdirSync(dirname(path),{recursive:true});
  const project=projectBinding(context);
  const lease={schema:LEASE_SCHEMA,runId,projectId:project.id,repositoryIdentity:project.repositoryIdentity,repositoryPath:context.repository.path,workerPid:null,createdAt:(options.now||(()=>new Date().toISOString()))()};
  try{writeFileSync(path,`${JSON.stringify(lease,null,2)}\n`,{encoding:'utf8',flag:'wx'});}catch(error){
    if(error?.code==='EEXIST')fail('EXECUTOR_LEASE_ACTIVE');throw error;
  }
  return lease;
}
export function setLeaseWorkerPid(context,runId,workerPid,env=process.env){
  const lease=readLease(context,env);
  if(!lease||lease.runId!==runId)fail('EXECUTOR_LEASE_MISMATCH');
  const next={...lease,workerPid};atomicJson(leaseFile(context,env),next);return next;
}
export function releaseLease(context,runId,env=process.env){
  const lease=readLease(context,env);
  if(!lease)return false;
  if(lease.runId!==runId)fail('EXECUTOR_LEASE_MISMATCH');
  rmSync(leaseFile(context,env));return true;
}
export function writeStopRequest(context,runId,env=process.env,options={}){
  const run=readRun(context,runId,env);
  if(TERMINAL_RUN_STATES.includes(run.state))fail('RUN_ALREADY_TERMINAL');
  const value={schema:STOP_REQUEST_SCHEMA,runId,requestedAt:(options.now||(()=>new Date().toISOString()))()};
  atomicJson(stopRequestFile(context,runId,env),value);return value;
}
export function readStopRequest(context,runId,env=process.env){
  const path=stopRequestFile(context,runId,env);if(!existsSync(path))return null;
  let value;try{value=JSON.parse(readFileSync(path,'utf8'));}catch{fail('RUN_STOP_TARGET_MISMATCH');}
  if(value?.schema!==STOP_REQUEST_SCHEMA||value.runId!==runId)fail('RUN_STOP_TARGET_MISMATCH');
  return value;
}
export function latestRun(context,env=process.env){
  const root=runsRoot(context,env);if(!existsSync(root))return null;
  let latest=null;
  for(const name of readdirSync(root)){
    try{
      const run=readRun(context,name,env);
      if(!latest||String(run.createdAt)>String(latest.createdAt))latest=run;
    }catch(error){if(error?.code==='RUN_PROJECT_MISMATCH')throw error;}
  }
  return latest;
}
