import {resolveAuthorizationForEntity} from './context/authorizationResolver.ts';
import {resolveWorkPackageLifecycle} from './context/lifecycleResolver.ts';
import {availableSourceRevision,createEmptyGlobalStateReadModel,dimensionProjection,entityIdentity,explicitBinding,knownDimensionValue,projectGlobalStateReadModel,projectionSource,sourceEntityIdentity,unavailableSourceRevision,unknownDimensionValue,type AiccGlobalStateReadModel,type DimensionValue,type GlobalStateProjectionCandidate} from './globalStateReadModel.ts';
import type {AiccProjectSnapshot,FormalizationState,WorkPackageLifecycle} from './model/entityTypes.ts';
import type {AiccStatus,RoadmapNode} from './workflow.ts';
import {scopedEntityKey,type ProjectIdentityScope} from './projectEntityScope.ts';

/** Phase 4: UI reads one WP projection; Roadmap remains the existence authority. */
export const WP_IDENTITY_KEY='CANONICAL_WORK_PACKAGE_ID' as const;
export const WP_EXISTENCE_AUTHORITY='CANONICAL_ROADMAP_STRUCTURE' as const;
export const WP_MILESTONE_BINDING_SOURCE='CANONICAL_ROADMAP_STRUCTURE' as const;
export const WP_ROADMAP_GROUP_SOURCE='CANONICAL_ROADMAP_STRUCTURE' as const;
export const ROADMAP_GROUP_IS_ENTITY=false as const;
export const WP_ID_PREFIX_DEPENDENCY=false as const;
export const WP_PROGRESS_INFERENCE_AUTHORITY=0 as const;
export const WP_TASK_BINDING_INFERENCE_AUTHORITY=0 as const;
export const WP_PR_BINDING_INFERENCE_AUTHORITY=0 as const;

export type WpLayer2Record=Readonly<{
  id:string; identityKey:string; title:string; milestoneId:string; milestoneTitle:string; structuralExistence:true;
  phase:string|null; phaseProgress:RoadmapNode['phaseProgress']; phasePlanAvailability:'AVAILABLE'|'NOT_AVAILABLE';
  roadmapGroupNumber:string|null; roadmapGroupTitle:string|null;
  lifecycle:WorkPackageLifecycle; lifecycleStatus:AiccStatus;
  implementation:DimensionValue<'wp.implementation'>; validation:DimensionValue<'wp.validation'>;
  uat:DimensionValue<'wp.uat'>; closure:DimensionValue<'wp.closure'>; progress:DimensionValue<'wp.progress'>;
  taskIds:readonly string[]; prIds:readonly string[]; entityProjectionRevision:number;
}>;
export type WpLayer2Projection=Readonly<{model:AiccGlobalStateReadModel;records:readonly WpLayer2Record[]}>;
export type ProjectWpScope=ProjectIdentityScope;

const signature=(value:unknown)=>JSON.stringify(value) || 'UNVERSIONED';
const sourceRevision=(value:unknown)=>value===null||value===undefined?unavailableSourceRevision():availableSourceRevision(signature(value));
const wpNodes=(snapshot:AiccProjectSnapshot)=>
  (snapshot.roadmap.value??[]).flatMap(milestone=>milestone.children.filter(node=>node.type==='work_package').map(node=>({milestone,node})));
const dimensionValue=<D extends 'wp.implementation'|'wp.validation'|'wp.uat'|'wp.closure'>(dimension:D,value:string|undefined):DimensionValue<D>=>value?knownDimensionValue(dimension,value):unknownDimensionValue(dimension);
const contractFields=(fields:Record<string,string>)=>Object.fromEntries(Object.entries(fields).map(([key,value])=>[key.toUpperCase().replace(/[\s-]+/g,'_'),value]));
const explicitContractStatus=(fields:Record<string,string>,keys:string[])=>{
  const normalized=contractFields(fields);
  return keys.map(key=>normalized[key]).find(value=>typeof value==='string'&&value.trim())?.trim();
};
const taskBinding=(task:any):{wpId:string;taskId:string}|null=>{
  const bindingState=task?.bindingState??task?.instruction?.bindingState;
  const wpId=task?.formalWpId??task?.formal_wp_id??task?.instruction?.formalWpId??task?.instruction?.formal_wp_id;
  const taskId=task?.taskId??task?.id??task?.instructionId;
  return bindingState==='BOUND'&&typeof wpId==='string'&&wpId.trim()&&typeof taskId==='string'&&taskId.trim()?{wpId,taskId}:null;
};
const prBinding=(pr:any,repositoryIdentity:string):{wpId:string;prId:string}|null=>
  typeof pr?.workPackageId==='string'&&pr.workPackageId.trim()&&typeof pr?.repository==='string'&&pr.repository===repositoryIdentity&&typeof pr?.number==='number'&&Number.isSafeInteger(pr.number)&&pr.number>0&&pr.correlationSource!=='UNKNOWN'?{wpId:pr.workPackageId,prId:String(pr.number)}:null;

function formalization(snapshot:AiccProjectSnapshot,id:string):FormalizationState{
  const formal=snapshot.formalWorkPackages.value?.[id];
  return snapshot.formalWorkPackages.availability==='UNAVAILABLE'||snapshot.formalWorkPackageReadError?.startsWith('FORMAL_WP_INVALID')?'FORMAL_INVALID':formal?'FORMAL_READY':'PLANNED_ONLY';
}

/**
 * Layer 1 adapter composition. It deliberately records independent WP facts;
 * lifecycle is never promoted to a fabricated all-purpose completion field.
 */
export function projectWpLayer2(previous:AiccGlobalStateReadModel,snapshot:AiccProjectSnapshot,tasks:readonly any[],scope:ProjectWpScope):WpLayer2Projection{
  if(!scope?.projectId||!scope.repositoryIdentity)throw new Error('WP_PROJECT_SCOPE_REQUIRED');
  if(scope.projectId!==previous.projectId||scope.repositoryIdentity!==previous.repositoryIdentity)throw new Error('PROJECT_SCOPE_MISMATCH');
  const projectScope=previous;
  const prs=snapshot.pullRequests.value??[];
  const milestones=(snapshot.roadmap.value??[]).map(milestone=>({
    id:milestone.id,
    lifecycle:typeof milestone.canonicalStatus==='string'&&milestone.canonicalStatus.trim()?milestone.canonicalStatus:typeof milestone.status==='string'&&milestone.status.trim()?milestone.status:null,
    source:projectionSource(sourceEntityIdentity(projectScope,'ROADMAP',`${snapshot.roadmapSource}:${milestone.id}`),availableSourceRevision(signature(milestone)))
  }));
  const records=wpNodes(snapshot).map(({milestone,node})=>{
    const id=node.id,identityKey=id,formal=snapshot.formalWorkPackages.value?.[id]??null;
    const lifecycle=resolveWorkPackageLifecycle({id,identityKey:scopedEntityKey(projectScope,'WORK_PACKAGE',id)},scope,formalization(snapshot,id),resolveAuthorizationForEntity({type:'work_package',id},snapshot),snapshot);
    const stage=(stageId:string)=>lifecycle.stages.find(item=>item.id===stageId)?.status;
    const evidence=snapshot.lifecycleEvidence.value?.find(item=>item.workPackageId===id)??null;
    const uat=snapshot.humanUat.value?.find(item=>item.entityType==='work_package'&&item.workPackageId===id)??null;
    const fields=formal?.fields??{};
    const taskIds=tasks.map(taskBinding).filter((binding):binding is {wpId:string;taskId:string}=>Boolean(binding&&binding.wpId===id)).map(binding=>binding.taskId).sort();
    const prIds=prs.map(pr=>prBinding(pr,previous.repositoryIdentity)).filter((binding):binding is {wpId:string;prId:string}=>Boolean(binding&&binding.wpId===id)).map(binding=>binding.prId).sort();
    const milestoneTitle=milestone.title.startsWith(`${milestone.id} — `)?milestone.title:`${milestone.id} — ${milestone.title}`;
    const phasePlanAvailability=node.phaseProgress?'AVAILABLE' as const:'NOT_AVAILABLE' as const;
    const structure={id,identityKey,title:node.displayTitle??formal?.title??node.title,milestoneId:milestone.id,milestoneTitle,phase:node.phaseProgress?.currentPhaseTitle??null,phaseProgress:node.phaseProgress??null,phasePlanAvailability,roadmapGroupNumber:node.roadmapGroupNumber??null,roadmapGroupTitle:node.roadmapGroupTitle??null};
    const implementation=dimensionValue('wp.implementation',evidence?.implementation.status??explicitContractStatus(fields,['IMPLEMENTATION','IMPLEMENTATION_STATUS']));
    const validation=dimensionValue('wp.validation',evidence?.validation.status??explicitContractStatus(fields,['VALIDATION','MACHINE_VALIDATION']));
    const uatValue=dimensionValue('wp.uat',uat?.status??explicitContractStatus(fields,['HUMAN_UAT']));
    const closure=dimensionValue('wp.closure',evidence?.closure?.status??explicitContractStatus(fields,['PACKAGE_STATUS']));
    const progress=node.progress===null?unknownDimensionValue('wp.progress'):knownDimensionValue('wp.progress',String(node.progress));
    return {id,identityKey,node,milestone,formal,lifecycle,structure,implementation,validation,uat:uatValue,closure,progress,taskIds,prIds,evidence,humanUat:uat};
  });
  const candidate:GlobalStateProjectionCandidate={
    entities:[
      ...milestones.map(milestone=>({identity:entityIdentity(projectScope,'MILESTONE',milestone.id),dimensions:[dimensionProjection('milestone.lifecycle',milestone.lifecycle?knownDimensionValue('milestone.lifecycle',milestone.lifecycle):unknownDimensionValue('milestone.lifecycle'),milestone.source)]})),
      ...records.map(record=>{
      const structureSource=projectionSource(sourceEntityIdentity(projectScope,'ROADMAP',`${snapshot.roadmapSource}:${record.id}`),availableSourceRevision(signature(record.structure)));
      const lifecycleSource=projectionSource(sourceEntityIdentity(projectScope,'WORK_PACKAGE',`${record.id}:lifecycle`),availableSourceRevision(signature({formal:record.formal?.fields??null,evidence:record.evidence,uat:record.uat,lifecycle:record.lifecycle})));
      const formalSource=projectionSource(sourceEntityIdentity(projectScope,'FORMAL_WORK_PACKAGE',record.id),sourceRevision(record.formal?.fields));
      const evidenceSource=projectionSource(sourceEntityIdentity(projectScope,'LIFECYCLE_EVIDENCE',record.id),sourceRevision(record.evidence));
      const uatSource=projectionSource(sourceEntityIdentity(projectScope,'HUMAN_UAT',record.id),sourceRevision(record.humanUat));
      return {identity:entityIdentity(projectScope,'WORK_PACKAGE',record.id),dimensions:[
        dimensionProjection('wp.structure',knownDimensionValue('wp.structure',signature(record.structure)),structureSource),
        dimensionProjection('wp.lifecycle',knownDimensionValue('wp.lifecycle',record.lifecycle.effectiveStatus),lifecycleSource),
        dimensionProjection('wp.implementation',record.implementation,record.evidence?.implementation?evidenceSource:formalSource),
        dimensionProjection('wp.validation',record.validation,record.evidence?.validation?evidenceSource:formalSource),
        dimensionProjection('wp.uat',record.uat,record.humanUat?uatSource:formalSource),
        dimensionProjection('wp.closure',record.closure,record.evidence?.closure?evidenceSource:formalSource),
        dimensionProjection('wp.progress',record.progress,structureSource)
      ]};
    })
    ],
    bindings:records.flatMap(record=>[
      explicitBinding('MILESTONE_TO_WP',entityIdentity(projectScope,'MILESTONE',record.structure.milestoneId),entityIdentity(projectScope,'WORK_PACKAGE',record.id),projectionSource(sourceEntityIdentity(projectScope,'ROADMAP',`${snapshot.roadmapSource}:${record.structure.milestoneId}`),availableSourceRevision(record.structure.milestoneId))),
      ...record.taskIds.map(taskId=>explicitBinding('WP_TO_TASK',entityIdentity(projectScope,'WORK_PACKAGE',record.id),entityIdentity(projectScope,'TASK',taskId),projectionSource(sourceEntityIdentity(projectScope,'TASK',taskId),availableSourceRevision(taskId)))),
      ...record.prIds.map(prId=>explicitBinding('WP_TO_PR',entityIdentity(projectScope,'WORK_PACKAGE',record.id),entityIdentity(projectScope,'PULL_REQUEST',prId),projectionSource(sourceEntityIdentity(projectScope,'PULL_REQUEST',prId),availableSourceRevision(prId))))
    ])
  };
  const model=projectGlobalStateReadModel(previous,candidate);
  const projectionRecords=records.map(record=>{
    const revision=model.entityRevisions.find(item=>item.identity.kind==='WORK_PACKAGE'&&item.identity.id===record.id)?.projectionRevision??0;
    return Object.freeze({id:record.id,identityKey:record.identityKey,title:record.structure.title,milestoneId:record.structure.milestoneId,milestoneTitle:record.structure.milestoneTitle,structuralExistence:true as const,phase:record.structure.phase,phaseProgress:record.structure.phaseProgress,phasePlanAvailability:record.structure.phasePlanAvailability,roadmapGroupNumber:record.structure.roadmapGroupNumber,roadmapGroupTitle:record.structure.roadmapGroupTitle,lifecycle:record.lifecycle,lifecycleStatus:record.lifecycle.effectiveStatus,implementation:record.implementation,validation:record.validation,uat:record.uat,closure:record.closure,progress:record.progress,taskIds:Object.freeze(record.taskIds),prIds:Object.freeze(record.prIds),entityProjectionRevision:revision});
  });
  return Object.freeze({model,records:Object.freeze(projectionRecords)});
}

export function wpLayer2Record(projection:WpLayer2Projection,id:string):WpLayer2Record|null{return projection.records.find(record=>record.id===id)??null;}

/** Retains Roadmap structure while replacing only WP state-facing fields. */
export function projectWpRoadmapNodes(nodes:readonly RoadmapNode[],projection:WpLayer2Projection):RoadmapNode[]{
  const byId=new Map(projection.records.map(record=>[record.id,record]));
  const milestoneLifecycle=new Map(projection.model.entities.filter(entity=>entity.identity.kind==='MILESTONE').map(entity=>{
    const field=entity.dimensions.find(dimension=>dimension.dimension==='milestone.lifecycle');
    return [entity.identity.id,field?.projectedValue.state==='KNOWN'?field.projectedValue.value:null] as const;
  }));
  return nodes.map(node=>{
    const children=projectWpRoadmapNodes(node.children,projection);
    const record=node.type==='work_package'?byId.get(node.id):undefined;
    const milestoneState=node.type==='milestone'?milestoneLifecycle.get(node.id):null;
    return record?{...node,children,status:record.lifecycleStatus,canonicalStatus:record.lifecycleStatus,progress:record.progress.state==='KNOWN'?Number(record.progress.value):null,phaseProgress:record.phaseProgress}:milestoneState?{...node,children,status:milestoneState as AiccStatus,canonicalStatus:milestoneState}: {...node,children};
  });
}
