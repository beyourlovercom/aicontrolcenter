import {persistReviewEvidence,projectExactHeadValidation,type ExactHeadIdentity,type ReviewEvidence} from './exactHeadEvidence.ts';

export type ReviewExecutionStatus='NOT_STARTED'|'RUNNING'|'COMPLETED'|'FAILED';
export type ReviewExecution={review_execution_id:string;delivery_context_id:string;repository:string;pr_number:number;head_sha:string;review_provider:string;status:ReviewExecutionStatus;created_at:string;completed_at?:string;failure_reason?:string};
export type ReviewRequestStore={executions:ReviewExecution[];reviews:ReviewEvidence[]};
let reviewSequence=0;
export function reviewExecutionKey(input:Pick<ReviewExecution,'repository'|'pr_number'|'head_sha'|'review_provider'>){return `${input.repository}#${input.pr_number}@${input.head_sha}:${input.review_provider}`;}
export function createAutomaticReviewExecution(input:{deliveryContextId:string;repository:string;prNumber?:number|null;headSha?:string|null;provider:string;status?:'READY_FOR_REVIEW'|'PR_CREATED'|'READY_FOR_EXECUTION'},store:ReviewRequestStore):ReviewExecution|null{
  if(input.status!=='READY_FOR_REVIEW'||!input.prNumber||!input.headSha)return null;
  const identity={repository:input.repository,pr_number:input.prNumber,head_sha:input.headSha,review_provider:input.provider};
  const existing=store.executions.find(item=>reviewExecutionKey(item)===reviewExecutionKey(identity)&&item.status!=='FAILED');
  if(existing)return existing;
  const now=new Date().toISOString();const execution={review_execution_id:`review-run-${Date.now()}-${++reviewSequence}`,delivery_context_id:input.deliveryContextId,repository:input.repository,pr_number:input.prNumber,head_sha:input.headSha,review_provider:input.provider,status:'RUNNING' as const,created_at:now};
  store.executions.push(execution);return execution;
}
export function completeAutomaticReview(execution:ReviewExecution,store:ReviewRequestStore,result:{reviewer:string;review_status:ReviewEvidence['review_status'];review_summary:string;review_id?:string}):ReviewEvidence[]{
  execution.status=result.review_status==='ERROR'?'FAILED':'COMPLETED';execution.completed_at=new Date().toISOString();if(result.review_status==='ERROR')execution.failure_reason=result.review_summary;
  const evidence:ReviewEvidence={review_id:result.review_id??execution.review_execution_id,repository:execution.repository,pr_number:execution.pr_number,head_sha:execution.head_sha,reviewer:result.reviewer,review_provider:execution.review_provider,review_status:result.review_status,review_summary:result.review_summary,reviewed_at:execution.completed_at};
  store.reviews=persistReviewEvidence(store.reviews,evidence);return store.reviews;
}
export function projectAutomaticReview(execution:ReviewExecution|null,currentHead:string,store:ReviewRequestStore){if(!execution)return null;return projectExactHeadValidation({repository:execution.repository,pr_number:execution.pr_number,head_sha:currentHead},store.reviews,[]).review;}
