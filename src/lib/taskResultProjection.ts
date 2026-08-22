import type {CanonicalExecutionResult,RuntimeRecord} from './model/entityTypes.ts';
import {createEmptyGlobalStateReadModel} from './globalStateReadModel.ts';
import {exactResultForRun,projectPhase5Lifecycle} from './runtimeResultFeedbackControlLoopProjection.ts';

export type TaskResultProjectionState='RESULT_AVAILABLE'|'NOT_AVAILABLE';

export type TaskResultProjection={
  taskId:string;
  executionId:string|null;
  runId:string|null;
  status:string;
  state:TaskResultProjectionState;
  result:CanonicalExecutionResult|null;
  resultId:string|null;
  resultHash:string|null;
  source:'EXACT_RUN_RUNTIME'|'EXACT_RUN_OUTBOX'|'TASK_HISTORICAL_FALLBACK'|'NONE';
};

type TaskRecord={taskId?:string;id?:string;executionId?:string;runId?:string;status?:string;runtimeState?:string;terminalState?:string;state?:string;provider?:string;projectId?:string;repositoryIdentity?:string;canonicalResult?:CanonicalExecutionResult};
type OutboxRecord={executionId?:string;runId?:string;projectId?:string;repositoryIdentity?:string;report?:{executionId?:string;runId?:string;projectId?:string;repositoryIdentity?:string;canonicalResult?:CanonicalExecutionResult}};

type Candidate={result:CanonicalExecutionResult;source:TaskResultProjection['source']};
const scopeKey=(value:{projectId?:string;repositoryIdentity?:string}|null|undefined)=>value?.projectId&&value.repositoryIdentity?`${value.projectId}\u0000${value.repositoryIdentity}`:null;

export function projectTaskResult(args:{task:TaskRecord|null;runtime?:RuntimeRecord|null;outbox?:OutboxRecord[];reconciliationPending?:boolean}):TaskResultProjection{
  const task=args.task;
  const taskId=task?.taskId??task?.id??'UNKNOWN_TASK';
  const runId=task?.runId??task?.executionId??null;
  const executionId=task?.executionId??task?.runId??null;
  const status=String(task?.status??task?.runtimeState??task?.terminalState??task?.state??'UNKNOWN').toUpperCase();
  if(!runId)return {taskId,executionId,runId,status,state:'NOT_AVAILABLE',result:null,resultId:null,resultHash:null,source:'NONE'};

  const candidates:Candidate[]=[];
  if(args.runtime?.runId===runId&&args.runtime.canonicalResult)candidates.push({result:args.runtime.canonicalResult,source:'EXACT_RUN_RUNTIME'});
  for(const item of args.outbox??[]){
    const result=item.report?.canonicalResult;
    if(item.runId===runId&&item.report?.runId===runId&&(!executionId||item.executionId===executionId)&&(!executionId||item.report?.executionId===executionId)&&result)candidates.push({result,source:'EXACT_RUN_OUTBOX'});
  }
  if(task?.canonicalResult)candidates.push({result:task.canonicalResult,source:'TASK_HISTORICAL_FALLBACK'});

  const declaredScope=scopeKey(task)??scopeKey(args.runtime);
  const candidateScopes=[...new Set(candidates.map(item=>scopeKey(item.result)).filter((value):value is string=>Boolean(value)))];
  const selectedScope=declaredScope??(candidateScopes.length===1?candidateScopes[0]!:null);
  if(!selectedScope||candidateScopes.some(scope=>scope!==selectedScope))return {taskId,executionId,runId,status,state:'NOT_AVAILABLE',result:null,resultId:null,resultHash:null,source:'NONE'};
  const [projectId,repositoryIdentity]=selectedScope.split('\u0000');
  const scopedCandidates=candidates.filter(item=>scopeKey(item.result)===selectedScope);
  const runtime=args.runtime&&scopeKey(args.runtime)===selectedScope?args.runtime:null;
  const projection=projectPhase5Lifecycle(createEmptyGlobalStateReadModel({projectId,repositoryIdentity,projectContextRevision:0}),{
    runs:runtime?[runtime]:[],
    results:scopedCandidates.map(item=>({result:item.result,runId}))
  });
  const projected=exactResultForRun(projection,runId)?.canonical??null;
  const source=projected?(scopedCandidates.find(item=>item.result.resultId===projected.resultId)?.source??'NONE'):'NONE';
  const state:TaskResultProjectionState=projected?'RESULT_AVAILABLE':'NOT_AVAILABLE';
  return {taskId,executionId,runId,status,state,result:projected,resultId:projected?.resultId??null,resultHash:projected?.resultHash??null,source};
}

export function taskResultNeedsReconciliation(projection:TaskResultProjection){
  return Boolean(projection.runId&&!projection.result&&projection.state==='NOT_AVAILABLE');
}
