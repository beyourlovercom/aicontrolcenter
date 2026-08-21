import type {ExecutionProviderRegistry} from './executionProviderRegistry.ts';
import type {RealCiExecution} from './realCiRuntime.ts';
import type {RealPrContext} from './realPrContext.ts';
import {createRealCiExecution,type CiExecutionStore} from './realCiRuntime.ts';
import {createRealReviewExecution,type ReviewExecutionStore} from './realReviewRuntime.ts';
import type {DeliveryContext} from './deliveryWorkspace.ts';

export type RemediationContext={remediation_id:string;original_execution_id:string;failure_payload:unknown;delivery_context_id:string;worktree_path:string;branch:string;old_head_sha:string;new_head_sha:string|null;provider_id:string;execution_id:string;created_at:string};
export type RemediationStore={get(key:string):RemediationContext|null;put(value:RemediationContext):void};
export type RemediationResult={context:RemediationContext;reviewExecution:ReturnType<typeof createRealReviewExecution>;ciExecution:RealCiExecution};

export function createRealRemediation(input:{ciFailure:RealCiExecution;failurePayload:unknown;delivery:DeliveryContext;pr:RealPrContext;providerId:string;registry:ExecutionProviderRegistry;store:RemediationStore;reviews:ReviewExecutionStore;ci:CiExecutionStore;newHeadSha:string;now?:string}):RemediationResult{
  const now=input.now??new Date().toISOString();const key=`${input.ciFailure.ci_execution_id}:${input.ciFailure.head_sha}:${input.providerId}`;const existing=input.store.get(key);
  if(existing){const review=createRealReviewExecution({...input.pr,head_sha:existing.new_head_sha??input.pr.head_sha},input.providerId,input.registry,input.reviews,now);const ci=createRealCiExecution({...input.pr,head_sha:existing.new_head_sha??input.pr.head_sha},input.providerId,input.registry,input.ci,now);return {context:existing,reviewExecution:review,ciExecution:ci};}
  const executionId=`remediation-${input.ciFailure.ci_execution_id}`;const context={execution_id:executionId,instruction_id:executionId,repository:input.delivery.repository,branch:input.delivery.deliveryBranch,worktree_path:input.delivery.worktreePath,sandbox:'workspace-write' as const,execution_type:'REMEDIATION'};const error=input.registry.validate(input.providerId,context);if(error)throw new Error(error.code);
  const remediation:RemediationContext={remediation_id:key,original_execution_id:input.ciFailure.ci_execution_id,failure_payload:input.failurePayload,delivery_context_id:input.delivery.deliveryContextId,worktree_path:input.delivery.worktreePath,branch:input.delivery.deliveryBranch,old_head_sha:input.ciFailure.head_sha,new_head_sha:input.newHeadSha,provider_id:input.providerId,execution_id:executionId,created_at:now};input.store.put(remediation);
  const nextPr={...input.pr,head_sha:input.newHeadSha};const review=createRealReviewExecution(nextPr,input.providerId,input.registry,input.reviews,now);const ci=createRealCiExecution(nextPr,input.providerId,input.registry,input.ci,now);return {context:remediation,reviewExecution:review,ciExecution:ci};
}
