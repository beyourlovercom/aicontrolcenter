import type {RoadmapNode} from './workflow.ts';
import {normalizeRoadmap} from './model/projectModel.ts';

export type RoadmapSourceName='LOCAL'|'GITHUB'|'BOOTSTRAP';
export type RoadmapSource={source:RoadmapSourceName;content:string};
export type RoadmapProjection={revision:number|null;source:RoadmapSourceName;contentHash:string;nodes:RoadmapNode[];nodeIds:Set<string>};
export type PersistedRoadmapProjection={schema_version:'aicc.roadmap.projection.v1';roadmap_revision:number;source:RoadmapSourceName;source_hash:string;accepted_at:string;nodes:RoadmapNode[]};
export type RoadmapSelectionResult={status:'SELECTED'|'EQUAL'|'CONFLICT'|'NO_VALID_REVISION';projection?:RoadmapProjection;reason?:string};

export function parseRoadmapRevision(content:string):number|null{
  const value=content.match(/^Roadmap-Revision:\s*(\d+)\s*$/mi)?.[1];
  if(!value)return null;
  const revision=Number(value);
  return Number.isSafeInteger(revision)&&revision>0?revision:null;
}

export function canonicalRoadmapContent(content:string):string{return content.replace(/\r\n?/g,'\n').trim();}

export function canonicalRoadmapHash(content:string):string{
  let first=2166136261,second=16777619;
  for(const character of canonicalRoadmapContent(content)){
    const code=character.codePointAt(0)??0;
    first=Math.imul(first^code,16777619)>>>0;
    second=Math.imul(second^((code<<1)|1),2246822519)>>>0;
  }
  return `${first.toString(16).padStart(8,'0')}${second.toString(16).padStart(8,'0')}`;
}

function collectIds(nodes:RoadmapNode[],ids=new Set<string>()):Set<string>{
  for(const node of nodes){ids.add(node.id);collectIds(node.children,ids)}
  return ids;
}

export function compileRoadmapProjection(source:RoadmapSource,extraNodes:RoadmapNode[]=[]):RoadmapProjection{
  const nodes=extraNodes.length?extraNodes:normalizeRoadmap(source.content,false,[]);
  return {revision:parseRoadmapRevision(source.content),source:source.source,contentHash:canonicalRoadmapHash(source.content),nodes,nodeIds:collectIds(nodes)};
}

export function serializeRoadmapProjection(projection:RoadmapProjection,acceptedAt=new Date().toISOString()):PersistedRoadmapProjection{
  if(projection.revision===null)throw new Error('ROADMAP_REVISION_REQUIRED');
  return {schema_version:'aicc.roadmap.projection.v1',roadmap_revision:projection.revision,source:projection.source,source_hash:projection.contentHash,accepted_at:acceptedAt,nodes:projection.nodes};
}

export function deserializeRoadmapProjection(value:unknown):RoadmapProjection|null{
  if(!value||typeof value!=='object')return null;
  const readModel=value as {schema?:unknown;read_only?:unknown;source?:unknown;source_hash?:unknown;projection_revision?:unknown;milestones?:unknown};
  if(readModel.schema==='AICC_ROADMAP_READ_MODEL_V1'){
    if(readModel.read_only!==true||readModel.source!=='docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md'||typeof readModel.source_hash!=='string'||!Number.isSafeInteger(readModel.projection_revision)||Number(readModel.projection_revision)<=0||!Array.isArray(readModel.milestones))return null;
    return {revision:Number(readModel.projection_revision),source:'LOCAL',contentHash:readModel.source_hash,nodes:readModel.milestones as RoadmapNode[],nodeIds:collectIds(readModel.milestones as RoadmapNode[])};
  }
  const candidate=value as Partial<PersistedRoadmapProjection>;
  if(candidate.schema_version!=='aicc.roadmap.projection.v1'||typeof candidate.roadmap_revision!=='number'||!Number.isSafeInteger(candidate.roadmap_revision)||candidate.roadmap_revision<=0||!['LOCAL','GITHUB','BOOTSTRAP'].includes(candidate.source??'')||typeof candidate.source_hash!=='string'||typeof candidate.accepted_at!=='string'||!Array.isArray(candidate.nodes))return null;
  const revision=candidate.roadmap_revision;
  const source=candidate.source;
  const nodes=candidate.nodes;
  if(revision===undefined||source===undefined||nodes===undefined)return null;
  return {revision,source,contentHash:candidate.source_hash!,nodes,nodeIds:collectIds(nodes)};
}

export function selectRoadmapProjection(local:RoadmapSource,github:RoadmapSource|null):RoadmapSelectionResult{
  if(!github)return {status:'NO_VALID_REVISION',reason:'GITHUB_ROADMAP_SOURCE_UNAVAILABLE'};
  const localProjection=compileRoadmapProjection(local),githubProjection=compileRoadmapProjection(github);
  if(localProjection.revision===null||githubProjection.revision===null)return {status:'NO_VALID_REVISION',reason:'ROADMAP_REVISION_REQUIRED'};
  if(localProjection.revision===githubProjection.revision){
    if(localProjection.contentHash!==githubProjection.contentHash)return {status:'CONFLICT',reason:'ROADMAP_EQUAL_REVISION_HASH_CONFLICT'};
    return {status:'EQUAL',projection:localProjection};
  }
  return {status:'SELECTED',projection:localProjection.revision>githubProjection.revision?localProjection:githubProjection};
}

export function preserveRoadmapUiState(projection:RoadmapProjection,selectedId:string,lockedId:string|null):boolean{
  return projection.nodeIds.has(selectedId)&&(!lockedId||projection.nodeIds.has(lockedId));
}
