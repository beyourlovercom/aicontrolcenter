import {
  createEmptyGlobalStateReadModel,
  planExactProjectionInvalidation,
  projectGlobalStateReadModel,
  type AiccGlobalStateReadModel,
  type CanonicalEntityIdentity,
  type ExactInvalidationPlan,
  type GlobalStateProjectionCandidate,
  type SourceEntityIdentity
} from './globalStateReadModel.ts';

/** Phase 7: Layer 2 is a rebuildable read model, never a canonical writer. */
export const CACHE_AUTHORITY='NONE' as const;
export const POLLING_AUTHORITY='NONE' as const;
export const NOTIFICATION_AUTHORITY='NONE' as const;
export const STATE_RECOVERY_REEXECUTION_AUTHORITY=0 as const;
export const LAYER2_CANONICAL_WRITE=false as const;
export const RECONCILIATION_FAILURE_INFERENCE=0 as const;

export type CanonicalProjectionSnapshot=Readonly<{
  /** Monotonic Layer 1 snapshot revision; intentionally distinct from Layer 2 revision. */
  canonicalRevision:number;
  candidate:GlobalStateProjectionCandidate;
  projectedAt?:string;
}>;

export type Layer2ChangeNotification=Readonly<{
  canonicalRevision:number;
  globalProjectionRevision:number;
  model:AiccGlobalStateReadModel;
}>;

export type ExactPropagationPlan=Readonly<{
  sourceEntity:SourceEntityIdentity;
  direct:ExactInvalidationPlan;
  dependentEntities:readonly CanonicalEntityIdentity[];
}>;

export type GlobalStateConsistencyCoordinator=Readonly<{
  invalidate(sourceEntity?:SourceEntityIdentity):Promise<AiccGlobalStateReadModel>;
  reconcile():Promise<AiccGlobalStateReadModel>;
  current():AiccGlobalStateReadModel;
  canonicalRevision():number;
  subscribe(listener:(change:Layer2ChangeNotification)=>void):()=>void;
  plan(sourceEntity:SourceEntityIdentity):ExactPropagationPlan;
}>;

export type Layer2ChangeNotifier=Readonly<{
  publish(model:AiccGlobalStateReadModel):boolean;
  subscribe(listener:(change:Layer2ChangeNotification)=>void):()=>void;
}>;

const identityKey=(identity:CanonicalEntityIdentity)=>`${identity.projectId}:${identity.repositoryIdentity}:${identity.kind}:${identity.id}`;
const sourceKey=(source:SourceEntityIdentity)=>`${source.projectId}:${source.repositoryIdentity}:${source.domain}:${source.id}`;
const sameIdentity=(left:CanonicalEntityIdentity,right:CanonicalEntityIdentity)=>left.projectId===right.projectId&&left.repositoryIdentity===right.repositoryIdentity&&left.kind===right.kind&&left.id===right.id;
const cloneIdentity=(identity:CanonicalEntityIdentity):CanonicalEntityIdentity=>({...identity});

function assertCanonicalRevision(value:number):number{
  if(!Number.isSafeInteger(value)||value<0)throw new Error('CANONICAL_REVISION_INVALID');
  return value;
}

/**
 * Traverses only explicit bindings. It has no latest/selected/UI fallback and
 * therefore cannot make an unrelated entity eligible for invalidation.
 */
export function planExactCanonicalPropagation(model:AiccGlobalStateReadModel,sourceEntity:SourceEntityIdentity):ExactPropagationPlan{
  const direct=planExactProjectionInvalidation(model,sourceEntity);
  const roots=new Map<string,CanonicalEntityIdentity>();
  for(const entity of model.entities)if(entity.dimensions.some(dimension=>sourceKey(dimension.provenance.sourceEntity)===sourceKey(sourceEntity)))roots.set(identityKey(entity.identity),entity.identity);
  for(const binding of model.bindings)if(sourceKey(binding.provenance.sourceEntity)===sourceKey(sourceEntity)){roots.set(identityKey(binding.from),binding.from);roots.set(identityKey(binding.to),binding.to);}
  const adjacency=new Map<string,CanonicalEntityIdentity[]>();
  const connect=(left:CanonicalEntityIdentity,right:CanonicalEntityIdentity)=>{const key=identityKey(left),items=adjacency.get(key)??[];if(!items.some(item=>sameIdentity(item,right)))items.push(right);adjacency.set(key,items);};
  for(const binding of model.bindings){connect(binding.from,binding.to);connect(binding.to,binding.from);}
  const pending=[...roots.values()],visited=new Map<string,CanonicalEntityIdentity>();
  while(pending.length){const current=pending.shift()!,key=identityKey(current);if(visited.has(key))continue;visited.set(key,current);for(const next of adjacency.get(key)??[])if(!visited.has(identityKey(next)))pending.push(next);}
  return Object.freeze({sourceEntity:Object.freeze({...sourceEntity}),direct,dependentEntities:Object.freeze([...visited.values()].map(cloneIdentity).sort((left,right)=>identityKey(left).localeCompare(identityKey(right))))});
}

/**
 * Drains requested generations. An invalidation arriving during an async read
 * increments requestedGeneration, so the loop always performs a later read.
 * The accepted Layer 1 revision is monotonic; a stale snapshot is ignored.
 */
export function createGlobalStateConsistencyCoordinator(readCanonical:()=>Promise<CanonicalProjectionSnapshot>|CanonicalProjectionSnapshot,initial:AiccGlobalStateReadModel):GlobalStateConsistencyCoordinator{
  let model=initial,acceptedCanonicalRevision=-1,requestedGeneration=0,completedGeneration=0;
  let inFlight:Promise<AiccGlobalStateReadModel>|null=null;
  const listeners=new Set<(change:Layer2ChangeNotification)=>void>();
  const notify=()=>{const change=Object.freeze({canonicalRevision:acceptedCanonicalRevision,globalProjectionRevision:model.globalProjectionRevision,model});for(const listener of listeners)listener(change);};
  const drain=async()=>{
    while(completedGeneration<requestedGeneration){
      const generation=requestedGeneration;
      const snapshot=await readCanonical();
      const canonicalRevision=assertCanonicalRevision(snapshot.canonicalRevision);
      if(canonicalRevision>=acceptedCanonicalRevision){
        const next=projectGlobalStateReadModel(model,snapshot.candidate,snapshot.projectedAt);
        const changed=next!==model;
        model=next;
        acceptedCanonicalRevision=canonicalRevision;
        if(changed)notify();
      }
      completedGeneration=generation;
    }
    return model;
  };
  const request=()=>{
    requestedGeneration+=1;
    if(!inFlight)inFlight=drain().finally(()=>{inFlight=null;});
    return inFlight;
  };
  return Object.freeze({
    invalidate:(_sourceEntity?:SourceEntityIdentity)=>request(),
    reconcile:()=>request(),
    current:()=>model,
    canonicalRevision:()=>acceptedCanonicalRevision,
    subscribe:(listener:(change:Layer2ChangeNotification)=>void)=>{listeners.add(listener);return ()=>listeners.delete(listener);},
    plan:(sourceEntity:SourceEntityIdentity)=>planExactCanonicalPropagation(model,sourceEntity)
  });
}

/** A Layer 3 notification bridge; it accepts only already-projected Layer 2 snapshots. */
export function createLayer2ChangeNotifier():Layer2ChangeNotifier{
  let latestRevision=-1;
  const listeners=new Set<(change:Layer2ChangeNotification)=>void>();
  return Object.freeze({
    publish:(model:AiccGlobalStateReadModel)=>{
      if(model.globalProjectionRevision<=latestRevision)return false;
      latestRevision=model.globalProjectionRevision;
      const change=Object.freeze({canonicalRevision:-1,globalProjectionRevision:model.globalProjectionRevision,model});
      for(const listener of listeners)listener(change);
      return true;
    },
    subscribe:(listener:(change:Layer2ChangeNotification)=>void)=>{listeners.add(listener);return ()=>listeners.delete(listener);}
  });
}
