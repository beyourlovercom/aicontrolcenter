import type {RuntimeRecord} from './model/entityTypes.ts';
import {createEmptyGlobalStateReadModel,type GlobalStateProjectContext} from './globalStateReadModel.ts';
import {exactResultForRun,exactRunLayer2,projectPhase5Lifecycle,type Phase5LifecycleProjection,type ResultLayer2Record,type RunLayer2Record} from './runtimeResultFeedbackControlLoopProjection.ts';

export type RuntimeFeedbackProjection={
  state:'RUNNING'|'SUCCESS'|'BLOCKED'|'ERROR';
  title:string;
  message:string;
  code:string;
  terminal:boolean;
};

export function isActiveRuntime(runtime:Pick<RuntimeRecord,'phase'>|null|undefined){
  return Boolean(runtime&&['STARTING','RUNNING','STOPPING'].includes(runtime.phase));
}

function known(value:RunLayer2Record['lifecycle']):string|null{return value.state==='KNOWN'?value.value:null}

/** Global Feedback Island formatting consumes exact Layer 2 dimensions only. */
export function projectRuntimeFeedbackFromLayer2(run:RunLayer2Record,result:ResultLayer2Record|null):RuntimeFeedbackProjection{
  const runtime=run.canonical;
  const phase=known(run.lifecycle);
  const canonicalResult=result?.availability.state==='KNOWN'&&result.availability.value==='AVAILABLE'?result.canonical:null;
  if(!runtime)return {state:'ERROR',title:'Runtime 状态异常',message:'无法确认当前执行状态。',code:'RUNTIME_STATE_UNAVAILABLE',terminal:true};
  if(canonicalResult)return {state:'RUNNING',title:'Codex Result',message:canonicalResult.rawResult,code:'CODEX_RESULT_AVAILABLE',terminal:true};
  if(phase==='STARTING')return {state:'RUNNING',title:'已提交执行',message:runtime.runId,code:'EXECUTION_SENT',terminal:false};
  if(phase==='RUNNING'||phase==='STOPPING')return {state:'RUNNING',title:'正在执行',message:runtime.runId,code:phase==='RUNNING'?'CODEX_RUNNING':'CODEX_STOPPING',terminal:false};
  if(phase&&['COMPLETED','FAILED','STOPPED','RECOVERY_REQUIRED'].includes(phase))return {state:'RUNNING',title:'Codex Result',message:'NOT_AVAILABLE',code:'CODEX_RESULT_NOT_AVAILABLE',terminal:true};
  return {state:'ERROR',title:'Runtime 状态异常',message:runtime.failure??'无法确认当前执行状态。',code:runtime.failure??'RUNTIME_STATE_UNAVAILABLE',terminal:true};
}

export function projectRuntimeFeedbackFromGlobalState(projection:Phase5LifecycleProjection,runId:string):RuntimeFeedbackProjection{
  const run=exactRunLayer2(projection,runId);
  if(!run)return {state:'ERROR',title:'Runtime 状态异常',message:'无法确认当前执行状态。',code:'RUNTIME_STATE_UNAVAILABLE',terminal:true};
  return projectRuntimeFeedbackFromLayer2(run,exactResultForRun(projection,runId));
}

export function projectFeedbackDeliveryFromGlobalState(projection:Phase5LifecycleProjection,feedbackId:string):RuntimeFeedbackProjection|null{
  const record=projection.feedback.find(item=>item.feedbackId===feedbackId);
  const delivery=record?.delivery.state==='KNOWN'?record.delivery.value:null;
  if(!record||!delivery)return null;
  if(delivery==='DELIVERED')return {state:'SUCCESS',title:'执行结果已回传',message:record.expectedFeedbackTurnId??record.feedbackId,code:'FEEDBACK_DELIVERED',terminal:true};
  if(delivery==='DELIVERY_FAILED'||delivery==='CORRELATION_FAILED')return {state:'ERROR',title:'执行结果回传失败',message:record.failureReason??delivery,code:delivery,terminal:true};
  if(['READY','RESOLVING_TARGET','DELIVERING'].includes(delivery))return {state:'RUNNING',title:'正在回传执行结果',message:record.expectedFeedbackTurnId??record.feedbackId,code:`FEEDBACK_${delivery}`,terminal:false};
  return null;
}

export function projectControlLoopFeedbackFromGlobalState(projection:Phase5LifecycleProjection,controlLoopId:string):RuntimeFeedbackProjection|null{
  const record=projection.controlLoops.find(item=>item.controlLoopId===controlLoopId);
  const lifecycle=record?.lifecycle.state==='KNOWN'?record.lifecycle.value:null;
  if(!record||!lifecycle)return null;
  if(lifecycle==='COMPLETE')return {state:'SUCCESS',title:'自动控制循环已完成',message:record.controlLoopId,code:'CONTROL_LOOP_COMPLETE',terminal:true};
  if(lifecycle==='WAITING_OWNER'||lifecycle==='WAITING_OWNER_UAT')return {state:'BLOCKED',title:'自动控制循环等待 Owner',message:record.controlLoopId,code:lifecycle,terminal:false};
  if(lifecycle==='PAUSED'||lifecycle==='BLOCKED'||lifecycle==='FAILED')return {state:lifecycle==='FAILED'?'ERROR':'BLOCKED',title:lifecycle==='PAUSED'?'自动控制循环已暂停':'自动控制循环已阻塞',message:record.controlLoopId,code:`CONTROL_LOOP_${lifecycle}`,terminal:true};
  return {state:'RUNNING',title:'自动控制循环进行中',message:record.controlLoopId,code:`CONTROL_LOOP_${lifecycle}`,terminal:false};
}

/** Projects the exact Run to Layer 2 using an explicit project context. Fails closed if runtime scope does not match context. */
export function projectRuntimeFeedback(runtime:RuntimeRecord,context:GlobalStateProjectContext):RuntimeFeedbackProjection{
  if(runtime.projectId!==context.projectId||runtime.repositoryIdentity!==context.repositoryIdentity)return {state:'ERROR',title:'Runtime 状态异常',message:'项目上下文不匹配，无法确认执行状态。',code:'PROJECT_CONTEXT_MISMATCH',terminal:true};
  const projection=projectPhase5Lifecycle(createEmptyGlobalStateReadModel(context),{runs:[runtime]});
  return projectRuntimeFeedbackFromGlobalState(projection,runtime.runId);
}

export function shouldContinueRuntimePolling(runtime:RuntimeRecord|null,hasPendingInbox:boolean,selectedRunId?:string|null){
  if(hasPendingInbox||isActiveRuntime(runtime))return true;
  return Boolean(runtime&&runtime.runId===selectedRunId&&['COMPLETED','FAILED','STOPPED'].includes(runtime.phase)&&!runtime.canonicalResult);
}
