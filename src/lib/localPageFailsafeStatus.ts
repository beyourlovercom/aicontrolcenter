import type {LocalServiceStatus,RepositoryModel} from './controlService.ts';

export type LocalPageRenderState='FAILED'|'NOT_REPORTED';
export type LocalPageFrontendBootState='TIMEOUT'|'SCRIPT_ERROR'|'RUNTIME_ERROR'|'NOT_REPORTED';

const clean=(value:unknown,fallback='NOT_AVAILABLE')=>{
  const text=String(value??'').replace(/\s+/g,' ').trim();
  return (text||fallback).slice(0,800);
};
const yesNo=(value:boolean|undefined)=>value===true?'YES':value===false?'NO':'NOT_AVAILABLE';

export function formatLocalPageFailsafeStatus(input:{
  pageRender?:LocalPageRenderState;
  frontendBoot?:LocalPageFrontendBootState;
  frontendError?:unknown;
  httpReachable?:boolean;
  status?:LocalServiceStatus|null;
  repository?:RepositoryModel|null;
  timestamp?:string;
}){
  const status=input.status??null,supervisor=status?.supervisor,repository=input.repository??null;
  const httpReachable=input.httpReachable!==false;
  const lines=[
    'AICC_LOCAL_PAGE_STATUS_V1','',
    `PAGE_RENDER = ${input.pageRender??'NOT_REPORTED'}`,
    `FRONTEND_BOOT = ${input.frontendBoot??'NOT_REPORTED'}`,
    `PORT_1420 = ${httpReachable?'LISTENING':'UNKNOWN'}`,
    `PORT_OWNER = ${clean(status?.portOwner)}`,
    `HTTP_1420 = ${httpReachable?'REACHABLE':'UNREACHABLE'}`,
    `API_HEALTH = ${status?status.serviceHealthy?'HEALTHY':'UNHEALTHY':'NOT_AVAILABLE'}`,'',
    `SERVICE_PROCESS_RUNNING = ${yesNo(status?.processRunning)}`,
    `SERVICE_HEALTHY = ${yesNo(status?.serviceHealthy)}`,
    `SUPERVISOR_STATE = ${clean(supervisor?.state)}`,
    `MANAGED_PID = ${clean(supervisor?.managedPid)}`,'',
    `REPOSITORY_AVAILABLE = ${yesNo(status?.repositoryAvailable)}`,
    `CODEX_AVAILABLE = ${yesNo(status?.codexAvailable)}`,
    `BRANCH = ${clean(repository?.branch)}`,
    `HEAD = ${clean(repository?.head)}`,
    `WORKTREE = ${clean(repository?.worktree)}`,'',
    `RECOVERY_EPOCH = ${clean(supervisor?.recoveryEpoch)}`,
    `RECOVERY_ATTEMPTS = ${clean(supervisor?.recoveryAttempts)}`,
    `CONSECUTIVE_FAILURES = ${clean(supervisor?.consecutiveFailures)}`,
    `LAST_HEALTH_FAILURE = ${clean(supervisor?.lastHealthFailure)}`,
    `LAST_HEALTH_DETAIL = ${clean(supervisor?.lastHealthDetail)}`,'',
    `FRONTEND_ERROR = ${clean(input.frontendError)}`,
    `TIMESTAMP = ${clean(input.timestamp??new Date().toISOString())}`,'',
    'END_AICC_LOCAL_PAGE_STATUS_V1'
  ];
  return lines.join('\n');
}
