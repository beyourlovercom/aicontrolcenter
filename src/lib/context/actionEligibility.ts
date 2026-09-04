import type {ActionEligibility,AiccProjectSnapshot,ResolvedAuthorization,SelectedEntityRef,WorkPackageLifecycle,FormalizationState} from '../model/entityTypes.ts';

const action=(id:ActionEligibility['id'],visible:boolean,enabled:boolean,reasonCode?:string,reasonLabel?:string):ActionEligibility=>({id,visible,enabled,...(reasonCode?{reasonCode}:{}) ,...(reasonLabel?{reasonLabel}:{})});
const TECHNICAL_RETRY_FAILURES=['PROVIDER_UNAVAILABLE','CODEX_RUNTIME_UNAVAILABLE','EXECUTION_FAILED','SPAWN_FAILED','PROCESS_LAUNCH_FAILED','RUNTIME_CREATION_FAILED','EXECUTION_PROVIDER_UNAVAILABLE','LOCAL_SERVICE_UNAVAILABLE','TRANSPORT_FAILED'];
export function isRetryableRuntimeFailure(runtime:{phase?:string;failure?:string}|null|undefined){
  if(!runtime||!['FAILED','RECOVERY_REQUIRED'].includes(runtime.phase??''))return false;
  const failure=String(runtime.failure??'').toUpperCase();
  return TECHNICAL_RETRY_FAILURES.some(code=>failure===code||failure.startsWith(`${code}:`)||failure.includes(code));
}
export function resolveAvailableActions(entity:SelectedEntityRef,snapshot:AiccProjectSnapshot,formalization?:FormalizationState,lifecycle?:WorkPackageLifecycle,authorization?:ResolvedAuthorization):ActionEligibility[]{
  if(entity.type==='milestone')return [action('REFRESH',true,true)];
  if(entity.type==='phase')return [action('REFRESH',true,true)];
  if(entity.type==='pull_request'){const record=snapshot.pullRequests.value?.find(item=>item.id===entity.id);return [action('REFRESH',true,true),action('PR_CREATE_DRAFT',true,!record?.url,'PR_ALREADY_BOUND','当前 PR 已存在，继续执行不会重复创建'),action('PR_OPEN',Boolean(record?.url),Boolean(record?.url),'PR_NOT_BOUND','当前尚未绑定真实 GitHub PR')];}
  const repo=snapshot.repository.value,runtime=snapshot.runtime.value;
  const matchingRuntime=runtime?.workPackageId===entity.id?runtime:null;
  const activeRuntime=Boolean(matchingRuntime&&['STARTING','RUNNING','STOPPING'].includes(matchingRuntime.phase));
  const humanUat=lifecycle?.currentStage==='HUMAN_UAT';
  const closed=lifecycle?.currentStage==='CLOSED';
  const planned=formalization==='PLANNED_ONLY',invalid=formalization==='FORMAL_INVALID';
  const blockedLabel=humanUat?'当前 Work Package 正处于 Human UAT，常规授权与启动操作不适用。':planned?'当前 Work Package 尚未正式化，不能授权执行。':invalid?'正式 Work Package 无效，不能执行。':undefined;
  return [
    action('REFRESH',true,true),
    action('AUTHORIZE',true,!humanUat&&!planned&&!invalid&&Boolean(repo)&&authorization?.state!=='VALID',humanUat?'HUMAN_UAT_ACTION_NOT_APPLICABLE':planned?'FORMAL_WP_DOCUMENT_MISSING':invalid?'FORMAL_WP_INVALID':undefined,blockedLabel),
    // The browser snapshot may be stale. A matching persisted authorization
    // record is enough to expose the action; the server performs the live
    // repository/WP/authorization/lease preflight before spawning Codex.
    action('START_CODEX',true,!closed,closed?'WP_CLOSED':'WP_READY',closed?'Work Package 已完成，无需再次启动执行。':undefined),
    action('STOP_CODEX',true,Boolean(matchingRuntime&&['STARTING','RUNNING','STOPPING'].includes(matchingRuntime.phase)),'NO_ACTIVE_MATCHING_RUNTIME','当前 WP 没有活动中的 Codex Runtime。'),
    action('RETRY',true,isRetryableRuntimeFailure(matchingRuntime),'NO_RETRYABLE_RUNTIME','当前没有可重试的技术失败运行。'),
    action('SAFE_MAIN_SYNC',true,Boolean(repo&&repo.worktree==='CLEAN'&&repo.branch!=='main'),repo?.worktree!=='CLEAN'?'WORKTREE_DIRTY':'SYNC_NOT_ELIGIBLE','仓库当前不满足安全同步条件。')
  ];
}
