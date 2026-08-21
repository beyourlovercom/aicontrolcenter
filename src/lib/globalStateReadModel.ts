export const GLOBAL_STATE_READ_MODEL_SCHEMA='aicc.global-state-read-model.v1' as const;
export const GLOBAL_STATE_READ_MODEL_FILE='global-state-read-model.json' as const;
export const GLOBAL_STATE_READ_MODEL_AUTHORITY='READ_ONLY_PROJECTION' as const;
export const GLOBAL_STATE_WRITE_AUTHORITY='NONE' as const;
export const AICC_STATE_INFERENCE_AUTHORITY=0 as const;

export type EntityKind='MILESTONE'|'WORK_PACKAGE'|'PULL_REQUEST'|'TASK'|'EXECUTION'|'RUN'|'RESULT'|'FEEDBACK'|'CONTROL_LOOP'|'HUMAN_UAT';
export type EntityIdentity<K extends EntityKind=EntityKind>=Readonly<{kind:K;id:string}>;
export type CanonicalEntityIdentity=
  |EntityIdentity<'MILESTONE'>
  |EntityIdentity<'WORK_PACKAGE'>
  |EntityIdentity<'PULL_REQUEST'>
  |EntityIdentity<'TASK'>
  |EntityIdentity<'EXECUTION'>
  |EntityIdentity<'RUN'>
  |EntityIdentity<'RESULT'>
  |EntityIdentity<'FEEDBACK'>
  |EntityIdentity<'CONTROL_LOOP'>
  |EntityIdentity<'HUMAN_UAT'>;

export type LifecycleDimension=
  |'milestone.lifecycle'
  |'wp.structure'
  |'wp.lifecycle'
  |'wp.implementation'
  |'wp.validation'
  |'wp.uat'
  |'wp.closure'
  |'wp.progress'
  |'pr.lifecycle'
  |'task.lifecycle'
  |'execution.lifecycle'
  |'run.lifecycle'
  |'result.availability'
  |'feedback.lifecycle'
  |'feedback.delivery'
  |'controlLoop.lifecycle'
  |'humanUat.lifecycle';

export type DimensionValue<D extends LifecycleDimension=LifecycleDimension>=
  |Readonly<{state:'UNKNOWN';dimension:D}>
  |Readonly<{state:'KNOWN';dimension:D;value:string}>;

export type SourceDomain='ROADMAP'|'FORMAL_WORK_PACKAGE'|'LIFECYCLE_EVIDENCE'|'HUMAN_UAT'|'WORK_PACKAGE'|'PULL_REQUEST'|'TASK'|'EXECUTION'|'RUN'|'RESULT'|'FEEDBACK'|'CONTROL_LOOP';
export type SourceEntityIdentity=Readonly<{domain:SourceDomain;id:string}>;
export type SourceRevision=
  |Readonly<{availability:'AVAILABLE';value:string}>
  |Readonly<{availability:'UNAVAILABLE'}>;
export type ProjectionSourceEvidence=Readonly<{
  sourceDomain:SourceDomain;
  sourceEntity:SourceEntityIdentity;
  sourceRevision:SourceRevision;
}>;

export type DimensionProjectionInput<D extends LifecycleDimension=LifecycleDimension>=Readonly<{
  dimension:D;
  projectedValue:DimensionValue<D>;
  source:ProjectionSourceEvidence;
}>;

export type ProjectedDimensionRecord<D extends LifecycleDimension=LifecycleDimension>=Readonly<{
  entityIdentity:CanonicalEntityIdentity;
  dimension:D;
  projectedValue:DimensionValue<D>;
  provenance:ProjectionSourceEvidence&Readonly<{
    projectionRevision:number;
    projectedAt:string;
  }>;
}>;

export type BindingKind=
  |'MILESTONE_TO_WP'
  |'WP_TO_PR'
  |'WP_TO_TASK'
  |'TASK_TO_EXECUTION'
  |'EXECUTION_TO_RUN'
  |'RUN_TO_RESULT'
  |'EXECUTION_TO_CONTROL_LOOP'
  |'CONTROL_LOOP_TO_RUN'
  |'CONTROL_LOOP_TO_FEEDBACK'
  |'RUN_TO_FEEDBACK'
  |'RESULT_TO_FEEDBACK'
  |'WP_TO_HUMAN_UAT'
  |'PR_TO_HUMAN_UAT';
type BindingEndpoints={
  MILESTONE_TO_WP:readonly [EntityIdentity<'MILESTONE'>,EntityIdentity<'WORK_PACKAGE'>];
  WP_TO_PR:readonly [EntityIdentity<'WORK_PACKAGE'>,EntityIdentity<'PULL_REQUEST'>];
  WP_TO_TASK:readonly [EntityIdentity<'WORK_PACKAGE'>,EntityIdentity<'TASK'>];
  TASK_TO_EXECUTION:readonly [EntityIdentity<'TASK'>,EntityIdentity<'EXECUTION'>];
  EXECUTION_TO_RUN:readonly [EntityIdentity<'EXECUTION'>,EntityIdentity<'RUN'>];
  RUN_TO_RESULT:readonly [EntityIdentity<'RUN'>,EntityIdentity<'RESULT'>];
  EXECUTION_TO_CONTROL_LOOP:readonly [EntityIdentity<'EXECUTION'>,EntityIdentity<'CONTROL_LOOP'>];
  CONTROL_LOOP_TO_RUN:readonly [EntityIdentity<'CONTROL_LOOP'>,EntityIdentity<'RUN'>];
  CONTROL_LOOP_TO_FEEDBACK:readonly [EntityIdentity<'CONTROL_LOOP'>,EntityIdentity<'FEEDBACK'>];
  RUN_TO_FEEDBACK:readonly [EntityIdentity<'RUN'>,EntityIdentity<'FEEDBACK'>];
  RESULT_TO_FEEDBACK:readonly [EntityIdentity<'RESULT'>,EntityIdentity<'FEEDBACK'>];
  WP_TO_HUMAN_UAT:readonly [EntityIdentity<'WORK_PACKAGE'>,EntityIdentity<'HUMAN_UAT'>];
  PR_TO_HUMAN_UAT:readonly [EntityIdentity<'PULL_REQUEST'>,EntityIdentity<'HUMAN_UAT'>];
};

export type ExplicitBindingInput<K extends BindingKind=BindingKind>=Readonly<{
  kind:K;
  from:BindingEndpoints[K][0];
  to:BindingEndpoints[K][1];
  source:ProjectionSourceEvidence;
}>;

export type ProjectedBindingRecord<K extends BindingKind=BindingKind>=ExplicitBindingInput<K>&Readonly<{
  provenance:ProjectionSourceEvidence&Readonly<{
    projectionRevision:number;
    projectedAt:string;
  }>;
}>;

export type EntityProjectionInput=Readonly<{
  identity:CanonicalEntityIdentity;
  dimensions:readonly DimensionProjectionInput[];
}>;

export type GlobalStateProjectionCandidate=Readonly<{
  entities:readonly EntityProjectionInput[];
  bindings:readonly ExplicitBindingInput[];
}>;

export type EntityProjectionRecord=Readonly<{
  identity:CanonicalEntityIdentity;
  projectionRevision:number;
  projectedAt:string;
  dimensions:readonly ProjectedDimensionRecord[];
}>;

export type EntityRevisionRecord=Readonly<{
  identity:CanonicalEntityIdentity;
  projectionRevision:number;
}>;

export type AiccGlobalStateReadModel=Readonly<{
  schema:typeof GLOBAL_STATE_READ_MODEL_SCHEMA;
  authority:typeof GLOBAL_STATE_READ_MODEL_AUTHORITY;
  writeAuthority:typeof GLOBAL_STATE_WRITE_AUTHORITY;
  inferenceAuthority:typeof AICC_STATE_INFERENCE_AUTHORITY;
  projectId:string;
  repositoryIdentity:string;
  projectContextRevision:number;
  globalProjectionRevision:number;
  projectedAt:string|null;
  entities:readonly EntityProjectionRecord[];
  entityRevisions:readonly EntityRevisionRecord[];
  bindings:readonly ProjectedBindingRecord[];
  scopedTasks:readonly any[];
  scopedRuntimeHistory:readonly any[];
  scopedResults:readonly any[];
}>;

export type GlobalStateProjectQueryInput=Readonly<{projectId:string;repositoryIdentity:string;projectContextRevision:number}>;
export const GLOBAL_STATE_PROJECT_QUERY_AUTHORITY='GLOBAL_STATE_PROJECT_QUERY_AUTHORITY_V1' as const;
export type GlobalStateProjectCollections=Readonly<{tasks?:readonly any[];runtimeHistory?:readonly any[];results?:readonly any[]}>;

export type Layer1ProjectionFragment=GlobalStateProjectionCandidate;
export interface Layer1ProjectionAdapter {
  readonly domain:SourceDomain;
  readCanonicalProjection():Promise<Layer1ProjectionFragment>|Layer1ProjectionFragment;
}

export type ProjectionDependencyTarget=
  |Readonly<{type:'DIMENSION';entityIdentity:CanonicalEntityIdentity;dimension:LifecycleDimension}>
  |Readonly<{type:'BINDING';kind:BindingKind;from:CanonicalEntityIdentity;to:CanonicalEntityIdentity}>;

export type ExactInvalidationPlan=Readonly<{
  sourceEntity:SourceEntityIdentity;
  dependentProjections:readonly ProjectionDependencyTarget[];
  requiresReprojection:boolean;
}>;

export type BindingResolution<K extends BindingKind=BindingKind>=
  |Readonly<{state:'UNBOUND';bindings:readonly []}>
  |Readonly<{state:'BOUND';bindings:readonly ProjectedBindingRecord<K>[]}>
;

const ENTITY_KINDS:readonly EntityKind[]=['MILESTONE','WORK_PACKAGE','PULL_REQUEST','TASK','EXECUTION','RUN','RESULT','FEEDBACK','CONTROL_LOOP','HUMAN_UAT'];
const DIMENSIONS:readonly LifecycleDimension[]=['milestone.lifecycle','wp.structure','wp.lifecycle','wp.implementation','wp.validation','wp.uat','wp.closure','wp.progress','pr.lifecycle','task.lifecycle','execution.lifecycle','run.lifecycle','result.availability','feedback.lifecycle','feedback.delivery','controlLoop.lifecycle','humanUat.lifecycle'];
const BINDING_ENDPOINTS:Readonly<Record<BindingKind,readonly [EntityKind,EntityKind]>>={
  MILESTONE_TO_WP:['MILESTONE','WORK_PACKAGE'],
  WP_TO_PR:['WORK_PACKAGE','PULL_REQUEST'],
  WP_TO_TASK:['WORK_PACKAGE','TASK'],
  TASK_TO_EXECUTION:['TASK','EXECUTION'],
  EXECUTION_TO_RUN:['EXECUTION','RUN'],
  RUN_TO_RESULT:['RUN','RESULT'],
  EXECUTION_TO_CONTROL_LOOP:['EXECUTION','CONTROL_LOOP'],
  CONTROL_LOOP_TO_RUN:['CONTROL_LOOP','RUN'],
  CONTROL_LOOP_TO_FEEDBACK:['CONTROL_LOOP','FEEDBACK'],
  RUN_TO_FEEDBACK:['RUN','FEEDBACK'],
  RESULT_TO_FEEDBACK:['RESULT','FEEDBACK'],
  WP_TO_HUMAN_UAT:['WORK_PACKAGE','HUMAN_UAT'],
  PR_TO_HUMAN_UAT:['PULL_REQUEST','HUMAN_UAT']
};
const DIMENSION_ENTITY_KIND:Partial<Record<LifecycleDimension,EntityKind>>={
  'milestone.lifecycle':'MILESTONE',
  'wp.structure':'WORK_PACKAGE',
  'wp.lifecycle':'WORK_PACKAGE',
  'wp.implementation':'WORK_PACKAGE',
  'wp.validation':'WORK_PACKAGE',
  'wp.uat':'WORK_PACKAGE',
  'wp.closure':'WORK_PACKAGE',
  'wp.progress':'WORK_PACKAGE',
  'pr.lifecycle':'PULL_REQUEST',
  'task.lifecycle':'TASK',
  'execution.lifecycle':'EXECUTION',
  'run.lifecycle':'RUN',
  'result.availability':'RESULT',
  'feedback.lifecycle':'FEEDBACK',
  'feedback.delivery':'FEEDBACK',
  'controlLoop.lifecycle':'CONTROL_LOOP',
  'humanUat.lifecycle':'HUMAN_UAT'
};

function nonEmpty(value:string,label:string):string{
  if(!value.trim())throw new Error(`${label}_REQUIRED`);
  return value;
}

function freeze<T>(value:T):Readonly<T>{
  if(value&&typeof value==='object'&&!Object.isFrozen(value)){
    for(const child of Object.values(value as Record<string,unknown>))freeze(child);
    Object.freeze(value);
  }
  return value;
}

function identityKey(identity:CanonicalEntityIdentity):string{return `${identity.kind}:${identity.id}`}
function sourceKey(identity:SourceEntityIdentity):string{return `${identity.domain}:${identity.id}`}
function sameIdentity(left:CanonicalEntityIdentity,right:CanonicalEntityIdentity):boolean{return left.kind===right.kind&&left.id===right.id}
function sameSourceIdentity(left:SourceEntityIdentity,right:SourceEntityIdentity):boolean{return left.domain===right.domain&&left.id===right.id}
function validateSource(source:ProjectionSourceEvidence):void{
  if(source.sourceDomain!==source.sourceEntity.domain)throw new Error('SOURCE_DOMAIN_MISMATCH');
  nonEmpty(source.sourceEntity.id,'SOURCE_ENTITY_ID');
  if(source.sourceRevision.availability==='AVAILABLE')nonEmpty(source.sourceRevision.value,'SOURCE_REVISION');
}
function cloneSource(source:ProjectionSourceEvidence):ProjectionSourceEvidence{
  validateSource(source);
  const sourceEntity=sourceEntityIdentity(source.sourceEntity.domain,source.sourceEntity.id);
  const sourceRevision=source.sourceRevision.availability==='AVAILABLE'?availableSourceRevision(source.sourceRevision.value):unavailableSourceRevision();
  return freeze({sourceDomain:source.sourceDomain,sourceEntity,sourceRevision});
}

export function entityIdentity<K extends EntityKind>(kind:K,id:string):EntityIdentity<K>{
  if(!ENTITY_KINDS.includes(kind))throw new Error('ENTITY_KIND_INVALID');
  return freeze({kind,id:nonEmpty(id,'ENTITY_ID')});
}

export function sourceEntityIdentity(domain:SourceDomain,id:string):SourceEntityIdentity{
  return freeze({domain,id:nonEmpty(id,'SOURCE_ENTITY_ID')});
}

export function availableSourceRevision(value:string):SourceRevision{
  return freeze({availability:'AVAILABLE',value:nonEmpty(value,'SOURCE_REVISION')});
}

export function unavailableSourceRevision():SourceRevision{return freeze({availability:'UNAVAILABLE'})}

export function projectionSource(sourceEntity:SourceEntityIdentity,sourceRevision:SourceRevision=unavailableSourceRevision()):ProjectionSourceEvidence{
  return cloneSource({sourceDomain:sourceEntity.domain,sourceEntity,sourceRevision});
}

export function unknownDimensionValue<D extends LifecycleDimension>(dimension:D):DimensionValue<D>{
  return freeze({state:'UNKNOWN',dimension});
}

export function knownDimensionValue<D extends LifecycleDimension>(dimension:D,value:string):DimensionValue<D>{
  return freeze({state:'KNOWN',dimension,value:nonEmpty(value,'PROJECTED_VALUE')});
}

export function dimensionProjection<D extends LifecycleDimension>(dimension:D,projectedValue:DimensionValue<D>,source:ProjectionSourceEvidence):DimensionProjectionInput<D>{
  if(!DIMENSIONS.includes(dimension)||projectedValue.dimension!==dimension)throw new Error('DIMENSION_MISMATCH');
  const value=projectedValue.state==='KNOWN'?knownDimensionValue(dimension,projectedValue.value):unknownDimensionValue(dimension);
  return freeze({dimension,projectedValue:value,source:cloneSource(source)});
}

export function explicitBinding<K extends BindingKind>(kind:K,from:BindingEndpoints[K][0],to:BindingEndpoints[K][1],source:ProjectionSourceEvidence):ExplicitBindingInput<K>{
  const expected=BINDING_ENDPOINTS[kind];
  if(!expected||from.kind!==expected[0]||to.kind!==expected[1])throw new Error('BINDING_ENDPOINT_MISMATCH');
  nonEmpty(from.id,'BINDING_FROM_ID');
  nonEmpty(to.id,'BINDING_TO_ID');
  return freeze({kind,from:entityIdentity(from.kind,from.id),to:entityIdentity(to.kind,to.id),source:cloneSource(source)}) as ExplicitBindingInput<K>;
}

export type GlobalStateProjectContext=Readonly<{projectId:string;repositoryIdentity:string;projectContextRevision:number}>;

export function createEmptyGlobalStateReadModel(context:GlobalStateProjectContext={projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter',projectContextRevision:0}):AiccGlobalStateReadModel{
  if(!context.projectId||!context.repositoryIdentity||!Number.isSafeInteger(context.projectContextRevision)||context.projectContextRevision<0)throw new Error('PROJECT_CONTEXT_INVALID');
  return freeze({
    schema:GLOBAL_STATE_READ_MODEL_SCHEMA,
    authority:GLOBAL_STATE_READ_MODEL_AUTHORITY,
    writeAuthority:GLOBAL_STATE_WRITE_AUTHORITY,
    inferenceAuthority:AICC_STATE_INFERENCE_AUTHORITY,
    projectId:context.projectId,
    repositoryIdentity:context.repositoryIdentity,
    projectContextRevision:context.projectContextRevision,
    globalProjectionRevision:0,
    projectedAt:null,
    entities:[],
    entityRevisions:[],
    bindings:[],
    scopedTasks:[],
    scopedRuntimeHistory:[],
    scopedResults:[]
  });
}

function revisionSignature(revision:SourceRevision):string{return revision.availability==='AVAILABLE'?`A:${revision.value}`:'U'}
function sourceSignature(source:ProjectionSourceEvidence):string{return `${sourceKey(source.sourceEntity)}@${revisionSignature(source.sourceRevision)}`}
function dimensionInputSignature(input:DimensionProjectionInput):string{
  const value=input.projectedValue.state==='KNOWN'?`KNOWN:${input.projectedValue.value}`:'UNKNOWN';
  return `${input.dimension}=${value}<-${sourceSignature(input.source)}`;
}
function dimensionRecordSignature(record:ProjectedDimensionRecord):string{
  return dimensionInputSignature({dimension:record.dimension,projectedValue:record.projectedValue,source:record.provenance});
}
function bindingInputSignature(binding:ExplicitBindingInput):string{
  return `${binding.kind}:${identityKey(binding.from)}>${identityKey(binding.to)}<-${sourceSignature(binding.source)}`;
}
function bindingRecordSignature(binding:ProjectedBindingRecord):string{
  return bindingInputSignature({kind:binding.kind,from:binding.from,to:binding.to,source:binding.provenance} as ExplicitBindingInput);
}

function normalizeCandidate(candidate:GlobalStateProjectionCandidate):GlobalStateProjectionCandidate{
  const entityKeys=new Set<string>();
  const entities=candidate.entities.map(entity=>{
    const identity=entityIdentity(entity.identity.kind,entity.identity.id) as CanonicalEntityIdentity;
    const key=identityKey(identity);
    if(entityKeys.has(key))throw new Error(`DUPLICATE_ENTITY:${key}`);
    entityKeys.add(key);
    const dimensions=[...entity.dimensions].sort((a,b)=>a.dimension.localeCompare(b.dimension)).map(field=>dimensionProjection(field.dimension,field.projectedValue,field.source));
    const dimensionKeys=new Set<string>();
    for(const field of dimensions){
      if(dimensionKeys.has(field.dimension))throw new Error(`DUPLICATE_DIMENSION:${key}:${field.dimension}`);
      dimensionKeys.add(field.dimension);
      const expectedKind=DIMENSION_ENTITY_KIND[field.dimension];
      if(expectedKind&&identity.kind!==expectedKind)throw new Error(`DIMENSION_ENTITY_MISMATCH:${field.dimension}:${identity.kind}`);
    }
    return freeze({identity,dimensions});
  }).sort((a,b)=>identityKey(a.identity).localeCompare(identityKey(b.identity)));
  const bindingKeys=new Set<string>();
  const bindings=candidate.bindings.map(binding=>explicitBinding(binding.kind,binding.from as never,binding.to as never,binding.source) as ExplicitBindingInput).sort((a,b)=>bindingInputSignature(a).localeCompare(bindingInputSignature(b)));
  for(const binding of bindings){
    const key=bindingInputSignature(binding);
    if(bindingKeys.has(key))throw new Error(`DUPLICATE_BINDING:${key}`);
    bindingKeys.add(key);
  }
  return freeze({entities,bindings});
}

function incidentBindingSignatures(identity:CanonicalEntityIdentity,bindings:readonly (ExplicitBindingInput|ProjectedBindingRecord)[]):readonly string[]{
  return bindings.filter(binding=>sameIdentity(binding.from,identity)||sameIdentity(binding.to,identity)).map(binding=>'provenance' in binding?bindingRecordSignature(binding):bindingInputSignature(binding)).sort();
}

export function projectGlobalStateReadModel(previous:AiccGlobalStateReadModel,candidate:GlobalStateProjectionCandidate,projectedAt=new Date().toISOString()):AiccGlobalStateReadModel{
  const normalized=normalizeCandidate(candidate);
  const previousEntities=new Map(previous.entities.map(entity=>[identityKey(entity.identity),entity]));
  const nextInputs=new Map(normalized.entities.map(entity=>[identityKey(entity.identity),entity]));
  const previousIdentities=new Map<string,CanonicalEntityIdentity>(previous.entityRevisions.map(record=>[identityKey(record.identity),record.identity]));
  const nextIdentities=new Map<string,CanonicalEntityIdentity>();
  for(const entity of previous.entities)previousIdentities.set(identityKey(entity.identity),entity.identity);
  for(const binding of previous.bindings){previousIdentities.set(identityKey(binding.from),binding.from);previousIdentities.set(identityKey(binding.to),binding.to)}
  for(const entity of normalized.entities)nextIdentities.set(identityKey(entity.identity),entity.identity);
  for(const binding of normalized.bindings){nextIdentities.set(identityKey(binding.from),binding.from);nextIdentities.set(identityKey(binding.to),binding.to)}
  const allKeys=new Set([...previousIdentities.keys(),...nextIdentities.keys()]);
  const changedEntityKeys=new Set<string>();
  for(const key of allKeys){
    const before=previousEntities.get(key),after=nextInputs.get(key);
    const previousIdentity=previousIdentities.get(key),nextIdentity=nextIdentities.get(key);
    const previousSignature=JSON.stringify({present:Boolean(before),dimensions:before?.dimensions.map(dimensionRecordSignature)??[],bindings:previousIdentity?incidentBindingSignatures(previousIdentity,previous.bindings):[]});
    const nextSignature=JSON.stringify({present:Boolean(after),dimensions:after?.dimensions.map(dimensionInputSignature)??[],bindings:nextIdentity?incidentBindingSignatures(nextIdentity,normalized.bindings):[]});
    if(previousSignature!==nextSignature)changedEntityKeys.add(key);
  }
  const previousBindingSignature=previous.bindings.map(bindingRecordSignature).sort().join('\n');
  const nextBindingSignature=normalized.bindings.map(bindingInputSignature).sort().join('\n');
  const changed=changedEntityKeys.size>0||previousBindingSignature!==nextBindingSignature;
  if(!changed)return previous;

  const globalProjectionRevision=previous.globalProjectionRevision+1;
  const revisionLedger=new Map(previous.entityRevisions.map(record=>[identityKey(record.identity),record]));
  for(const key of changedEntityKeys){
    const identity=nextIdentities.get(key)??previousIdentities.get(key);
    if(!identity)continue;
    const prior=revisionLedger.get(key)?.projectionRevision??0;
    revisionLedger.set(key,freeze({identity,projectionRevision:prior+1}));
  }

  const entities=normalized.entities.map(input=>{
    const key=identityKey(input.identity),before=previousEntities.get(key);
    if(before&&!changedEntityKeys.has(key))return before;
    const projectionRevision=revisionLedger.get(key)?.projectionRevision??1;
    const beforeDimensions=new Map(before?.dimensions.map(field=>[dimensionRecordSignature(field),field])??[]);
    const dimensions=input.dimensions.map(field=>beforeDimensions.get(dimensionInputSignature(field))??freeze({
      entityIdentity:input.identity,
      dimension:field.dimension,
      projectedValue:field.projectedValue,
      provenance:{...field.source,projectionRevision,projectedAt}
    }));
    return freeze({identity:input.identity,projectionRevision,projectedAt,dimensions});
  });
  const previousBindings=new Map(previous.bindings.map(binding=>[bindingRecordSignature(binding),binding]));
  const bindings=normalized.bindings.map(binding=>previousBindings.get(bindingInputSignature(binding))??freeze({
    ...binding,
    provenance:{...binding.source,projectionRevision:globalProjectionRevision,projectedAt}
  }));
  const entityRevisions=[...revisionLedger.values()].sort((a,b)=>identityKey(a.identity).localeCompare(identityKey(b.identity)));
  return freeze({
    schema:GLOBAL_STATE_READ_MODEL_SCHEMA,
    authority:GLOBAL_STATE_READ_MODEL_AUTHORITY,
    writeAuthority:GLOBAL_STATE_WRITE_AUTHORITY,
    inferenceAuthority:AICC_STATE_INFERENCE_AUTHORITY,
    projectId:previous.projectId,
    repositoryIdentity:previous.repositoryIdentity,
    projectContextRevision:previous.projectContextRevision,
    globalProjectionRevision,
    projectedAt,
    entities,
    entityRevisions,
    bindings,
    scopedTasks:previous.scopedTasks,
    scopedRuntimeHistory:previous.scopedRuntimeHistory,
    scopedResults:previous.scopedResults
  });
}

/** The single Layer 2 project query boundary. A context change starts from an empty scoped model. */
export function queryGlobalStateForProject(input:GlobalStateProjectQueryInput,candidate:GlobalStateProjectionCandidate,previous:AiccGlobalStateReadModel=createEmptyGlobalStateReadModel(input),projectedAt=new Date().toISOString(),collections:GlobalStateProjectCollections={}):AiccGlobalStateReadModel{
  if(!input.projectId||!input.repositoryIdentity||!Number.isSafeInteger(input.projectContextRevision))throw new Error('GLOBAL_STATE_PROJECT_SCOPE_REQUIRED');
  const sameContext=previous.projectId===input.projectId&&previous.repositoryIdentity===input.repositoryIdentity&&previous.projectContextRevision===input.projectContextRevision;
  const base=sameContext?previous:createEmptyGlobalStateReadModel(input);
  const scoped=(value:any)=>value?.projectId===input.projectId&&value?.repositoryIdentity===input.repositoryIdentity;
  const next=projectGlobalStateReadModel(base,candidate,projectedAt);
  return freeze({...next,scopedTasks:(collections.tasks??(sameContext?base.scopedTasks:[])).filter(scoped),scopedRuntimeHistory:(collections.runtimeHistory??(sameContext?base.scopedRuntimeHistory:[])).filter(scoped),scopedResults:(collections.results??(sameContext?base.scopedResults:[])).filter(scoped)});
}

export async function rebuildGlobalStateReadModel(previous:AiccGlobalStateReadModel,adapters:readonly Layer1ProjectionAdapter[],projectedAt=new Date().toISOString()):Promise<AiccGlobalStateReadModel>{
  const domains=new Set<SourceDomain>();
  for(const adapter of adapters){
    if(domains.has(adapter.domain))throw new Error(`DUPLICATE_LAYER1_ADAPTER:${adapter.domain}`);
    domains.add(adapter.domain);
  }
  const fragments=await Promise.all([...adapters].sort((a,b)=>a.domain.localeCompare(b.domain)).map(async adapter=>{
    const fragment=await adapter.readCanonicalProjection();
    for(const entity of fragment.entities)for(const field of entity.dimensions)if(field.source.sourceDomain!==adapter.domain)throw new Error(`ADAPTER_SOURCE_DOMAIN_MISMATCH:${adapter.domain}`);
    for(const binding of fragment.bindings)if(binding.source.sourceDomain!==adapter.domain)throw new Error(`ADAPTER_SOURCE_DOMAIN_MISMATCH:${adapter.domain}`);
    return fragment;
  }));
  const entityFragments=new Map<string,{identity:CanonicalEntityIdentity;dimensions:DimensionProjectionInput[]} >();
  const bindings:ExplicitBindingInput[]=[];
  for(const fragment of fragments){
    for(const entity of fragment.entities){
      const key=identityKey(entity.identity),existing=entityFragments.get(key)??{identity:entity.identity,dimensions:[]};
      existing.dimensions.push(...entity.dimensions);
      entityFragments.set(key,existing);
    }
    bindings.push(...fragment.bindings);
  }
  return projectGlobalStateReadModel(previous,{entities:[...entityFragments.values()],bindings},projectedAt);
}

export function planExactProjectionInvalidation(model:AiccGlobalStateReadModel,sourceEntity:SourceEntityIdentity):ExactInvalidationPlan{
  const dependentProjections:ProjectionDependencyTarget[]=[];
  for(const entity of model.entities)for(const field of entity.dimensions){
    if(sameSourceIdentity(field.provenance.sourceEntity,sourceEntity))dependentProjections.push(freeze({type:'DIMENSION',entityIdentity:entity.identity,dimension:field.dimension}));
  }
  for(const binding of model.bindings){
    if(sameSourceIdentity(binding.provenance.sourceEntity,sourceEntity))dependentProjections.push(freeze({type:'BINDING',kind:binding.kind,from:binding.from,to:binding.to}));
  }
  dependentProjections.sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
  return freeze({sourceEntity,dependentProjections,requiresReprojection:dependentProjections.length>0});
}

export function resolveExplicitBindings<K extends BindingKind>(model:AiccGlobalStateReadModel,kind:K,from:BindingEndpoints[K][0]):BindingResolution<K>{
  const bindings=model.bindings.filter((binding):binding is ProjectedBindingRecord<K>=>binding.kind===kind&&sameIdentity(binding.from,from));
  return bindings.length?freeze({state:'BOUND',bindings}):freeze({state:'UNBOUND',bindings:[]});
}
