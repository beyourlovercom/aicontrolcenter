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
  type GlobalStateProjectionCandidate
} from './globalStateReadModel.ts';
import type {PullRequestRecord} from './model/entityTypes.ts';
import {scopedEntityKey} from './projectEntityScope.ts';

export const PR_IDENTITY_KEY='REPOSITORY_PLUS_PR_NUMBER' as const;
export const PR_LAYER1_WRITE_AUTHORITY='EXTERNAL_CANONICAL_SOURCES' as const;
export const PR_NAVIGATION_SNAPSHOT_UI_AUTHORITY=false as const;
export const PR_LIFECYCLE_WORKSPACE_DUPLICATE_AUTHORITY=false as const;

export type PrPresentationLifecycle='DRAFT'|'OPEN'|'MERGED'|'CLOSED'|'UNKNOWN';
export type PrLifecycleStatus='IN_PROGRESS'|'BLOCKED'|'COMPLETE'|'UNKNOWN';
export type PrLayer2Record=Readonly<{
  /** Existing selection identity; never used as the canonical PR identity. */
  selectionId:string;
  identityKey:string;
  repository:string;
  prNumber:number;
  record:PullRequestRecord;
  lifecycle:DimensionValue<'pr.lifecycle'>;
  presentationLifecycle:PrPresentationLifecycle;
  lifecycleStatus:PrLifecycleStatus;
  parentWpId:string|null;
  mappingStatus:'MAPPED'|'UNMAPPED';
}>;
export type PrLayer2Projection=Readonly<{model:AiccGlobalStateReadModel;records:readonly PrLayer2Record[]}>;
export type PrProjectScope=Readonly<{projectId:string;repositoryIdentity:string}>;

function validIdentity(record:PullRequestRecord):record is PullRequestRecord&{repository:string;number:number}{
  const number=record.number;
  return typeof record.repository==='string'&&record.repository.trim().length>0&&typeof number==='number'&&Number.isSafeInteger(number)&&number>0;
}
export function prIdentityKey(repository:string,prNumber:number,scope?:PrProjectScope):string{return scope?.projectId&&scope.repositoryIdentity===repository?`${scope.projectId}::${repository}#${prNumber}`:`${repository}#${prNumber}`;}
function lifecycle(record:PullRequestRecord):PrPresentationLifecycle{
  return record.state==='DRAFT'||record.state==='OPEN'||record.state==='MERGED'||record.state==='CLOSED'?record.state:'UNKNOWN';
}
function lifecycleStatus(value:PrPresentationLifecycle):PrLifecycleStatus{return value==='MERGED'?'COMPLETE':value==='CLOSED'?'BLOCKED':value==='DRAFT'||value==='OPEN'?'IN_PROGRESS':'UNKNOWN';}
function sourceRevision(record:PullRequestRecord,fallback:string){return availableSourceRevision(record.updatedAt??record.headSha??fallback);}

/** Builds a read-only Layer 2 projection. Snapshot fields are adapter input only. */
export function projectPrLayer2(previous:AiccGlobalStateReadModel=createEmptyGlobalStateReadModel(),pullRequests:readonly PullRequestRecord[]=[],revision='UNVERSIONED',scope?:PrProjectScope):PrLayer2Projection{
  const records=pullRequests.filter(validIdentity).map(record=>{
    const repository=record.repository.trim(),prNumber=record.number;if(scope&&scope.repositoryIdentity!==repository)return null;const identityKey=prIdentityKey(repository,prNumber,scope),state=lifecycle(record);
    const source=projectionSource(sourceEntityIdentity('PULL_REQUEST',identityKey),sourceRevision(record,revision));
    const value=state==='UNKNOWN'?unknownDimensionValue('pr.lifecycle'):knownDimensionValue('pr.lifecycle',state);
    return {record,repository,prNumber,identityKey,source,value};
  }).filter((item):item is NonNullable<typeof item>=>Boolean(item)).sort((a,b)=>a.identityKey.localeCompare(b.identityKey));
  const candidate:GlobalStateProjectionCandidate={
    entities:records.map(item=>({identity:entityIdentity('PULL_REQUEST',item.identityKey),dimensions:[dimensionProjection('pr.lifecycle',item.value,item.source)]})),
    bindings:records.flatMap(item=>item.record.workPackageId?[explicitBinding('WP_TO_PR',entityIdentity('WORK_PACKAGE',scope?scopedEntityKey(scope,'WORK_PACKAGE',item.record.workPackageId):item.record.workPackageId),entityIdentity('PULL_REQUEST',item.identityKey),item.source)]:[])
  };
  const model=projectGlobalStateReadModel(previous,candidate);
  const result:PrLayer2Record[]=records.map(item=>{const presentationLifecycle=lifecycle(item.record);return {selectionId:item.record.id,identityKey:item.identityKey,repository:item.repository,prNumber:item.prNumber,record:item.record,lifecycle:item.value,presentationLifecycle,lifecycleStatus:lifecycleStatus(presentationLifecycle),parentWpId:item.record.workPackageId??null,mappingStatus:item.record.workPackageId?'MAPPED' as const:'UNMAPPED' as const};});
  return Object.freeze({model,records:Object.freeze(result)});
}

export function prLayer2RecordForSelection(projection:PrLayer2Projection,selectionId:string):PrLayer2Record|null{return projection.records.find(record=>record.selectionId===selectionId)??null;}
export function prLayer2RecordForProjectSelection(projection:PrLayer2Projection,selectionId:string,scope?:PrProjectScope):PrLayer2Record|null{return scope?.projectId&&scope.repositoryIdentity?projection.records.find(record=>record.selectionId===selectionId&&record.repository===scope.repositoryIdentity)??null:null;}
export function filterPrLayer2Records(records:readonly PrLayer2Record[],filter:'ALL'|PrLifecycleStatus|'UNMAPPED'='ALL'):readonly PrLayer2Record[]{return records.filter(record=>filter==='ALL'||filter==='UNMAPPED'?filter==='ALL'||record.mappingStatus==='UNMAPPED':record.lifecycleStatus===filter).sort((a,b)=>a.prNumber-b.prNumber);}
