import type {CanonicalExecutionResult,RuntimeRecord} from './model/entityTypes.ts';

export type TaskResultProjectionState='RESULT_AVAILABLE'|'NOT_AVAILABLE';
export type TaskResultProjection={
  taskId:string;executionId:string|null;runId:string|null;status:string;
  state:TaskResultProjectionState;result:CanonicalExecutionResult|null;
  resultId:string|null;resultHash:string|null;source:'PROJECT_TASK_REGISTRY'|'NONE';
};

type TaskRunRecord={runId?:string;executionId?:string;canonicalResult?:CanonicalExecutionResult};
type TaskRecord={
  taskId?:string;id?:string;executionId?:string;runId?:string;latestRunId?:string;
  status?:string;runtimeState?:string;terminalState?:string;state?:string;
  projectId?:string;repositoryIdentity?:string;canonicalResult?:CanonicalExecutionResult;
  runs?:TaskRunRecord[];
};
type OutboxRecord={executionId?:string;runId?:string;report?:{canonicalResult?:CanonicalExecutionResult}};

export function canonicalTaskResultForRun(task:TaskRecord,runId:string):CanonicalExecutionResult|null{
  const executionId=task.executionId??runId;
  const run=task.runs?.find(item=>item?.runId===runId)??null;
  const result=run?.canonicalResult??((task.latestRunId??task.runId)===runId?task.canonicalResult:undefined)??null;
  if(!result)return null;
  const expectedExecutionId=run?.executionId??executionId??runId;
  if(result.executionId!==expectedExecutionId||result.executionId!==runId)return null;
  if(!task.projectId||!task.repositoryIdentity)return null;
  if(result.projectId!==task.projectId||result.repositoryIdentity!==task.repositoryIdentity)return null;
  return result;
}

/** Result authority is the persisted Project Task Registry only. Runtime/Outbox args remain compatibility inputs and are intentionally ignored. */
export function projectTaskResult(args:{task:TaskRecord|null;runtime?:RuntimeRecord|null;outbox?:OutboxRecord[];reconciliationPending?:boolean}):TaskResultProjection{
  const task=args.task,taskId=task?.taskId??task?.id??'UNKNOWN_TASK';
  const runId=task?.latestRunId??task?.runId??task?.executionId??null;
  const executionId=task?.executionId??runId;
  const status=String(task?.status??task?.runtimeState??task?.terminalState??task?.state??'UNKNOWN').toUpperCase();
  if(!task||!runId)return {taskId,executionId,runId,status,state:'NOT_AVAILABLE',result:null,resultId:null,resultHash:null,source:'NONE'};
  const result=canonicalTaskResultForRun(task,runId);
  return result
    ? {taskId,executionId,runId,status,state:'RESULT_AVAILABLE',result,resultId:result.resultId,resultHash:result.resultHash,source:'PROJECT_TASK_REGISTRY'}
    : {taskId,executionId,runId,status,state:'NOT_AVAILABLE',result:null,resultId:null,resultHash:null,source:'NONE'};
}

export function taskResultNeedsReconciliation(projection:TaskResultProjection){return Boolean(projection.runId&&!projection.result&&projection.state==='NOT_AVAILABLE')}
