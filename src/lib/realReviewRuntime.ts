import type {ExecutionProviderRegistry} from './executionProviderRegistry.ts';
import type {ExecutionProviderContext} from './executionProvider.ts';
import {projectExactHeadValidation,type ReviewEvidence} from './exactHeadEvidence.ts';
import type {RealPrContext} from './realPrContext.ts';

export type RealReviewState='PENDING'|'RUNNING'|'PASSED'|'FAILED'|'STALE';
export type RealReviewExecution={review_execution_id:string;delivery_context_id:string;repository:string;pr_number:number;head_sha:string;provider_id:string;state:RealReviewState;result?:string;created_at:string;updated_at:string};
export type ReviewExecutionStore={get(key:string):RealReviewExecution|null;put(value:RealReviewExecution):void};
export type ReviewEvidenceStore={items:ReviewEvidence[];append(value:ReviewEvidence):void};

export function createRealReviewExecution(pr:RealPrContext,providerId:string,registry:ExecutionProviderRegistry,store:ReviewExecutionStore,now=new Date().toISOString()):RealReviewExecution{
  const key=`${pr.delivery_context_id}:${pr.head_sha}:${providerId}`;const existing=store.get(key);if(existing)return existing;
  const provider=registry.get(providerId);if(!provider)throw new Error('PROVIDER_NOT_FOUND');
  const context:ExecutionProviderContext={execution_id:`review-${pr.pr_context_id}-${pr.head_sha}`,instruction_id:`review-${pr.pr_context_id}`,repository:pr.repository,branch:pr.commit.branch,worktree_path:pr.commit.repository,sandbox:'read-only',execution_type:'REVIEW'};
  const error=registry.validate(providerId,context);if(error)throw new Error(error.code);
  const execution:RealReviewExecution={review_execution_id:key,delivery_context_id:pr.delivery_context_id,repository:pr.repository,pr_number:pr.pr_number??0,head_sha:pr.head_sha,provider_id:provider.providerId,state:'RUNNING',created_at:now,updated_at:now};store.put(execution);return execution;
}
export function projectReviewState(execution:RealReviewExecution,currentHead:string):RealReviewState{if(execution.head_sha!==currentHead)return 'STALE';return execution.state;}
export function persistRealReviewEvidence(execution:RealReviewExecution,result:string,status:'PASS'|'FAIL',store:ReviewEvidenceStore,now=new Date().toISOString()):ReviewEvidence{
  const evidence:ReviewEvidence={review_id:execution.review_execution_id,repository:execution.repository,pr_number:execution.pr_number,head_sha:execution.head_sha,reviewer:execution.provider_id,review_provider:execution.provider_id,review_status:status,review_summary:result,reviewed_at:now};store.append(evidence);execution.state=status==='PASS'?'PASSED':'FAILED';execution.result=result;execution.updated_at=now;return evidence;
}
export function reviewIsCurrent(execution:RealReviewExecution,currentHead:string,evidence:ReviewEvidence[]){return projectExactHeadValidation({repository:execution.repository,pr_number:execution.pr_number,head_sha:currentHead},evidence,[]).review.current_for_head&&execution.head_sha===currentHead;}
