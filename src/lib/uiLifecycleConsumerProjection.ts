import {
  createEmptyGlobalStateReadModel,
  dimensionProjection,
  explicitBinding,
  queryGlobalStateForProject,
  type AiccGlobalStateReadModel,
  type BindingKind,
  type CanonicalEntityIdentity,
  type DimensionValue,
  type EntityKind,
  type LifecycleDimension
  ,type GlobalStateProjectCollections
} from './globalStateReadModel.ts';

export const UI_STATE_READ_AUTHORITY='AICC_GLOBAL_STATE_READ_MODEL' as const;
export const UI_DIRECT_DOMAIN_STATE_DERIVATION='FORBIDDEN' as const;
export const DUPLICATE_UI_STATUS_RESOLVER='FORBIDDEN' as const;
export const UI_LOCAL_LIFECYCLE_AUTHORITY=0 as const;
export const DISPLAY_FORMATTING_AUTHORITY='PRESENTATION_ONLY' as const;
export const SEMANTIC_STATUS_DERIVATION_IN_UI='ABSENT' as const;
export const APP_SVELTE_STATE_AUTHORITY='ROUTING_AND_PRESENTATION_ONLY' as const;
export const APP_SVELTE_LIFECYCLE_INFERENCE=0 as const;
export const EVIDENCE_RENDERING_AUTHORITY='DISPLAY_ONLY' as const;
export const UI_UNKNOWN_PRESERVATION=true as const;

type Layer2Fragment=Pick<AiccGlobalStateReadModel,'entities'|'bindings'>;
type LifecycleIdentity=Extract<EntityKind,'MILESTONE'|'WORK_PACKAGE'|'PULL_REQUEST'|'TASK'|'EXECUTION'|'RUN'|'RESULT'|'FEEDBACK'|'CONTROL_LOOP'|'HUMAN_UAT'>;

const identityKey=(identity:CanonicalEntityIdentity)=>`${identity.kind}:${identity.id}`;
const bindingKey=(kind:BindingKind,from:CanonicalEntityIdentity,to:CanonicalEntityIdentity)=>`${kind}:${identityKey(from)}>${identityKey(to)}`;

/**
 * Combines independent Layer 2 adapters into the single browser-facing read
 * model. Later fragments only replace the same projected dimension; no UI
 * source is allowed to supply a new lifecycle value.
 */
export function composeUiLifecycleReadModel(previous:AiccGlobalStateReadModel=createEmptyGlobalStateReadModel(),fragments:readonly Layer2Fragment[],scope?:{projectId:string;repositoryIdentity:string;projectContextRevision:number},collections:GlobalStateProjectCollections={}):AiccGlobalStateReadModel{
  const dimensions=new Map<string,{identity:CanonicalEntityIdentity;fields:Map<LifecycleDimension,any>}>();
  const bindings=new Map<string,any>();
  for(const fragment of fragments){
    for(const entity of fragment.entities){
      const key=identityKey(entity.identity),target=dimensions.get(key)??{identity:entity.identity,fields:new Map<LifecycleDimension,any>()};
      for(const field of entity.dimensions)target.fields.set(field.dimension,field);
      dimensions.set(key,target);
    }
    for(const binding of fragment.bindings){
      const key=bindingKey(binding.kind,binding.from,binding.to);
      if(!bindings.has(key))bindings.set(key,binding);
    }
  }
  const candidate={
    entities:[...dimensions.values()].map(entry=>({identity:entry.identity,dimensions:[...entry.fields.values()].map(field=>dimensionProjection(field.dimension,field.projectedValue,field.provenance))})),
    bindings:[...bindings.values()].map(binding=>explicitBinding(binding.kind,binding.from,binding.to,binding.provenance))
  };
  return scope?queryGlobalStateForProject(scope,candidate,previous,undefined,collections):queryGlobalStateForProject({projectId:previous.projectId,repositoryIdentity:previous.repositoryIdentity,projectContextRevision:previous.projectContextRevision},candidate,previous,undefined,collections);
}

export function projectedLifecycle<D extends LifecycleDimension>(model:AiccGlobalStateReadModel,kind:LifecycleIdentity,id:string,dimension:D):DimensionValue<D>{
  const entity=model.entities.find(candidate=>candidate.identity.kind===kind&&candidate.identity.id===id);
  const field=entity?.dimensions.find(candidate=>candidate.dimension===dimension);
  return (field?.projectedValue??{state:'UNKNOWN',dimension}) as DimensionValue<D>;
}

export function projectedLifecycleText<D extends LifecycleDimension>(model:AiccGlobalStateReadModel,kind:LifecycleIdentity,id:string,dimension:D):string{
  const value=projectedLifecycle(model,kind,id,dimension);
  return value.state==='KNOWN'?value.value:'UNKNOWN';
}

/** Task records remain identity/evidence carriers; their displayed status comes only from the composed Layer 2 model. */
export function projectTaskUiRecords<T extends Record<string,any>>(model:AiccGlobalStateReadModel,tasks:readonly T[]):T[]{
  return tasks.map(task=>{
    const taskId=typeof task.taskId==='string'?task.taskId:'';
    return {...task,status:taskId?projectedLifecycleText(model,'TASK',taskId,'task.lifecycle'):'UNKNOWN',lifecycleSource:UI_STATE_READ_AUTHORITY} as T;
  });
}

/** A presentation-only map for existing status-dot components. */
export type UiPresentationStatus='NOT_STARTED'|'IN_PROGRESS'|'WAITING_UAT'|'WAITING_OWNER'|'PASS'|'BLOCKED'|'FAILED'|'UNKNOWN';
export function presentationStatus(value:string):UiPresentationStatus{
  const state=String(value).toUpperCase();
  if(['COMPLETED','COMPLETE','MERGED','PASS'].includes(state))return 'PASS';
  if(['FAILED','ERROR'].includes(state))return 'FAILED';
  if(['BLOCKED','CLOSED','STOPPED','CANCELLED','RECOVERY_REQUIRED','NEEDS_REMEDIATION'].includes(state))return 'BLOCKED';
  if(['WAITING_UAT'].includes(state))return 'WAITING_UAT';
  if(['WAITING_OWNER'].includes(state))return 'WAITING_OWNER';
  if(['STARTING','RUNNING','STOPPING','OPEN','DRAFT','IN_PROGRESS','SUBMITTING'].includes(state))return 'IN_PROGRESS';
  return 'UNKNOWN';
}
