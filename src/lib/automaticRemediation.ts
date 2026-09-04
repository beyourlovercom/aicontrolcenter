import type {ExactHeadIdentity} from './exactHeadEvidence.ts';
export type RemediationSource='REVIEW'|'CI';
export type RemediationStatus='REQUESTED'|'RUNNING'|'COMPLETED'|'FAILED'|'CANCELLED';
export type RemediationContext={remediation_id:string;delivery_context_id:string;source_execution_id:string;source_type:RemediationSource;source_head_sha:string;attempt_number:number;status:RemediationStatus;created_at:string;completed_at?:string;worktree_path:string;delivery_branch:string};
export type RemediationStore={items:RemediationContext[]};
let sequence=0;
export function createRemediation(input:{deliveryContextId:string;sourceExecutionId:string;sourceType:RemediationSource;sourceHeadSha?:string;sourceStatus:string;worktreePath:string;deliveryBranch:string;maxAttempts?:number},store:RemediationStore):RemediationContext|null{
  if(!['FAILED'].includes(input.sourceStatus)||!input.sourceHeadSha)return null;
  const prior=store.items.filter(item=>item.delivery_context_id===input.deliveryContextId&&item.source_execution_id===input.sourceExecutionId&&item.source_type===input.sourceType);
  if(prior.length)return prior[0];
  const max=input.maxAttempts??3;const existingAttempts=store.items.filter(item=>item.delivery_context_id===input.deliveryContextId);if(existingAttempts.length>=max)return null;
  const attempt=existingAttempts.length+1;const now=new Date().toISOString();const item={remediation_id:`remediation-${Date.now()}-${++sequence}`,delivery_context_id:input.deliveryContextId,source_execution_id:input.sourceExecutionId,source_type:input.sourceType,source_head_sha:input.sourceHeadSha,attempt_number:attempt,status:'REQUESTED' as const,created_at:now,worktree_path:input.worktreePath,delivery_branch:input.deliveryBranch};store.items.push(item);return item;
}
export function bindRemediationExecution(item:RemediationContext){return {delivery_context_id:item.delivery_context_id,remediation_id:item.remediation_id,worktree_path:item.worktree_path,branch:item.delivery_branch,source_failure:`${item.source_type}:${item.source_execution_id}`,attempt_number:item.attempt_number};}
export function requiresHeadRevalidation(identity:ExactHeadIdentity,oldHead:string){return identity.head_sha!==oldHead;}
