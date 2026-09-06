import {spawn} from 'node:child_process';
import {createInterface} from 'node:readline';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {stateRoot} from './lib/project-context.mjs';
import {projectStateKey} from './lib/work-store.mjs';
import {appendRunEvent,readLease,readRun,readStopRequest,releaseLease,updateRun} from './lib/run-store.mjs';
import {materializeResult} from './lib/result-store.mjs';

function arg(name){const prefix=`--${name}=`;return process.argv.find(v=>v.startsWith(prefix))?.slice(prefix.length)||null;}
const runId=arg('run-id');const projectKey=arg('project-key');
if(!runId||!projectKey)process.exit(64);
const runPath=join(stateRoot(process.env),'projects',projectKey,'runs',runId,'run.v1.json');
let initial;
try{initial=JSON.parse(readFileSync(runPath,'utf8'));}catch{process.exit(65);}
const context={project:{id:initial.projectId},repository:{identity:initial.repositoryIdentity,path:initial.repositoryPath}};
if(projectStateKey(context)!==projectKey||initial.runId!==runId)process.exit(66);
const instruction=readFileSync(join(stateRoot(process.env),'projects',projectKey,'runs',runId,'instruction.txt'),'utf8');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function awaitLease(){
  for(let i=0;i<80;i++){
    try{const lease=readLease(context,process.env);if(lease?.runId===runId&&lease.workerPid===process.pid)return lease;}catch{}
    await sleep(25);
  }
  throw Object.assign(new Error('EXECUTOR_LEASE_MISMATCH'),{code:'EXECUTOR_LEASE_MISMATCH'});
}
function event(type,source,payload={}){return appendRunEvent(context,runId,type,source,payload,process.env);}
function patch(value){return updateRun(context,runId,value,process.env);}
function release(){try{releaseLease(context,runId,process.env);}catch{}}
function sessionIdFromRaw(raw){
  try{
    const value=JSON.parse(raw);
    if(value?.type==='thread.started'&&typeof value.thread_id==='string')return value.thread_id;
    if(value?.type==='session.started'&&typeof value.session_id==='string')return value.session_id;
  }catch{}
  return null;
}
async function main(){
  await awaitLease();
  patch({state:'STARTING',workerPid:process.pid});
  event('WORKER_STARTED','EXECUTOR_WORKER',{workerPid:process.pid});
  const run=readRun(context,runId,process.env);
  const args=['exec','--json','--strict-config','-C',run.repositoryPath,'-s','workspace-write','--disable','multi_agent','-'];
  const child=spawn(run.executorPath,args,{cwd:run.repositoryPath,env:process.env,detached:true,stdio:['pipe','pipe','pipe']});
  let stopRequested=false;let settled=false;
  child.once('spawn',()=>{patch({state:'RUNNING',codexPid:child.pid});child.stdin.end(instruction);});
  const onLine=(source,type)=>(raw)=>{
    event(type,source,{raw});
    if(source==='CODEX'){
      const id=sessionIdFromRaw(raw);const current=readRun(context,runId,process.env);
      if(id&&!current.codexSessionId){patch({codexSessionId:id});event('CODEX_SESSION_IDENTIFIED','EXECUTOR_WORKER',{codexSessionId:id});}
    }
  };
  createInterface({input:child.stdout,crlfDelay:Infinity}).on('line',onLine('CODEX','CODEX_STDOUT'));
  createInterface({input:child.stderr,crlfDelay:Infinity}).on('line',onLine('CODEX','CODEX_STDERR'));
  const requestStop=()=>{
    if(stopRequested||settled)return;
    try{readStopRequest(context,runId,process.env);}catch{return;}
    stopRequested=true;event('STOP_REQUESTED','EXECUTOR_WORKER',{});patch({state:'STOPPING'});
    try{process.kill(-child.pid,'SIGTERM');}catch{try{child.kill('SIGTERM');}catch{}}
  };
  process.on('SIGTERM',requestStop);
  child.once('error',error=>{
    if(settled)return;settled=true;
    event('SPAWN_ERROR','EXECUTOR_WORKER',{message:String(error?.message||error)});
    patch({state:'SPAWN_ERROR'});release();process.exitCode=1;
  });
  child.once('close',(code,signal)=>{
    if(settled)return;settled=true;
    if(stopRequested){
      event('PROCESS_STOPPED','EXECUTOR_WORKER',{exitCode:code,signal:signal||null});
      patch({state:'STOPPED',exitCode:code});
    }else{
      event('PROCESS_EXITED','EXECUTOR_WORKER',{exitCode:code,signal:signal||null});
      patch({state:'EXITED',exitCode:code});
      try{materializeResult(context,runId,process.env);}catch{}
    }
    release();
  });
}
main().catch(error=>{
  try{event('SPAWN_ERROR','EXECUTOR_WORKER',{errorCode:error?.code||'SPAWN_ERROR'});patch({state:'SPAWN_ERROR'});}catch{}
  release();process.exitCode=1;
});
