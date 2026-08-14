import {execFileSync, spawn} from 'node:child_process';
import {mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {parseEvent, reconcileProcessExit, type RuntimeState} from '../src/lib/runtimeManager.ts';

type SupervisorSpec={state:RuntimeState;stateDir:string;repositoryRoot:string;lockFile:string;prompt:string;command?:string;args?:string[]};
const specFile=process.argv[2];
if(!specFile)throw new Error('SUPERVISOR_SPEC_REQUIRED');
const spec=JSON.parse(readFileSync(specFile,'utf8')) as SupervisorSpec;
const runFile=spec.state.passThrough?join(spec.stateDir,`runtime-${spec.state.runId}.json`):join(spec.stateDir,'runtime.json');
const historyFile=join(spec.stateDir,'runtime-history.json');
const maxHistory=20;

function persist(state:RuntimeState){
  mkdirSync(spec.stateDir,{recursive:true});
  const runTemp=`${runFile}.${process.pid}.tmp`;
  writeFileSync(runTemp,JSON.stringify(state,null,2),{mode:0o600});
  renameSync(runTemp,runFile);
  if(!['COMPLETED','FAILED','STOPPED','RECOVERY_REQUIRED'].includes(state.phase))return;
  let history:RuntimeState[]=[];
  try{history=JSON.parse(readFileSync(historyFile,'utf8')) as RuntimeState[]}catch{}
  const historyTemp=`${historyFile}.${process.pid}.tmp`;
  writeFileSync(historyTemp,JSON.stringify([state,...history.filter(item=>item.runId!==state.runId)].slice(0,maxHistory),null,2),{mode:0o600});
  renameSync(historyTemp,historyFile);
}
function releaseLock(){try{unlinkSync(spec.lockFile)}catch{}}
function finish(state:RuntimeState,code:number|null,signal:string|null){
  state.processCloseObserved=true;
  state.processSignal=signal;
  state.exitCode=code;
  state.pidAlive=false;
  state.completedAt=new Date().toISOString();
  state.lastActivityAt=state.completedAt;
  try{state.postRunHead=execFileSync('git',['rev-parse','HEAD'],{cwd:spec.repositoryRoot,encoding:'utf8'}).trim()}catch{state.postRunHead='UNAVAILABLE'}
  try{const changed=execFileSync('git',['status','--porcelain'],{cwd:spec.repositoryRoot,encoding:'utf8'}).trim();state.changedFiles=changed?changed.split('\n'):[]}catch{state.changedFiles=['STATUS_UNAVAILABLE']}
  state.codeChangePresent=state.postRunHead!==state.authorizedHead||(state.changedFiles?.length??0)>0;
  state.implementationResult=['IMPLEMENTATION','REMEDIATION'].includes(state.executionType??'')?(state.codeChangePresent?'CODE_CHANGE_PRESENT':'NO_IMPLEMENTATION_CHANGE'):'READ_ONLY';
  reconcileProcessExit(state,code,signal);
  persist(state);releaseLock();
}
const state=spec.state;
state.supervisorPid=process.pid;
state.latestEvent='supervisor.started';
state.lastActivityAt=new Date().toISOString();
persist(state);
let child;
try{
  const deliveryProfile=state.executionProfile==='OWNER_AUTHORIZED_GIT_DELIVERY';
  const childEnvironment=deliveryProfile ? (() => {
    const environment={...process.env};
    delete environment.GH_TOKEN;
    delete environment.GITHUB_TOKEN;
    environment.HOME=environment.HOME??process.env.USERPROFILE??'/Users/a';
    environment.PATH=[environment.PATH,'/Users/a/.local/bin','/opt/homebrew/bin','/usr/bin','/bin'].filter(Boolean).join(':');
    return environment;
  })() : process.env;
  const childArgs=spec.args??['exec','--sandbox',state.sandboxMode??'workspace-write','--json','-'];
  const deliveryArgs=deliveryProfile ? ['-c','sandbox_workspace_write.network_access=true',...childArgs] : childArgs;
  child=spawn(spec.command??'codex',deliveryArgs,{cwd:spec.repositoryRoot,shell:false,env:childEnvironment,stdio:['pipe','pipe','pipe']});
  state.pid=child.pid??null;state.pidAlive=true;persist(state);
  let buffer='';
  child.stdout?.on('data',(chunk:Buffer|string)=>{buffer+=chunk.toString();const parts=buffer.split('\n');buffer=parts.pop()??'';for(const line of parts){parseEvent(line,state,false);persist(state)}});
  child.stderr?.on('data',(chunk:Buffer|string)=>{const text=chunk.toString();state.stderr=`${state.stderr??''}${text}`.slice(-4000);state.latestEvent=text.trim().slice(-500);state.lastActivityAt=new Date().toISOString();persist(state)});
  let exitCode:number|null|undefined;let exitSignal:string|null=null;
  child.on('exit',(code,signal)=>{state.processExitObserved=true;exitCode=code;exitSignal=signal;state.exitCode=code;state.processSignal=signal;state.pidAlive=false;persist(state)});
  child.on('close',(code)=>finish(state,code??exitCode??null,exitSignal));
  child.stdin?.end(spec.prompt);
}catch(error){state.phase='FAILED';state.failure=error instanceof Error?error.message:'SUPERVISOR_SPAWN_FAILED';state.pidAlive=false;persist(state);releaseLock();process.exitCode=1}
