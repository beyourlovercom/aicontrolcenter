import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';

export const ROADMAP_SCHEMA='aicc.v3.roadmap.v1';
export const ROADMAP_SOURCE='docs/10_Planning_Roadmap/AICC-V3-LIVING-ROADMAP.md';

function fail(code,detail=''){
  const error=new Error(detail?`${code}: ${detail}`:code);
  error.code=code;
  throw error;
}

function field(text,label){
  const escaped=label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
  const match=text.match(new RegExp(`^${escaped}:\\s*(?:\u0060([^\u0060]+)\u0060|(.+))$`,'m'));
  return (match?.[1]||match?.[2]||'').trim();
}

function currentMilestone(text){
  const lines=text.split(/\r?\n/);
  const index=lines.findIndex(line=>line.trim()==='## Current milestone');
  if(index<0)return '';
  for(let i=index+1;i<lines.length;i+=1){
    const line=lines[i].trim();
    if(!line)continue;
    const match=line.match(/^`([^`]+)`$/);
    return match?.[1]?.trim()||'';
  }
  return '';
}
function milestones(text){
  const lines=text.split(/\r?\n/);
  const result=[];
  for(let i=0;i<lines.length;i+=1){
    const heading=lines[i].match(/^###\s+(V3\.\d+\s+—\s+.+)$/);
    if(!heading)continue;
    let goal='',estimate='';
    for(let j=i+1;j<lines.length&&!/^###\s+/.test(lines[j]);j+=1){
      if(lines[j].startsWith('Goal:'))goal=lines[j].slice(5).trim();
      if(lines[j].startsWith('Estimate:'))estimate=lines[j].slice(9).trim();
    }
    result.push(Object.freeze({title:heading[1].trim(),goal,estimate}));
  }
  return Object.freeze(result);
}

export function parseRoadmapMarkdown(text){
  const revision=Number(field(text,'Roadmap-Revision'));
  const updatedAt=field(text,'Updated-At');
  const status=field(text,'Status');
  const milestone=currentMilestone(text);
  const workPackage=field(text,'Current Work Package');
  const phase=field(text,'Current implementation phase');
  const list=milestones(text);

  if(!Number.isInteger(revision)||revision<1)fail('ROADMAP_REVISION_INVALID');
  if(!updatedAt)fail('ROADMAP_UPDATED_AT_MISSING');
  if(!status)fail('ROADMAP_STATUS_MISSING');
  if(!milestone)fail('ROADMAP_CURRENT_MILESTONE_MISSING');
  if(!workPackage)fail('ROADMAP_CURRENT_WORK_PACKAGE_MISSING');
  if(!phase)fail('ROADMAP_CURRENT_PHASE_MISSING');
  if(list.length===0)fail('ROADMAP_MILESTONES_MISSING');
  if(!list.some(item=>item.title===milestone))fail('ROADMAP_CURRENT_MILESTONE_NOT_LISTED',milestone);

  return Object.freeze({
    schema:ROADMAP_SCHEMA,
    revision,
    updatedAt,
    status,
    current:Object.freeze({milestone,workPackage,phase}),
    milestones:list
  });
}

export function loadCanonicalRoadmap(projectContext){
  const repository=projectContext?.repository;
  if(!repository?.path)fail('ROADMAP_PROJECT_CONTEXT_INVALID');
  const sourcePath=join(repository.path,ROADMAP_SOURCE);
  if(!existsSync(sourcePath))fail('ROADMAP_SOURCE_MISSING',ROADMAP_SOURCE);
  let text;
  try{text=readFileSync(sourcePath,'utf8');}
  catch(error){fail('ROADMAP_SOURCE_READ_FAILED',error?.message||String(error));}
  const roadmap=parseRoadmapMarkdown(text);
  return Object.freeze({
    ...roadmap,
    authority:Object.freeze({
      projectId:projectContext.project.id,
      repositoryIdentity:repository.identity,
      repositoryHead:repository.head,
      source:ROADMAP_SOURCE
    })
  });
}
