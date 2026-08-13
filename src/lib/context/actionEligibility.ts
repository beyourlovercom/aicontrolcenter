import type {ActionEligibility,AiccProjectSnapshot,ResolvedAuthorization,SelectedEntityRef,WorkPackageLifecycle,FormalizationState} from '../model/entityTypes.ts';

const action=(id:ActionEligibility['id'],visible:boolean,enabled:boolean,reasonCode?:string,reasonLabel?:string):ActionEligibility=>({id,visible,enabled,...(reasonCode?{reasonCode}:{}) ,...(reasonLabel?{reasonLabel}:{})});
export function isRetryableRuntimePhase(phase:string|undefined){return Boolean(phase&&['FAILED','STOPPED','RECOVERY_REQUIRED'].includes(phase));}
export function resolveAvailableActions(entity:SelectedEntityRef,snapshot:AiccProjectSnapshot,formalization?:FormalizationState,lifecycle?:WorkPackageLifecycle,authorization?:ResolvedAuthorization):ActionEligibility[]{
  if(entity.type==='milestone')return [action('REFRESH',true,true)];
  if(entity.type==='pull_request')return [action('REFRESH',true,true),action('PR_START_CODEX',true,false,'PR_EXECUTION_CONTRACT_NOT_BOUND','PR 尚未绑定独立 Codex 执行合同'),action('PR_STOP',true,false,'PR_NO_ACTIVE_EXECUTION','当前没有活动中的 PR 执行'),action('PR_RETRY',true,false,'PR_RETRY_NOT_AVAILABLE','当前没有可重试的 PR 执行'),action('PR_OPEN',true,false,'PR_NOT_BOUND','未绑定真实 GitHub PR'),action('PR_APPROVE_MERGE',true,false,'PR_MERGE_EVIDENCE_MISSING','当前 Demo PR 未绑定真实 PR / CI / Merge evidence')];
  const repo=snapshot.repository.value,runtime=snapshot.runtime.value;
  const matchingRuntime=runtime?.workPackageId===entity.id?runtime:null;
  const activeRuntime=Boolean(matchingRuntime&&['STARTING','RUNNING','STOPPING'].includes(matchingRuntime.phase));
  const humanUat=lifecycle?.currentStage==='HUMAN_UAT';
  const planned=formalization==='PLANNED_ONLY',invalid=formalization==='FORMAL_INVALID';
  const blockedLabel=humanUat?'当前 Work Package 正处于 Human UAT，常规授权与启动操作不适用。':planned?'当前 Work Package 尚未正式化，不能授权执行。':invalid?'正式 Work Package 无效，不能执行。':undefined;
  return [
    action('REFRESH',true,true),
    action('AUTHORIZE',true,!humanUat&&!planned&&!invalid&&Boolean(repo)&&authorization?.state!=='VALID',humanUat?'HUMAN_UAT_ACTION_NOT_APPLICABLE':planned?'FORMAL_WP_DOCUMENT_MISSING':invalid?'FORMAL_WP_INVALID':undefined,blockedLabel),
    // The browser snapshot may be stale. A matching persisted authorization
    // record is enough to expose the action; the server performs the live
    // repository/WP/authorization/lease preflight before spawning Codex.
    action('START_CODEX',true,true),
    action('STOP_CODEX',true,Boolean(matchingRuntime&&['STARTING','RUNNING','STOPPING'].includes(matchingRuntime.phase)),'NO_ACTIVE_MATCHING_RUNTIME','当前 WP 没有活动中的 Codex Runtime。'),
    action('RETRY',true,isRetryableRuntimePhase(matchingRuntime?.phase),'NO_RETRYABLE_RUNTIME','当前没有可重试的终态运行。'),
    action('SAFE_MAIN_SYNC',true,Boolean(repo&&repo.worktree==='CLEAN'&&repo.branch!=='main'),repo?.worktree!=='CLEAN'?'WORKTREE_DIRTY':'SYNC_NOT_ELIGIBLE','仓库当前不满足安全同步条件。')
  ];
}
