import {dedupeCiEvidence,projectExactHeadValidation,type CiEvidence} from './exactHeadEvidence.ts';
export type CiExecutionStatus='NOT_STARTED'|'RUNNING'|'COMPLETED'|'FAILED';
export type CiExecution={ci_execution_id:string;delivery_context_id:string;repository:string;pr_number:number;head_sha:string;ci_provider:string;status:CiExecutionStatus;created_at:string;completed_at?:string;failure_reason?:string};
export type CiRequestStore={executions:CiExecution[];ci:CiEvidence[]};
let ciSequence=0;
const key=(value:Pick<CiExecution,'repository'|'pr_number'|'head_sha'|'ci_provider'>)=>`${value.repository}#${value.pr_number}@${value.head_sha}:${value.ci_provider}`;
export function createAutomaticCiExecution(input:{deliveryContextId:string;repository:string;prNumber?:number|null;headSha?:string|null;provider:string;status?:'READY_FOR_CI'|'READY_FOR_REVIEW'},store:CiRequestStore):CiExecution|null{
  if(input.status!=='READY_FOR_CI'||!input.prNumber||!input.headSha)return null;
  const identity={repository:input.repository,pr_number:input.prNumber,head_sha:input.headSha,ci_provider:input.provider};const existing=store.executions.find(item=>key(item)===key(identity)&&item.status!=='FAILED');if(existing)return existing;
  const now=new Date().toISOString();const execution={ci_execution_id:`ci-run-${Date.now()}-${++ciSequence}`,delivery_context_id:input.deliveryContextId,repository:input.repository,pr_number:input.prNumber,head_sha:input.headSha,ci_provider:input.provider,status:'RUNNING' as const,created_at:now};store.executions.push(execution);return execution;
}
export function completeAutomaticCi(execution:CiExecution,store:CiRequestStore,result:{status:string;conclusion:string;workflow:string;failureReason?:string;ci_run_id?:string}){
  execution.status=result.status==='FAILED'?'FAILED':'COMPLETED';execution.completed_at=new Date().toISOString();if(execution.status==='FAILED')execution.failure_reason=result.failureReason??'CI_PROVIDER_FAILED';
  if(execution.status==='COMPLETED')store.ci=dedupeCiEvidence([...store.ci,{ci_run_id:result.ci_run_id??execution.ci_execution_id,repository:execution.repository,pr_number:execution.pr_number,head_sha:execution.head_sha,provider:execution.ci_provider,workflow:result.workflow,status:'COMPLETED',conclusion:result.conclusion,started_at:execution.created_at,completed_at:execution.completed_at}]);return store.ci;
}
export function projectAutomaticCi(execution:CiExecution|null,currentHead:string,store:CiRequestStore){if(!execution)return null;return projectExactHeadValidation({repository:execution.repository,pr_number:execution.pr_number,head_sha:currentHead},[],store.ci).ci;}
