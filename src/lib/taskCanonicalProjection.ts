import {
  availableSourceRevision,
  dimensionProjection,
  entityIdentity,
  explicitBinding,
  knownDimensionValue,
  projectGlobalStateReadModel,
  projectionSource,
  sourceEntityIdentity,
  unknownDimensionValue,
  type AiccGlobalStateReadModel
} from './globalStateReadModel.ts';
import type {ProjectIdentityScope} from './projectEntityScope.ts';

export type TaskLifecycleProjectionInput=Readonly<{taskId:string;status:string;executionId?:string;runId?:string}>;
export type TaskRunLifecycleProjectionInput=Readonly<{runId:string;phase?:string}>;

/** Browser-safe Phase 2 adapter: Layer 1 values enter only here, never in a UI renderer. */
export function projectTaskLayer2ReadModel(previous:AiccGlobalStateReadModel,records:readonly TaskLifecycleProjectionInput[],runtimes:readonly TaskRunLifecycleProjectionInput[],scope:ProjectIdentityScope):AiccGlobalStateReadModel{
  const runtimeByRun=new Map(runtimes.filter(runtime=>runtime?.runId).map(runtime=>[runtime.runId,runtime]));
  const entities:any[]=[],bindings:any[]=[],seenEntities=new Set<string>(),seenBindings=new Set<string>();
  const addEntity=(identity:any,dimensions:any[])=>{const key=`${identity.kind}:${identity.id}`;if(!seenEntities.has(key)){seenEntities.add(key);entities.push({identity,dimensions})}};
  const addBinding=(binding:any)=>{const key=`${binding.kind}:${binding.from.kind}:${binding.from.id}>${binding.to.kind}:${binding.to.id}`;if(!seenBindings.has(key)){seenBindings.add(key);bindings.push(binding)}};
  for(const record of records){
    if(typeof record.taskId!=='string'||!record.taskId.trim())continue;
    const source=projectionSource(sourceEntityIdentity(scope,'TASK',record.taskId),availableSourceRevision(JSON.stringify(record)));
    const task=entityIdentity(scope,'TASK',record.taskId);
    addEntity(task,[dimensionProjection('task.lifecycle',typeof record.status==='string'&&record.status.trim()?knownDimensionValue('task.lifecycle',record.status):unknownDimensionValue('task.lifecycle'),source)]);
    if(record.executionId){
      const execution=entityIdentity(scope,'EXECUTION',record.executionId);
      addEntity(execution,[dimensionProjection('execution.lifecycle',unknownDimensionValue('execution.lifecycle'),source)]);
      addBinding(explicitBinding('TASK_TO_EXECUTION',task,execution,source));
      if(record.runId){
        const runtime=runtimeByRun.get(record.runId),run=entityIdentity(scope,'RUN',record.runId);
        const runSource=projectionSource(sourceEntityIdentity(scope,'RUN',record.runId),runtime?availableSourceRevision(JSON.stringify(runtime)):{availability:'UNAVAILABLE'});
        addEntity(run,[dimensionProjection('run.lifecycle',runtime?.phase?knownDimensionValue('run.lifecycle',runtime.phase):unknownDimensionValue('run.lifecycle'),runSource)]);
        addBinding(explicitBinding('EXECUTION_TO_RUN',execution,run,source));
      }
    }
  }
  return projectGlobalStateReadModel(previous,{entities,bindings});
}
