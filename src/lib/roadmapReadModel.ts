import {createHash} from 'node:crypto';
import {mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {compileRoadmapProjection,parseRoadmapRevision} from './roadmapProjection.ts';
import type {RoadmapNode} from './workflow.ts';

export const ROADMAP_CANONICAL_SOURCE='docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md';
export const ROADMAP_READ_MODEL='docs/10_Planning_Roadmap/02_AICC_ROADMAP_READ_MODEL.json';
export const ROADMAP_READ_MODEL_SCHEMA='AICC_ROADMAP_READ_MODEL_V1' as const;

export type AiccRoadmapReadModel={
  schema:typeof ROADMAP_READ_MODEL_SCHEMA;
  read_only:true;
  source:typeof ROADMAP_CANONICAL_SOURCE;
  source_revision:number;
  source_hash:string;
  projection_revision:number;
  generated_at:string;
  current_milestone:string;
  current_work_package:string;
  current_phase:string;
  milestones:RoadmapNode[];
};

export type RoadmapReadModelOptions={repositoryRoot?:string;sourcePath?:string;readModelPath?:string;forceRebuild?:boolean;generatedAt?:string};

function stringField(content:string,pattern:RegExp):string{return content.match(pattern)?.[1]?.trim()||'NOT_AVAILABLE'}
function sourceHash(content:string):string{return createHash('sha256').update(content.replace(/\r\n?/g,'\n')).digest('hex')}

export function deserializeRoadmapReadModel(value:unknown):AiccRoadmapReadModel|null{
  if(!value||typeof value!=='object')return null;
  const item=value as Partial<AiccRoadmapReadModel>;
  if(item.schema!==ROADMAP_READ_MODEL_SCHEMA||item.read_only!==true||item.source!==ROADMAP_CANONICAL_SOURCE||!Number.isSafeInteger(item.source_revision)||Number(item.source_revision)<=0||typeof item.source_hash!=='string'||!item.source_hash||!Number.isSafeInteger(item.projection_revision)||Number(item.projection_revision)<=0||typeof item.generated_at!=='string'||typeof item.current_milestone!=='string'||typeof item.current_work_package!=='string'||typeof item.current_phase!=='string'||!Array.isArray(item.milestones))return null;
  return item as AiccRoadmapReadModel;
}

function readExisting(path:string):AiccRoadmapReadModel|null{try{return deserializeRoadmapReadModel(JSON.parse(readFileSync(path,'utf8')))}catch{return null}}
function atomicWrite(path:string,value:AiccRoadmapReadModel){mkdirSync(dirname(path),{recursive:true});const temporary=join(dirname(path),`.${path.split('/').at(-1)}.${process.pid}.${Date.now()}.tmp`);writeFileSync(temporary,`${JSON.stringify(value,null,2)}\n`,{encoding:'utf8',mode:0o600});renameSync(temporary,path)}

export function ensureRoadmapReadModel(options:RoadmapReadModelOptions={}):AiccRoadmapReadModel{
  const repositoryRoot=options.repositoryRoot??'/Users/a/AI/007/AIcontrolcenter';
  const sourcePath=options.sourcePath??join(repositoryRoot,ROADMAP_CANONICAL_SOURCE);
  const readModelPath=options.readModelPath??join(repositoryRoot,ROADMAP_READ_MODEL);
  let content:string;
  try{content=readFileSync(sourcePath,'utf8')}catch{throw new Error('ROADMAP_READ_MODEL_BUILD_FAILED')}
  const hash=sourceHash(content),existing=readExisting(readModelPath);
  if(!options.forceRebuild&&existing?.source_hash===hash)return existing;
  try{
    const sourceRevision=parseRoadmapRevision(content);
    if(sourceRevision===null)throw new Error('ROADMAP_REVISION_REQUIRED');
    const projection=compileRoadmapProjection({source:'LOCAL',content});
    const model:AiccRoadmapReadModel={schema:ROADMAP_READ_MODEL_SCHEMA,read_only:true,source:ROADMAP_CANONICAL_SOURCE,source_revision:sourceRevision,source_hash:hash,projection_revision:(existing?.projection_revision??0)+1,generated_at:options.generatedAt??new Date().toISOString(),current_milestone:stringField(content,/^## Current milestone\s*\n\s*`([^`]+)`/mi),current_work_package:stringField(content,/^Current Work Package:\s*`([^`]+)`/mi),current_phase:stringField(content,/^Current implementation phase:\s*`([^`]+)`/mi),milestones:projection.nodes};
    atomicWrite(readModelPath,model);
    return model;
  }catch(error){if(error instanceof Error&&error.message==='ROADMAP_READ_MODEL_BUILD_FAILED')throw error;throw new Error('ROADMAP_READ_MODEL_BUILD_FAILED')}
}

export function roadmapReadModelPath(repositoryRoot='/Users/a/AI/007/AIcontrolcenter'):string{return join(repositoryRoot,ROADMAP_READ_MODEL)}
