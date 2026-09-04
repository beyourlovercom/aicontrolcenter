import type {ExecutionProviderRegistry} from './executionProviderRegistry.ts';
import type {ExecutionProviderContext} from './executionProvider.ts';
import {projectExactHeadValidation,type CiEvidence} from './exactHeadEvidence.ts';
import type {RealPrContext} from './realPrContext.ts';

export type RealCiState='PENDING'|'RUNNING'|'PASSED'|'FAILED'|'STALE';
export type CiResultStatus='RUNNING'|'PASSED'|'FAILED'|'CANCELLED';
export type RealCiExecution={ci_execution_id:string;delivery_context_id:string;repository:string;branch:string;pr_number:number;commit_sha:string;head_sha:string;provider_id:string;started_at:string;status:RealCiState;result_status:CiResultStatus;result_payload?:unknown;updated_at:string};
export type CiExecutionStore={get(key:string):RealCiExecution|null;put(value:RealCiExecution):void};
export type CiEvidenceStore={items:CiEvidence[];append(value:CiEvidence):void};

export function createRealCiExecution(pr:RealPrContext,providerId:string,registry:ExecutionProviderRegistry,store:CiExecutionStore,now=new Date().toISOString()):RealCiExecution{
  const key=`${pr.delivery_context_id}:${pr.head_sha}:${providerId}`;const existing=store.get(key);if(existing)return existing;
  const provider=registry.get(providerId);if(!provider)throw new Error('PROVIDER_NOT_FOUND');
  const context:ExecutionProviderContext={execution_id:`ci-${pr.pr_context_id}-${pr.head_sha}`,instruction_id:`ci-${pr.pr_context_id}`,repository:pr.repository,branch:pr.commit.branch,worktree_path:pr.commit.repository,sandbox:'read-only',execution_type:'CI'};
  const error=registry.validate(providerId,context);if(error)throw new Error(error.code);
  const execution:RealCiExecution={ci_execution_id:key,delivery_context_id:pr.delivery_context_id,repository:pr.repository,branch:pr.commit.branch,pr_number:pr.pr_number??0,commit_sha:pr.commit.sha,head_sha:pr.head_sha,provider_id:provider.providerId,started_at:now,status:'RUNNING',result_status:'RUNNING',updated_at:now};store.put(execution);return execution;
}
export function normalizeCiResult(status:'RUNNING'|'PASS'|'FAIL'|'CANCELLED',payload?:unknown):{status:CiResultStatus;result_payload:unknown}{return {status:status==='PASS'?'PASSED':status==='FAIL'?'FAILED':status,result_payload:payload??null};}
export function persistRealCiResult(execution:RealCiExecution,result:{status:'RUNNING'|'PASS'|'FAIL'|'CANCELLED';payload?:unknown},store:CiEvidenceStore,now=new Date().toISOString()):CiEvidence{
  const normalized=normalizeCiResult(result.status,result.payload);execution.result_status=normalized.status;execution.result_payload=normalized.result_payload;execution.status=normalized.status==='PASSED'?'PASSED':normalized.status==='FAILED'?'FAILED':normalized.status==='CANCELLED'?'FAILED':'RUNNING';execution.updated_at=now;
  const evidence:CiEvidence={ci_run_id:execution.ci_execution_id,repository:execution.repository,pr_number:execution.pr_number,head_sha:execution.head_sha,provider:execution.provider_id,workflow:'provider-ci',status:normalized.status,conclusion:normalized.status==='PASSED'?'SUCCESS':normalized.status==='FAILED'?'FAILURE':'NOT_AVAILABLE',started_at:execution.started_at,completed_at:normalized.status==='RUNNING'?undefined:now};store.append(evidence);return evidence;
}
export function projectCiState(execution:RealCiExecution,currentHead:string):RealCiState{return execution.head_sha!==currentHead?'STALE':execution.status;}
export function ciIsCurrent(execution:RealCiExecution,currentHead:string,evidence:CiEvidence[]){return projectExactHeadValidation({repository:execution.repository,pr_number:execution.pr_number,head_sha:currentHead},[],evidence).ci.current_for_head&&execution.head_sha===currentHead;}
