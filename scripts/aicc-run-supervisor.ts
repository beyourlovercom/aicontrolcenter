import {execFileSync} from 'node:child_process';
import * as pty from 'node-pty';
import {mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, unlinkSync, writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {tmpdir} from 'node:os';
import {finalizeCanonicalResult, parseEvent, reconcileProcessExit, runtimeStorageKey, type RuntimeState} from '../src/lib/runtimeManager.ts';
import {buildOwnerGitDeliveryEnvironment, resolveGitHubCredential, redactSecret, stripGitHubCredentialEnvironment} from '../src/lib/gitCredentialBridge.ts';

type SupervisorSpec={state:RuntimeState;stateDir:string;repositoryRoot:string;lockFile:string;prompt:string;command?:string;args?:string[]};
const specFile=process.argv[2];
if(!specFile)throw new Error('SUPERVISOR_SPEC_REQUIRED');
const spec=JSON.parse(readFileSync(specFile,'utf8')) as SupervisorSpec;
const runFile=spec.state.passThrough?join(spec.stateDir,`runtime-run-scoped-${runtimeStorageKey(spec.state)}.json`):join(spec.stateDir,'runtime.json');
const historyFile=join(spec.stateDir,'runtime-history.json');
const maxHistory=20;
const maxTerminalChunks=200;
const maxTerminalBytes=64_000;

let ephemeralGithubToken:string|undefined;
let ephemeralGithubConfigDir:string|undefined;
let ptyLifecycleKeepalive:ReturnType<typeof setInterval>|undefined;
function releasePtyLifecycleKeepalive(){if(!ptyLifecycleKeepalive)return;clearInterval(ptyLifecycleKeepalive);ptyLifecycleKeepalive=undefined}
function scrubState(state:RuntimeState){
  if(!ephemeralGithubToken)return;
  for(const key of Object.keys(state) as (keyof RuntimeState)[]){
    const value=state[key];
    if(typeof value==='string')state[key]=redactSecret(value,ephemeralGithubToken) as RuntimeState[typeof key];
    else if(Array.isArray(value))state[key]=value.map(item=>typeof item==='string'?redactSecret(item,ephemeralGithubToken):item) as RuntimeState[typeof key];
  }
}
function persist(state:RuntimeState){
  scrubState(state);
  mkdirSync(spec.stateDir,{recursive:true});
  const runTemp=`${runFile}.${process.pid}.tmp`;
  writeFileSync(runTemp,JSON.stringify(state,null,2),{mode:0o600});
  renameSync(runTemp,runFile);
  if(!['COMPLETED','FAILED','STOPPED','RECOVERY_REQUIRED'].includes(state.phase))return;
  let history:RuntimeState[]=[];
  try{history=JSON.parse(readFileSync(historyFile,'utf8')) as RuntimeState[]}catch{}
  const historyTemp=`${historyFile}.${process.pid}.tmp`;
  writeFileSync(historyTemp,JSON.stringify([state,...history.filter(item=>!(item.runId===state.runId&&item.projectId===state.projectId&&item.repositoryIdentity===state.repositoryIdentity))].slice(0,maxHistory),null,2),{mode:0o600});
  renameSync(historyTemp,historyFile);
}
function releaseLock(){try{unlinkSync(spec.lockFile)}catch{}}
function isCancelledBeforeSpawn(runId:string){try{const current=JSON.parse(readFileSync(runFile,'utf8')) as RuntimeState;return current.runId===runId&&(current.stopRequested===true||current.phase==='STOPPED')}catch{return false}}
function syncOwnerStopRequest(state:RuntimeState){
  try{
    const current=JSON.parse(readFileSync(runFile,'utf8')) as RuntimeState;
    if(current.runId===state.runId&&current.stopRequested===true)state.stopRequested=true;
  }catch{}
}
function finishCancelledBeforeSpawn(state:RuntimeState){state.phase='STOPPED';state.stopRequested=true;state.pidAlive=false;state.processAlive=false;state.completedAt=new Date().toISOString();state.currentTask='CANCELLED_BEFORE_SPAWN';state.failure=state.failure??'OWNER_CANCELLED_BEFORE_SPAWN';state.startupTransitions=[...(state.startupTransitions??[]),'CANCELLED_BEFORE_SPAWN'];state.writerLockReleased=true;state.lockEvents=[...(state.lockEvents??[]),'writer_lock.released'];persist(state);releaseLock();cleanupEphemeralGitHubCredential();releasePtyLifecycleKeepalive()}
function cleanupEphemeralGitHubCredential(){
  if(!ephemeralGithubConfigDir)return;
  rmSync(ephemeralGithubConfigDir,{recursive:true,force:true});
  ephemeralGithubConfigDir=undefined;
}
function completeRuntimeFinalization(state:RuntimeState,code:number|null,signal:string|null){
  syncOwnerStopRequest(state);
  state.processCloseObserved=true;
  state.processSignal=signal;
  state.exitCode=code;
  state.pidAlive=false;
  state.processAlive=false;
  state.completedAt=new Date().toISOString();
  state.processClosedAt=state.completedAt;
  state.terminalClosedAt=state.completedAt;
  state.cleanupAt=state.completedAt;
  state.writerLockReleased=true;
  state.lockEvents=[...(state.lockEvents??[]),'writer_lock.released'];
  state.lastActivityAt=state.completedAt;
  try{state.postRunHead=execFileSync('git',['rev-parse','HEAD'],{cwd:spec.repositoryRoot,encoding:'utf8'}).trim()}catch{state.postRunHead='UNAVAILABLE'}
  try{const changed=execFileSync('git',['status','--porcelain'],{cwd:spec.repositoryRoot,encoding:'utf8'}).trim();state.changedFiles=changed?changed.split('\n'):[]}catch{state.changedFiles=['STATUS_UNAVAILABLE']}
  state.codeChangePresent=state.postRunHead!==state.authorizedHead||(state.changedFiles?.length??0)>0;
  state.implementationResult=['IMPLEMENTATION','REMEDIATION'].includes(state.executionType??'')?(state.codeChangePresent?'CODE_CHANGE_PRESENT':'NO_IMPLEMENTATION_CHANGE'):'READ_ONLY';
  if(state.outputMode==='human'&&!state.stopRequested){
    try{
      if(!state.finalMessagePath)throw new Error('FINAL_MESSAGE_PATH_UNAVAILABLE');
      state.finalAgentMessage=readFileSync(state.finalMessagePath,'utf8');
      state.lastAgentMessage=state.finalAgentMessage;
      state.finalMessageReadAt=new Date().toISOString();
    }catch(error){
      state.finalMessageReadFailure=error instanceof Error?error.code==='ENOENT'?'FINAL_MESSAGE_UNAVAILABLE':`FINAL_MESSAGE_READ_FAILED:${error.code??error.message}`:'FINAL_MESSAGE_READ_FAILED';
    }
  }
  reconcileProcessExit(state,code,signal);
  finalizeCanonicalResult(state,state.completedAt);
  persist(state);releaseLock();cleanupEphemeralGitHubCredential();
}
const state=spec.state;
if(isCancelledBeforeSpawn(state.runId)){finishCancelledBeforeSpawn(state);process.exit(0)}
state.supervisorPid=process.pid;
state.startupTransitions=[...(state.startupTransitions??[]),'SUPERVISOR_STARTED'];
state.latestEvent='supervisor.started';
state.lastActivityAt=new Date().toISOString();
persist(state);
let child:pty.IPty;
try{
  const deliveryProfile=state.executionProfile==='OWNER_AUTHORIZED_GIT_DELIVERY';
  const childEnvironment=deliveryProfile ? (() => {
    ephemeralGithubToken=resolveGitHubCredential(process.env);
    const environment=buildOwnerGitDeliveryEnvironment(process.env,ephemeralGithubToken);
    ephemeralGithubConfigDir=mkdtempSync(join(tmpdir(),'aicc-gh-config-'));
    environment.GH_CONFIG_DIR=ephemeralGithubConfigDir;
    environment.GIT_CONFIG_COUNT='2';
    environment.GIT_CONFIG_KEY_0='url.https://github.com/.insteadOf';
    environment.GIT_CONFIG_VALUE_0='git@github.com:';
    environment.GIT_CONFIG_KEY_1='url.https://github.com/.insteadOf';
    environment.GIT_CONFIG_VALUE_1='ssh://git@github.com/';
    environment.HOME=environment.HOME??process.env.USERPROFILE??'/Users/a';
    environment.PATH=[environment.PATH,'/Users/a/.local/bin','/opt/homebrew/bin','/usr/bin','/bin'].filter(Boolean).join(':');
    return environment;
  })() : stripGitHubCredentialEnvironment(process.env);
  const childArgs=spec.args??(state.outputMode==='human'
    ? ['exec','--sandbox',state.sandboxMode??'workspace-write','--output-last-message',state.finalMessagePath??join(spec.stateDir,state.runId,'final-message.txt'),'-',...(state.resolvedModel?['--model',state.resolvedModel]:[]),...(state.reasoningLevel?['-c',`model_reasoning_effort="${state.reasoningLevel}"`]:[])]
    : ['exec','--sandbox',state.sandboxMode??'workspace-write','--json','-',...(state.resolvedModel?['--model',state.resolvedModel]:[]),...(state.reasoningLevel?['-c',`model_reasoning_effort="${state.reasoningLevel}"`]:[])]);
  const deliveryArgs=deliveryProfile ? ['-c','sandbox_workspace_write.network_access=true',...childArgs] : childArgs;
  const ptyArgs=deliveryArgs.map(argument=>argument==='-'?spec.prompt:argument);
  if(state.outputMode==='human'&&state.finalMessagePath)mkdirSync(dirname(state.finalMessagePath),{recursive:true});
  if(isCancelledBeforeSpawn(state.runId)){finishCancelledBeforeSpawn(state);process.exit(0)}
  const command=spec.command??'codex';
  let resolvedExecutable=command;
  try{resolvedExecutable=execFileSync('which',[command],{cwd:spec.repositoryRoot,env:childEnvironment,encoding:'utf8'}).trim()||command}catch{}
  state.spawnRequestedAt=state.spawnRequestedAt??new Date().toISOString();state.spawnExecutable=resolvedExecutable;state.spawnArgsSummary=deliveryArgs.join(' ').replace(/(token|password|secret|authorization)[^ ]*/gi,'$1=<redacted>');state.spawnArgv=ptyArgs;state.spawnCwd=spec.repositoryRoot;persist(state);
  // node-pty's event subscription alone is not a referenced Node event-loop
  // handle. Keep this detached supervisor alive only until the exact PTY has
  // reported its authoritative exit and the synchronous durable finalizer ends.
  ptyLifecycleKeepalive=setInterval(()=>{},60_000);
  state.ptySessionId=state.ptySessionId??`pty-${state.runId}`;
  state.terminalSequence=state.terminalSequence??0;
  state.terminalChunks=state.terminalChunks??[];
  state.terminalFirstSequence=state.terminalFirstSequence??(state.terminalSequence-state.terminalChunks.length+1);
  state.terminalStartedAt=state.terminalStartedAt??new Date().toISOString();
  child=pty.spawn(command,ptyArgs,{cwd:spec.repositoryRoot,env:childEnvironment,name:'xterm-256color',cols:120,rows:40});
  state.pid=child.pid??null;state.pidAlive=true;state.processAlive=true;state.spawnedAt=new Date().toISOString();state.startupTransitions=[...(state.startupTransitions??[]),'PROCESS_SPAWNED'];state.normalizedRuntimeEvents=[...(state.normalizedRuntimeEvents??[]),'PROCESS_SPAWNED'];
  if(state.outputMode==='human'){state.phase='RUNNING';state.currentTask='Codex 进程运行中';state.latestEvent='process.spawned';state.readyEvent='pty.spawned';state.startupReadyAt=state.spawnedAt;state.timeoutCancelledAt=state.spawnedAt;state.startupDetectorDecision='PROCESS_PTY_READY';state.startupTransitions=[...(state.startupTransitions??[]),'READY_SIGNAL:pty.spawned'];state.normalizedRuntimeEvents=[...(state.normalizedRuntimeEvents??[]),'PROCESS_PTY_READY','RUNNING'];}
  let buffer='';
  let finalizationStarted=false;
  const finalizeRuntime=(exitCode:number,signal:number|undefined)=>{
    if(finalizationStarted)return;
    finalizationStarted=true;
    syncOwnerStopRequest(state);
    const exitedAt=new Date().toISOString();
    // node-pty exposes one authoritative lifecycle notification: its PTY exit.
    // This is the terminal-session close boundary for a PTY, not a fabricated
    // child_process `close` event.
    state.processExitObserved=true;
    state.processCloseObserved=true;
    state.processExitedAt=exitedAt;
    state.processClosedAt=exitedAt;
    state.terminalClosedAt=exitedAt;
    state.exitCode=exitCode;
    state.processSignal=signal===undefined?null:String(signal);
    state.pidAlive=false;
    state.processAlive=false;
    state.startupTransitions=[...(state.startupTransitions??[]),'PROCESS_EXITED','PTY_SESSION_CLOSED'];
    // This synchronous durable write happens before the remainder of finalization,
    // so a detached supervisor cannot leave a live record after its PTY exits.
    try{persist(state);completeRuntimeFinalization(state,exitCode,signal===undefined?null:String(signal))}
    finally{releasePtyLifecycleKeepalive()}
  };
  child.onData((text:string)=>{state.terminalSequence=(state.terminalSequence??0)+1;state.terminalChunks=[...(state.terminalChunks??[]),text];let terminalBytes=Buffer.byteLength(state.terminalChunks.join(''));
    while(state.terminalChunks.length>maxTerminalChunks||terminalBytes>maxTerminalBytes){state.terminalChunks.shift();state.terminalFirstSequence=(state.terminalFirstSequence??1)+1;terminalBytes=Buffer.byteLength(state.terminalChunks.join(''));state.terminalTruncated=true}
    state.terminalUpdatedAt=new Date().toISOString();state.stdout=`${state.stdout??''}${text}`.slice(-12000);if(state.outputMode==='json'||state.outputMode===undefined){buffer+=text;const parts=buffer.split('\n');buffer=parts.pop()??'';for(const line of parts){if(line.trim())state.rawFirstStdoutEvents=[...(state.rawFirstStdoutEvents??[]),line].slice(0,8);parseEvent(line,state,false)}}persist(state)});
  // Register both PTY listeners before any post-spawn persistence so an immediate
  // child exit cannot occur during a synchronous state-file write without a handler.
  child.onExit(({exitCode,signal})=>finalizeRuntime(exitCode,signal));
  persist(state);
}catch(error){state.phase='FAILED';state.failure=error instanceof Error?error.message:'SUPERVISOR_SPAWN_FAILED';state.pidAlive=false;state.processAlive=false;state.startupTransitions=[...(state.startupTransitions??[]),'SPAWN_FAILED'];state.cleanupAt=new Date().toISOString();state.writerLockReleased=true;state.lockEvents=[...(state.lockEvents??[]),'writer_lock.released'];persist(state);releaseLock();cleanupEphemeralGitHubCredential();releasePtyLifecycleKeepalive();process.exitCode=1}
