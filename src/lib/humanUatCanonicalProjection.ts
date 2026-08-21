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

export const HUMAN_UAT_UI_STATE_SOURCE='GLOBAL_STATE_READ_MODEL' as const;
export const UAT_INFERENCE_FROM_OTHER_DIMENSIONS=0 as const;

export type HumanUatLifecycleInput=Readonly<{
  entityType:'work_package'|'pull_request';
  entityId:string;
  status?:string|null;
  updatedAt?:string|null;
  record?:unknown;
}>;
export type HumanUatLayer2Record=Readonly<{
  id:string;
  entityType:'work_package'|'pull_request';
  entityId:string;
  lifecycle:DimensionValue<'humanUat.lifecycle'>;
}>;
export type HumanUatLayer2Projection=Readonly<{model:AiccGlobalStateReadModel;records:readonly HumanUatLayer2Record[]}>;

const text=(value:unknown):string|null=>typeof value==='string'&&value.trim()?value.trim():null;
export const humanUatIdentity=(entityType:'work_package'|'pull_request',entityId:string)=>`${entityType}:${entityId}`;

/** Human UAT is an independent canonical dimension; no Task, Run, Result, or WP lifecycle is used to infer it. */
export function projectHumanUatLayer2(previous:AiccGlobalStateReadModel=createEmptyGlobalStateReadModel(),items:readonly HumanUatLifecycleInput[]=[]):HumanUatLayer2Projection{
  const unique=new Map<string,HumanUatLifecycleInput>();
  for(const item of items){
    const entityId=text(item.entityId);
    if(!entityId)continue;
    const id=humanUatIdentity(item.entityType,entityId);
    unique.set(id,{...item,entityId});
  }
  const records=[...unique.entries()].sort(([left],[right])=>left.localeCompare(right)).map(([id,item])=>{
    const value=text(item.status);
    const source=projectionSource(sourceEntityIdentity('HUMAN_UAT',id),availableSourceRevision(text(item.updatedAt)??JSON.stringify(item.record??{status:value}))); 
    const lifecycle=value?knownDimensionValue('humanUat.lifecycle',value):unknownDimensionValue('humanUat.lifecycle');
    return {id,item,source,lifecycle};
  });
  const candidate:GlobalStateProjectionCandidate={
    entities:records.map(record=>({identity:entityIdentity('HUMAN_UAT',record.id),dimensions:[dimensionProjection('humanUat.lifecycle',record.lifecycle,record.source)]})),
    bindings:records.map(record=>record.item.entityType==='work_package'
      ?explicitBinding('WP_TO_HUMAN_UAT',entityIdentity('WORK_PACKAGE',record.item.entityId),entityIdentity('HUMAN_UAT',record.id),record.source)
      :explicitBinding('PR_TO_HUMAN_UAT',entityIdentity('PULL_REQUEST',record.item.entityId),entityIdentity('HUMAN_UAT',record.id),record.source))
  };
  const model=projectGlobalStateReadModel(previous,candidate);
  return Object.freeze({model,records:Object.freeze(records.map(record=>Object.freeze({id:record.id,entityType:record.item.entityType,entityId:record.item.entityId,lifecycle:record.lifecycle})))});
}

export function humanUatLayer2Record(projection:HumanUatLayer2Projection,entityType:'work_package'|'pull_request',entityId:string):HumanUatLayer2Record|null{
  return projection.records.find(record=>record.id===humanUatIdentity(entityType,entityId))??null;
}
