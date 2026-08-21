import type {CanonicalExecutionResult,RuntimeRecord} from './model/entityTypes.ts';

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

type TaskRecord={taskId?:string;id?:string;executionId?:string;runId?:string;status?:string;runtimeState?:string;terminalState?:string;state?:string;provider?:string;canonicalResult?:CanonicalExecutionResult};
type OutboxRecord={executionId?:string;runId?:string;report?:{executionId?:string;runId?:string;canonicalResult?:CanonicalExecutionResult}};

function exactResult(result:CanonicalExecutionResult|undefined,runId:string|null,executionId:string|null){
  return Boolean(result&&runId&&result.executionId===runId&&(!executionId||executionId===runId));
}

export function projectTaskResult(args:{task:TaskRecord|null;runtime?:RuntimeRecord|null;outbox?:OutboxRecord[];reconciliationPending?:boolean}):TaskResultProjection{
  const task=args.task;
  const taskId=task?.taskId??task?.id??'UNKNOWN_TASK';
  const runId=task?.runId??task?.executionId??null;
  const executionId=task?.executionId??task?.runId??null;
  const status=String(task?.status??task?.runtimeState??task?.terminalState??task?.state??'UNKNOWN').toUpperCase();
  const runtimeResult=args.runtime?.runId===runId&&exactResult(args.runtime.canonicalResult,runId,executionId)?args.runtime.canonicalResult:null;
  const outbox=args.outbox?.find(item=>item.runId===runId&&item.report?.runId===runId&&(!executionId||item.executionId===executionId)&&(!executionId||item.report?.executionId===executionId)&&exactResult(item.report?.canonicalResult,runId,executionId));
  const outboxResult=outbox?.report?.canonicalResult??null;
  const historicalResult=!runtimeResult&&!outboxResult&&exactResult(task?.canonicalResult,runId,executionId)?task?.canonicalResult??null:null;
  const result=runtimeResult??outboxResult??historicalResult;
  const source=result===runtimeResult&&result?'EXACT_RUN_RUNTIME':result===outboxResult&&result?'EXACT_RUN_OUTBOX':result?'TASK_HISTORICAL_FALLBACK':'NONE';
  const state:TaskResultProjectionState=result?'RESULT_AVAILABLE':'NOT_AVAILABLE';
  return {taskId,executionId,runId,status,state,result,resultId:result?.resultId??null,resultHash:result?.resultHash??null,source};
}

export function taskResultNeedsReconciliation(projection:TaskResultProjection){
  return Boolean(projection.runId&&!projection.result&&projection.state==='NOT_AVAILABLE');
}
