import {
  availableSourceRevision,
  createEmptyGlobalStateReadModel,
  dimensionProjection,
  entityIdentity,
  explicitBinding,
  knownDimensionValue,
  projectGlobalStateReadModel,
  projectionSource,
  sourceEntityIdentity,
  unknownDimensionValue,
  type AiccGlobalStateReadModel,
  type DimensionValue,
  type ExplicitBindingInput,
  type GlobalStateProjectionCandidate,
  type LifecycleDimension,
  type ProjectionSourceEvidence,
  type SourceDomain
} from './globalStateReadModel.ts';
import type {CanonicalExecutionResult,RuntimeRecord} from './model/entityTypes.ts';

export const RUNTIME_SUMMARY_STATE_SOURCE='GLOBAL_STATE_READ_MODEL' as const;
export const RUNTIME_MONITOR_STATE_SOURCE='GLOBAL_STATE_READ_MODEL' as const;
export const GLOBAL_FEEDBACK_ISLAND_STATE_SOURCE='GLOBAL_STATE_READ_MODEL' as const;
export const GLOBAL_FEEDBACK_ISLAND_WRITE_AUTHORITY='NONE' as const;
export const PHASE5_UI_LOCAL_STATUS_AUTHORITY=false as const;
export const PHASE5_LATEST_RUN_FALLBACK=false as const;
export const PHASE5_SELECTED_RUN_FALLBACK=false as const;

export type TaskLifecycleInput=Readonly<{
  taskId:string;
  lifecycle?:string|null;
  executionId?:string|null;
  runId?:string|null;
  updatedAt?:string|null;
}>;

export type ExecutionLifecycleInput=Readonly<{
  executionId:string;
  lifecycle?:string|null;
  taskId?:string|null;
  runId?:string|null;
  revision?:string|null;
  provenance?:SourceDomain;
}>;

export type ResultLifecycleInput=Readonly<{
  result:CanonicalExecutionResult;
  runId?:string|null;
  revision?:string|null;
}>;

export type FeedbackLifecycleInput=Readonly<{
  feedback_id:string;
  lifecycle?:string|null;
  delivery_status?:string|null;
  control_loop_id:string;
  conversation_id:string;
  binding_epoch?:number;
  expected_gpt_turn_id?:string;
  execution_id:string;
  run_id:string;
  result_id:string;
  result_hash:string;
  updated_at?:string;
  failure_reason?:string;
}>;

export type ControlLoopLifecycleInput=Readonly<{
  control_loop_id:string;
  conversation_id:string;
  binding_epoch:number;
  control_loop_status?:string|null;
  execution_status?:string|null;
  feedback_delivery_status?:string|null;
  execution_id?:string|null;
  run_id?:string|null;
  expected_gpt_turn_id?:string;
  updated_at?:string;
}>;

export type Phase5ProjectionInput=Readonly<{
  runs?:readonly RuntimeRecord[];
  tasks?:readonly TaskLifecycleInput[];
  executions?:readonly ExecutionLifecycleInput[];
  results?:readonly ResultLifecycleInput[];
  feedback?:readonly FeedbackLifecycleInput[];
  controlLoops?:readonly ControlLoopLifecycleInput[];
}>;

export type RunLayer2Record=Readonly<{
  runId:string;
  lifecycle:DimensionValue<'run.lifecycle'>;
  executionId:string|null;
  taskId:string|null;
  processFacts:Readonly<{
    pid:number|null;
    pidAlive:boolean|null;
    processAlive:boolean|null;
    processExitObserved:boolean|null;
    processCloseObserved:boolean|null;
    exitCode:number|null;
    signal:string|null;
  }>;
  startedAt:string|null;
  completedAt:string|null;
  failure:string|null;
  canonical:RuntimeRecord|null;
  entityProjectionRevision:number;
}>;

export type ExecutionLayer2Record=Readonly<{
  executionId:string;
  lifecycle:DimensionValue<'execution.lifecycle'>;
  taskId:string|null;
  runId:string|null;
  entityProjectionRevision:number;
}>;

export type ResultLayer2Record=Readonly<{
  resultId:string;
  availability:DimensionValue<'result.availability'>;
  resultHash:string|null;
  executionId:string|null;
  runId:string|null;
  canonical:CanonicalExecutionResult|null;
  entityProjectionRevision:number;
}>;

export type FeedbackLayer2Record=Readonly<{
  feedbackId:string;
  lifecycle:DimensionValue<'feedback.lifecycle'>;
  delivery:DimensionValue<'feedback.delivery'>;
  controlLoopId:string;
  conversationId:string;
  bindingEpoch:number|null;
  expectedFeedbackTurnId:string|null;
  executionId:string;
  runId:string;
  resultId:string;
  resultHash:string;
  failureReason:string|null;
  entityProjectionRevision:number;
}>;

export type ControlLoopLayer2Record=Readonly<{
  controlLoopId:string;
  lifecycle:DimensionValue<'controlLoop.lifecycle'>;
  bindingEpoch:number;
  conversationId:string;
  executionStatus:string|null;
  feedbackDeliveryStatus:string|null;
  executionId:string|null;
  runId:string|null;
  expectedFeedbackTurnId:string|null;
  entityProjectionRevision:number;
}>;

export type Phase5LifecycleProjection=Readonly<{
  model:AiccGlobalStateReadModel;
  runs:readonly RunLayer2Record[];
  executions:readonly ExecutionLayer2Record[];
  results:readonly ResultLayer2Record[];
  feedback:readonly FeedbackLayer2Record[];
  controlLoops:readonly ControlLoopLayer2Record[];
}>;

const text=(value:unknown):string|null=>typeof value==='string'&&value.trim()?value.trim():null;
const stable=(value:unknown):string=>JSON.stringify(value)??'UNAVAILABLE';
const source=(domain:SourceDomain,id:string,value:unknown):ProjectionSourceEvidence=>
  projectionSource(sourceEntityIdentity(domain,id),availableSourceRevision(stable(value)));
const dimension=<D extends 'task.lifecycle'|'execution.lifecycle'|'run.lifecycle'|'feedback.lifecycle'|'feedback.delivery'|'controlLoop.lifecycle'>(name:D,value:string|null,authority:ProjectionSourceEvidence)=>
  dimensionProjection(name,value?knownDimensionValue(name,value):unknownDimensionValue(name),authority);
const revision=(model:AiccGlobalStateReadModel,kind:'RUN'|'EXECUTION'|'RESULT'|'FEEDBACK'|'CONTROL_LOOP',id:string)=>
  model.entityRevisions.find(item=>item.identity.kind===kind&&item.identity.id===id)?.projectionRevision??0;
function projectedDimension<D extends LifecycleDimension>(model:AiccGlobalStateReadModel,kind:'TASK'|'RUN'|'EXECUTION'|'RESULT'|'FEEDBACK'|'CONTROL_LOOP',id:string,name:D):DimensionValue<D>{
  const value=model.entities.find(item=>item.identity.kind===kind&&item.identity.id===id)?.dimensions.find(item=>item.dimension===name)?.projectedValue;
  return value?.state==='KNOWN'&&value.dimension===name?knownDimensionValue(name,value.value):unknownDimensionValue(name);
}

function uniqueById<T>(items:readonly T[],id:(item:T)=>string):T[]{
  const values=new Map<string,T>();
  for(const item of items){const key=text(id(item));if(key)values.set(key,item)}
  return [...values.values()].sort((left,right)=>id(left).localeCompare(id(right)));
}

function addBinding(bindings:Map<string,ExplicitBindingInput>,binding:ExplicitBindingInput):void{
  const key=`${binding.kind}:${binding.from.kind}:${binding.from.id}>${binding.to.kind}:${binding.to.id}`;
  const previous=bindings.get(key);
  if(!previous||stable(previous.source)===stable(binding.source))bindings.set(key,binding);
}
function one(values:readonly string[]):string|null{
  const unique=[...new Set(values.filter(Boolean))];
  return unique.length===1?unique[0]!:null;
}

/**
 * Phase 5 Layer 2 projection. Every lifecycle value comes from its own
 * canonical record; explicit cross-record identities create bindings only.
 */
export function projectPhase5Lifecycle(
  previous:AiccGlobalStateReadModel=createEmptyGlobalStateReadModel(),
  input:Phase5ProjectionInput={}
):Phase5LifecycleProjection{
  const runtimes=uniqueById(input.runs??[],item=>item.runId);
  const tasks=uniqueById(input.tasks??[],item=>item.taskId);
  const explicitExecutions=uniqueById(input.executions??[],item=>item.executionId);
  const loops=uniqueById(input.controlLoops??[],item=>item.control_loop_id);
  const feedback=uniqueById(input.feedback??[],item=>item.feedback_id);
  const resultInputs:ResultLifecycleInput[]=[...(input.results??[])];
  for(const runtime of runtimes)if(runtime.canonicalResult)resultInputs.push({result:runtime.canonicalResult,runId:runtime.runId});
  const results=uniqueById(resultInputs,item=>item.result.resultId);

  const executionIds=new Set<string>();
  const runIds=new Set(runtimes.map(item=>item.runId));
  const resultIds=new Set(results.map(item=>item.result.resultId));
  for(const item of explicitExecutions)executionIds.add(item.executionId);
  for(const task of tasks){if(text(task.executionId))executionIds.add(task.executionId!);if(text(task.runId))runIds.add(task.runId!)}
  for(const item of results){executionIds.add(item.result.executionId);if(text(item.runId))runIds.add(item.runId!)}
  for(const loop of loops){if(text(loop.execution_id))executionIds.add(loop.execution_id!);if(text(loop.run_id))runIds.add(loop.run_id!)}
  for(const item of feedback){executionIds.add(item.execution_id);runIds.add(item.run_id);resultIds.add(item.result_id)}

  const runtimeById=new Map(runtimes.map(item=>[item.runId,item]));
  const taskByExecution=new Map<string,TaskLifecycleInput>();
  for(const task of tasks)if(text(task.executionId))taskByExecution.set(task.executionId!,task);
  const loopByExecution=new Map(loops.filter(item=>text(item.execution_id)).map(item=>[item.execution_id!,item]));
  const explicitExecutionById=new Map(explicitExecutions.map(item=>[item.executionId,item]));
  const resultById=new Map(results.map(item=>[item.result.resultId,item]));
  const feedbackById=new Map(feedback.map(item=>[item.feedback_id,item]));
  const loopById=new Map(loops.map(item=>[item.control_loop_id,item]));
  const bindings=new Map<string,ExplicitBindingInput>();

  for(const task of tasks){
    const taskSource=source('TASK',task.taskId,task);
    if(text(task.executionId))addBinding(bindings,explicitBinding('TASK_TO_EXECUTION',entityIdentity('TASK',task.taskId),entityIdentity('EXECUTION',task.executionId!),taskSource));
    if(text(task.executionId)&&text(task.runId))addBinding(bindings,explicitBinding('EXECUTION_TO_RUN',entityIdentity('EXECUTION',task.executionId!),entityIdentity('RUN',task.runId!),taskSource));
  }
  for(const execution of explicitExecutions){
    const executionSource=source(execution.provenance??'EXECUTION',execution.executionId,{...execution,revision:execution.revision??null});
    if(text(execution.taskId))addBinding(bindings,explicitBinding('TASK_TO_EXECUTION',entityIdentity('TASK',execution.taskId!),entityIdentity('EXECUTION',execution.executionId),executionSource));
    if(text(execution.runId))addBinding(bindings,explicitBinding('EXECUTION_TO_RUN',entityIdentity('EXECUTION',execution.executionId),entityIdentity('RUN',execution.runId!),executionSource));
  }
  for(const item of results){
    const resultSource=source('RESULT',item.result.resultId,{result:item.result,revision:item.revision??null,runId:item.runId??null});
    if(text(item.runId)){
      addBinding(bindings,explicitBinding('RUN_TO_RESULT',entityIdentity('RUN',item.runId!),entityIdentity('RESULT',item.result.resultId),resultSource));
      addBinding(bindings,explicitBinding('EXECUTION_TO_RUN',entityIdentity('EXECUTION',item.result.executionId),entityIdentity('RUN',item.runId!),resultSource));
    }
  }
  for(const loop of loops){
    const loopSource=source('CONTROL_LOOP',loop.control_loop_id,loop);
    if(text(loop.execution_id))addBinding(bindings,explicitBinding('EXECUTION_TO_CONTROL_LOOP',entityIdentity('EXECUTION',loop.execution_id!),entityIdentity('CONTROL_LOOP',loop.control_loop_id),loopSource));
    if(text(loop.run_id))addBinding(bindings,explicitBinding('CONTROL_LOOP_TO_RUN',entityIdentity('CONTROL_LOOP',loop.control_loop_id),entityIdentity('RUN',loop.run_id!),loopSource));
    if(text(loop.execution_id)&&text(loop.run_id))addBinding(bindings,explicitBinding('EXECUTION_TO_RUN',entityIdentity('EXECUTION',loop.execution_id!),entityIdentity('RUN',loop.run_id!),loopSource));
  }
  for(const item of feedback){
    const feedbackSource=source('FEEDBACK',item.feedback_id,item);
    addBinding(bindings,explicitBinding('CONTROL_LOOP_TO_FEEDBACK',entityIdentity('CONTROL_LOOP',item.control_loop_id),entityIdentity('FEEDBACK',item.feedback_id),feedbackSource));
    addBinding(bindings,explicitBinding('RUN_TO_FEEDBACK',entityIdentity('RUN',item.run_id),entityIdentity('FEEDBACK',item.feedback_id),feedbackSource));
    addBinding(bindings,explicitBinding('RESULT_TO_FEEDBACK',entityIdentity('RESULT',item.result_id),entityIdentity('FEEDBACK',item.feedback_id),feedbackSource));
    addBinding(bindings,explicitBinding('EXECUTION_TO_RUN',entityIdentity('EXECUTION',item.execution_id),entityIdentity('RUN',item.run_id),feedbackSource));
  }

  const candidate:GlobalStateProjectionCandidate={
    entities:[
      ...tasks.map(task=>({identity:entityIdentity('TASK',task.taskId),dimensions:[dimension('task.lifecycle',text(task.lifecycle),source('TASK',task.taskId,task))]})),
      ...[...executionIds].sort().map(executionId=>{
        const explicit=explicitExecutionById.get(executionId),loop=loopByExecution.get(executionId),task=taskByExecution.get(executionId);
        const lifecycle=text(explicit?.lifecycle)??text(loop?.execution_status);
        const authority=explicit?source(explicit.provenance??'EXECUTION',executionId,explicit):loop?source('CONTROL_LOOP',loop.control_loop_id,loop):source('EXECUTION',executionId,{taskId:task?.taskId??null,lifecycle:null});
        return {identity:entityIdentity('EXECUTION',executionId),dimensions:[dimension('execution.lifecycle',lifecycle,authority)]};
      }),
      ...[...runIds].sort().map(runId=>{const runtime=runtimeById.get(runId);return {identity:entityIdentity('RUN',runId),dimensions:[dimension('run.lifecycle',text(runtime?.phase),source('RUN',runId,runtime??{runId,lifecycle:null}))]};}),
      ...[...resultIds].sort().map(resultId=>{const item=resultById.get(resultId);const authority=source('RESULT',resultId,item??{resultId,availability:null});return {identity:entityIdentity('RESULT',resultId),dimensions:[dimensionProjection('result.availability',item?knownDimensionValue('result.availability','AVAILABLE'):unknownDimensionValue('result.availability'),authority)]};}),
      ...feedback.map(item=>{
        const loop=loopById.get(item.control_loop_id);
        const exactLoop=loop&&item.binding_epoch===loop.binding_epoch?loop:null;
        const delivery=text(item.delivery_status)??text(exactLoop?.feedback_delivery_status);
        const authority=source('FEEDBACK',item.feedback_id,item);
        return {identity:entityIdentity('FEEDBACK',item.feedback_id),dimensions:[dimension('feedback.lifecycle',text(item.lifecycle),authority),dimension('feedback.delivery',delivery,delivery&&exactLoop?source('CONTROL_LOOP',exactLoop.control_loop_id,exactLoop):authority)]};
      }),
      ...loops.map(loop=>({identity:entityIdentity('CONTROL_LOOP',loop.control_loop_id),dimensions:[dimension('controlLoop.lifecycle',text(loop.control_loop_status),source('CONTROL_LOOP',loop.control_loop_id,loop))]}))
    ],
    bindings:[...bindings.values()]
  };
  const model=projectGlobalStateReadModel(previous,candidate);

  const runRecords:RunLayer2Record[]=[...runIds].sort().map(runId=>{
    const runtime=runtimeById.get(runId)??null;
    const executionId=one(model.bindings.filter(binding=>binding.kind==='EXECUTION_TO_RUN'&&binding.to.id===runId).map(binding=>binding.from.id));
    const taskId=executionId?one(model.bindings.filter(binding=>binding.kind==='TASK_TO_EXECUTION'&&binding.to.id===executionId).map(binding=>binding.from.id)):null;
    return Object.freeze({runId,lifecycle:projectedDimension(model,'RUN',runId,'run.lifecycle'),executionId,taskId,processFacts:Object.freeze({pid:runtime?.pid??null,pidAlive:typeof runtime?.pidAlive==='boolean'?runtime.pidAlive:null,processAlive:typeof runtime?.processAlive==='boolean'?runtime.processAlive:null,processExitObserved:typeof runtime?.processExitObserved==='boolean'?runtime.processExitObserved:null,processCloseObserved:typeof runtime?.processCloseObserved==='boolean'?runtime.processCloseObserved:null,exitCode:typeof runtime?.exitCode==='number'?runtime.exitCode:null,signal:runtime?.processSignal??null}),startedAt:runtime?.startedAt??null,completedAt:runtime?.completedAt??null,failure:runtime?.failure??null,canonical:runtime,entityProjectionRevision:revision(model,'RUN',runId)});
  });
  const executionRecords:ExecutionLayer2Record[]=[...executionIds].sort().map(executionId=>{
    const taskId=one(model.bindings.filter(binding=>binding.kind==='TASK_TO_EXECUTION'&&binding.to.id===executionId).map(binding=>binding.from.id));
    const runId=one(model.bindings.filter(binding=>binding.kind==='EXECUTION_TO_RUN'&&binding.from.id===executionId).map(binding=>binding.to.id));
    return Object.freeze({executionId,lifecycle:projectedDimension(model,'EXECUTION',executionId,'execution.lifecycle'),taskId,runId,entityProjectionRevision:revision(model,'EXECUTION',executionId)});
  });
  const resultRecords:ResultLayer2Record[]=[...resultIds].sort().map(resultId=>{
    const item=resultById.get(resultId)??null;
    return Object.freeze({resultId,availability:projectedDimension(model,'RESULT',resultId,'result.availability'),resultHash:item?.result.resultHash??null,executionId:item?.result.executionId??null,runId:text(item?.runId),canonical:item?.result??null,entityProjectionRevision:revision(model,'RESULT',resultId)});
  });
  const feedbackRecords:FeedbackLayer2Record[]=feedback.map(item=>{
    const bindingEpoch=typeof item.binding_epoch==='number'&&Number.isInteger(item.binding_epoch)?item.binding_epoch:null;
    return Object.freeze({feedbackId:item.feedback_id,lifecycle:projectedDimension(model,'FEEDBACK',item.feedback_id,'feedback.lifecycle'),delivery:projectedDimension(model,'FEEDBACK',item.feedback_id,'feedback.delivery'),controlLoopId:item.control_loop_id,conversationId:item.conversation_id,bindingEpoch,expectedFeedbackTurnId:text(item.expected_gpt_turn_id),executionId:item.execution_id,runId:item.run_id,resultId:item.result_id,resultHash:item.result_hash,failureReason:text(item.failure_reason),entityProjectionRevision:revision(model,'FEEDBACK',item.feedback_id)});
  });
  const controlLoopRecords:ControlLoopLayer2Record[]=loops.map(loop=>{
    return Object.freeze({controlLoopId:loop.control_loop_id,lifecycle:projectedDimension(model,'CONTROL_LOOP',loop.control_loop_id,'controlLoop.lifecycle'),bindingEpoch:loop.binding_epoch,conversationId:loop.conversation_id,executionStatus:text(loop.execution_status),feedbackDeliveryStatus:text(loop.feedback_delivery_status),executionId:text(loop.execution_id),runId:text(loop.run_id),expectedFeedbackTurnId:text(loop.expected_gpt_turn_id),entityProjectionRevision:revision(model,'CONTROL_LOOP',loop.control_loop_id)});
  });
  return Object.freeze({model,runs:Object.freeze(runRecords),executions:Object.freeze(executionRecords),results:Object.freeze(resultRecords),feedback:Object.freeze(feedbackRecords),controlLoops:Object.freeze(controlLoopRecords)});
}

export function exactRunLayer2(projection:Phase5LifecycleProjection,runId:string):RunLayer2Record|null{
  return projection.runs.find(record=>record.runId===runId)??null;
}

export function exactResultForRun(projection:Phase5LifecycleProjection,runId:string):ResultLayer2Record|null{
  const resultId=one(projection.model.bindings.filter(item=>item.kind==='RUN_TO_RESULT'&&item.from.id===runId).map(item=>item.to.id));
  return resultId?projection.results.find(record=>record.resultId===resultId)??null:null;
}
