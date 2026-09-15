import {createHash,randomUUID} from 'node:crypto';
import {execFileSync,spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {dirname,join} from 'node:path';
import {stateRoot} from './project-context.mjs';
import {projectStateKey,readWorkStore} from './work-store.mjs';
import {appendRunEvent,createRunFiles,instructionFile,latestRun,readLease,readRun,readRunEvents,releaseLease,reserveLease,setLeaseWorkerPid,TERMINAL_RUN_STATES,updateRun,writeStopRequest} from './run-store.mjs';

const here=dirname(fileURLToPath(import.meta.url));
const workerFile=join(here,'..','executor-worker.mjs');

function fail(code,detail=''){
  const error=new Error(detail?`${code}: ${detail}`:code);error.code=code;throw error;
}
function exactInstruction(value){
  if(typeof value!=='string'||!value.trim()||Buffer.byteLength(value,'utf8')>60000)fail('RUN_INSTRUCTION_INVALID');
  return value;
}
function executorEnvironment(env,codexPath){
  const inherited={...process.env,...env};
  const parts=[dirname(process.execPath),dirname(codexPath),...(inherited.PATH||'').split(':')].filter(Boolean);
  inherited.PATH=[...new Set(parts)].join(':');
  return inherited;
}
function safeExec(path,args,options={}){
  try{return execFileSync(path,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],...options}).trim();}
  catch(error){return null;}
}
export function resolveCodexPath(env=process.env){
  const configured=env.AICC_CODEX_PATH?.trim();
  if(configured&&existsSync(configured))return configured;
  if(existsSync('/opt/homebrew/bin/codex'))return '/opt/homebrew/bin/codex';
  const located=safeExec('/usr/bin/which',['codex'],{env});
  if(located&&existsSync(located))return located;
  fail('EXECUTOR_NOT_READY');
}
export function preflightCodex(env=process.env,options={}){
  const codexPath=options.codexPath||resolveCodexPath(env);
  const commandEnv=executorEnvironment(env,codexPath);
  const raw=(options.execFile||safeExec)(codexPath,['doctor','--json'],{env:commandEnv});
  if(!raw)fail('EXECUTOR_PREFLIGHT_FAILED');
  let report;try{report=JSON.parse(raw);}catch{fail('EXECUTOR_PREFLIGHT_FAILED');}
  const checks=report.checks||{};
  const required=['installation','auth.credentials','network.provider_reachability'];
  const ready=required.every(id=>checks[id]?.status==='ok');
  if(!ready)fail('EXECUTOR_PREFLIGHT_FAILED');
  const diagnostics=Object.values(checks)
    .filter(check=>check&&check.status&&check.status!=='ok')
    .map(check=>({id:check.id||'unknown',status:check.status,summary:check.summary||null}));
  return {
    ready:true,checkedAt:new Date().toISOString(),path:codexPath,
    version:report.codexVersion||null,
    model:checks['config.load']?.details?.model||null,
    authMode:checks['auth.credentials']?.details?.['stored auth mode']||null,
    doctorStatus:report.overallStatus||null,diagnostics
  };
}
function defaultProcessProbe(pid,runId){
  if(!Number.isInteger(pid)||pid<=0)return false;
  const command=safeExec('/bin/ps',['-p',String(pid),'-o','command=']);
  return Boolean(command&&command.includes('executor-worker.mjs')&&command.includes(`--run-id=${runId}`));
}
function markOrphaned(context,run,env,options={}){
  if(!TERMINAL_RUN_STATES.includes(run.state)){
    appendRunEvent(context,run.runId,'RUN_ORPHANED','AICC',{previousState:run.state},env,options);
    updateRun(context,run.runId,{state:'ORPHANED'},env,options);
  }
  releaseLease(context,run.runId,env);
  return readRun(context,run.runId,env);
}
export function reconcileExecutor(context,env=process.env,options={}){
  const lease=readLease(context,env);
  if(!lease){
    const latest=latestRun(context,env);
    if(latest&&!TERMINAL_RUN_STATES.includes(latest.state))markOrphaned(context,latest,env,options);
    return null;
  }
  let run;
  try{run=readRun(context,lease.runId,env);}catch(error){
    if(error?.code==='RUN_NOT_FOUND'){releaseLease(context,lease.runId,env);return null;}throw error;
  }
  if(TERMINAL_RUN_STATES.includes(run.state)){releaseLease(context,run.runId,env);return null;}
  const probe=options.processProbe||defaultProcessProbe;
  if(lease.workerPid&&probe(lease.workerPid,run.runId))return lease;
  markOrphaned(context,run,env,options);return null;
}
function defaultSpawnWorker(context,run,env){
  const child=spawn(process.execPath,[workerFile,`--run-id=${run.runId}`,`--project-key=${projectStateKey(context)}`],{
    detached:true,stdio:'ignore',cwd:run.repositoryPath,
    env:{...executorEnvironment(env,run.executorPath),AICC_V3_HOME:stateRoot(env)}
  });
  child.unref();
  if(!child.pid)fail('EXECUTOR_NOT_READY');
  return child.pid;
}
const DEFAULT_PREFLIGHT_CACHE_TTL_MS=60_000;
let defaultPreflightCache=null;
function defaultPreflightCacheKey(env){return `${env.AICC_CODEX_PATH||''}|${env.HOME||''}`;}
export function cachedDefaultPreflight(env,options={}){
  if(options.execFile||options.codexPath)return preflightCodex(env,options);
  const key=defaultPreflightCacheKey(env);const stamp=Date.now();
  if(defaultPreflightCache&&defaultPreflightCache.key===key&&stamp-defaultPreflightCache.cachedAt<DEFAULT_PREFLIGHT_CACHE_TTL_MS){
    if(defaultPreflightCache.errorCode)fail(defaultPreflightCache.errorCode);
    return defaultPreflightCache.value;
  }
  try{
    const value=preflightCodex(env,options);defaultPreflightCache={key,cachedAt:stamp,value,errorCode:null};return value;
  }catch(error){
    const errorCode=error?.code||'EXECUTOR_NOT_READY';defaultPreflightCache={key,cachedAt:stamp,value:null,errorCode};fail(errorCode);
  }
}
export function resetExecutorPreflightCache(){defaultPreflightCache=null;}
function executorPreflight(env,options){
  return options.preflight?options.preflight():cachedDefaultPreflight(env,options);
}
export function startRun(context,input,env=process.env,options={}){
  if(reconcileExecutor(context,env,options))fail('EXECUTOR_LEASE_ACTIVE');
  const instruction=exactInstruction(input?.instruction);
  const store=readWorkStore(context,env);
  const task=store.tasks.find(item=>item.id===input?.taskId);
  if(!task)fail('RUN_TASK_NOT_FOUND');
  const wp=store.workPackages.find(item=>item.id===task.workPackageId);
  if(!wp)fail('RUN_TASK_NOT_FOUND');
  const executor=executorPreflight(env,options);
  const now=options.now||(()=>new Date().toISOString());
  const runId=(options.uuid||randomUUID)();const stamp=now();
  const instructionPath=instructionFile(context,runId,env);
  const run={
    schema:'aicc.v3.run.v1',runId,taskId:task.id,workPackageId:wp.id,
    projectId:context.project.id,repositoryIdentity:context.repository.identity,
    repositoryPath:context.repository.path,branchAtStart:context.repository.branch,
    headAtStart:context.repository.head,dirtyAtStart:context.repository.dirty,
    instructionSha256:createHash('sha256').update(instruction).digest('hex'),
    instructionPath,executorPath:executor.path,executorVersion:executor.version||null,
    executorModel:executor.model||null,executorAuthMode:executor.authMode||null,
    codexSessionId:null,workerPid:null,codexPid:null,exitCode:null,
    state:'CREATED',createdAt:stamp,updatedAt:stamp
  };
  reserveLease(context,runId,env,{now});
  try{
    createRunFiles(context,run,instruction,env);
    appendRunEvent(context,runId,'RUN_CREATED','AICC',{taskId:task.id,workPackageId:wp.id},env,{now});
    const workerPid=(options.spawnWorker||defaultSpawnWorker)(context,run,env);
    setLeaseWorkerPid(context,runId,workerPid,env);
    return readRun(context,runId,env);
  }catch(error){
    try{
      if(existsSync(instructionPath)){
        appendRunEvent(context,runId,'SPAWN_ERROR','AICC',{errorCode:error?.code||'SPAWN_ERROR'},env,{now});
        updateRun(context,runId,{state:'SPAWN_ERROR'},env,{now});
      }
      releaseLease(context,runId,env);
    }catch{}
    if(!error.code)error.code='EXECUTOR_NOT_READY';
    throw error;
  }
}
export function executorStatus(context,env=process.env,options={}){
  const lease=reconcileExecutor(context,env,options);
  let readiness;
  try{readiness=executorPreflight(env,options);}catch(error){readiness={ready:false,errorCode:error?.code||'EXECUTOR_NOT_READY'};}
  return {schema:'aicc.v3.executor-status.v1',readiness,activeLease:lease,latestRun:latestRun(context,env)};
}
export function runProjection(context,runId,env=process.env,options={}){
  const run=readRun(context,runId,env);
  if(!TERMINAL_RUN_STATES.includes(run.state))reconcileExecutor(context,env,options);
  return readRun(context,runId,env);
}
export function runEvents(context,runId,after=0,env=process.env){
  return readRunEvents(context,runId,after,env);
}
function defaultSignalWorker(pid){process.kill(pid,'SIGTERM');}
export function stopRun(context,runId,env=process.env,options={}){
  const run=readRun(context,runId,env);
  if(TERMINAL_RUN_STATES.includes(run.state))fail('RUN_ALREADY_TERMINAL');
  const lease=reconcileExecutor(context,env,options);
  if(!lease||lease.runId!==runId)fail('RUN_STOP_TARGET_MISMATCH');
  writeStopRequest(context,runId,env,{now:options.now});
  try{(options.signalWorker||defaultSignalWorker)(lease.workerPid,runId);}catch{fail('RUN_STOP_TARGET_MISMATCH');}
  return {run:readRun(context,runId,env),stopRequested:true};
}
