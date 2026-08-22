import {sameCanonicalPath} from './canonicalPathIdentity.ts';
export const HEALTH_FAILURE_THRESHOLD=2;
export const MAX_RECOVERY_ATTEMPTS=3;

export type LocalServiceState='PROCESS_DEAD'|'PROCESS_ALIVE_HEALTHY'|'PROCESS_ALIVE_HEALTH_DEGRADED'|'SERVICE_UNHEALTHY'|'RESTARTING'|'RECOVERED'|'HEALTHY'|'RECOVERY_FAILED';
export type HealthFailureReason='ECONNREFUSED'|'ETIMEDOUT'|'HTTP_500'|'HTTP_404'|'INVALID_HEALTH_RESPONSE'|'CONNECTION_RESET'|'PROCESS_EXITED'|'UNKNOWN'|'FOREIGN_PORT_CONFLICT';
export type LocalServiceClassification='HEALTHY_CANONICAL_SERVICE'|'PROCESS_ALIVE_HEALTH_DEGRADED'|'PROCESS_ALIVE_CONFIRMED_UNUSABLE'|'STALE_CANONICAL_SERVICE'|'FOREIGN_PORT_CONFLICT'|'NO_SERVICE'|'STARTING';
export type ServiceObservation={listener:null|{pid:number;command:string;cwd:string};health:{responded:boolean;canonicalIdentity:boolean;ok:boolean;reason?:HealthFailureReason};consecutiveHealthFailures:number;repositoryRoot:string};
export type SupervisorHealthState={state:LocalServiceState;managedPid:number|null;consecutiveFailures:number;recoveryEpoch:number;recoveryAttempts:number;lastHealthFailure?:{reason:HealthFailureReason;detail?:string};previousEpoch?:{recoveryEpoch:number;consecutiveFailures:number;lastHealthFailure?:{reason:HealthFailureReason;detail?:string}}};
export type RecoveryDecision={state:SupervisorHealthState;action:'NONE'|'RETRY_HEALTH'|'START_SERVICE'|'TERMINATE_AND_RESTART'|'RECOVERED'|'RECOVERY_FAILED'|'BLOCKED_UNSAFE_PID';reason?:HealthFailureReason};

export function isCanonicalListener(observation:ServiceObservation):boolean{
  const listener=observation.listener;
  return Boolean(listener&&sameCanonicalPath(listener.cwd,observation.repositoryRoot)&&/node_modules\/\.bin\/vite|vite .*127\.0\.0\.1/.test(listener.command));
}

export function classifyLocalService(observation:ServiceObservation):LocalServiceClassification{
  if(!observation.listener)return 'NO_SERVICE';
  if(!isCanonicalListener(observation))return 'FOREIGN_PORT_CONFLICT';
  if(observation.health.responded&&observation.health.canonicalIdentity&&observation.health.ok)return 'HEALTHY_CANONICAL_SERVICE';
  return observation.consecutiveHealthFailures>=HEALTH_FAILURE_THRESHOLD?'PROCESS_ALIVE_HEALTH_DEGRADED':'STARTING';
}

function failedState(state:SupervisorHealthState,reason:HealthFailureReason):SupervisorHealthState{
  const nextFailures=state.consecutiveFailures+1;
  const nextState:LocalServiceState=state.managedPid===null?'PROCESS_DEAD':'PROCESS_ALIVE_HEALTH_DEGRADED';
  return {...state,state:nextState,consecutiveFailures:nextFailures,lastHealthFailure:{reason}};
}

export function applyHealthObservation(state:SupervisorHealthState,observation:{processAlive:boolean;healthOk:boolean;reason?:HealthFailureReason;managedPidOwned?:boolean}):RecoveryDecision{
  if(observation.healthOk){
    const nextState:LocalServiceState='HEALTHY';
    const next:SupervisorHealthState={...state,state:nextState,consecutiveFailures:0,lastHealthFailure:state.lastHealthFailure};
    return {state:next,action:state.recoveryAttempts>0?'RECOVERED':'NONE'};
  }
  const reason=observation.reason??(observation.processAlive?'UNKNOWN':'PROCESS_EXITED');
  const next=failedState({...state,managedPid:observation.processAlive?state.managedPid:null},reason);
  if(state.recoveryAttempts>=MAX_RECOVERY_ATTEMPTS){
    return {state:{...next,state:'RECOVERY_FAILED'},action:'RECOVERY_FAILED',reason};
  }
  if(!observation.processAlive)return {state:{...next,state:'RESTARTING',recoveryAttempts:state.recoveryAttempts+1},action:'START_SERVICE',reason};
  if(observation.managedPidOwned===false)return {state:{...next,state:'RECOVERY_FAILED'},action:'BLOCKED_UNSAFE_PID',reason:'FOREIGN_PORT_CONFLICT'};
  if(next.consecutiveFailures<HEALTH_FAILURE_THRESHOLD)return {state:next,action:'RETRY_HEALTH',reason};
  return {state:{...next,state:'SERVICE_UNHEALTHY',recoveryAttempts:state.recoveryAttempts+1},action:'TERMINATE_AND_RESTART',reason};
}

export function beginRecoveryEpoch(previous:SupervisorHealthState):SupervisorHealthState{
  return {state:'PROCESS_DEAD',managedPid:null,consecutiveFailures:0,recoveryEpoch:previous.recoveryEpoch+1,recoveryAttempts:0,previousEpoch:{recoveryEpoch:previous.recoveryEpoch,consecutiveFailures:previous.consecutiveFailures,lastHealthFailure:previous.lastHealthFailure}};
}

export function manualRestart(previous:SupervisorHealthState):SupervisorHealthState{
  return {...beginRecoveryEpoch(previous),state:'RESTARTING',recoveryAttempts:1};
}

export function recoveryActions(classification:LocalServiceClassification):string[]{
  if(classification==='PROCESS_ALIVE_CONFIRMED_UNUSABLE')return ['VERIFY_CANONICAL_IDENTITY','SIGTERM','BOUNDED_WAIT','REVERIFY_CANONICAL_IDENTITY','SIGKILL_IF_NEEDED','WAIT_FOR_LAUNCHD','POLL_CANONICAL_HEALTH'];
  if(classification==='PROCESS_ALIVE_HEALTH_DEGRADED')return ['RETRY_HEALTH_WITH_BACKOFF','THRESHOLD_TO_SERVICE_UNHEALTHY','VERIFY_CANONICAL_IDENTITY','SIGTERM','BOUNDED_WAIT','START_OFFICIAL_SERVICE','POLL_CANONICAL_HEALTH'];
  if(classification==='NO_SERVICE')return ['START_OFFICIAL_SERVICE','POLL_CANONICAL_HEALTH'];
  if(classification==='FOREIGN_PORT_CONFLICT')return ['REPORT_PORT_1420_CONFLICT'];
  return classification==='STARTING'?['POLL_CANONICAL_HEALTH']:[];
}

export function reconnectEffect(previous:LocalServiceClassification,current:LocalServiceClassification){return {showRecovery:current==='PROCESS_ALIVE_HEALTH_DEGRADED'||current==='STALE_CANONICAL_SERVICE'||current==='STARTING'||current==='NO_SERVICE',refreshSnapshot:previous!=='HEALTHY_CANONICAL_SERVICE'&&current==='HEALTHY_CANONICAL_SERVICE',preserveSelection:true};}
