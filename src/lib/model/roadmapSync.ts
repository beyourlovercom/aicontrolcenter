import type {RoadmapEvidence,RoadmapProgressSource,RoadmapSyncState,RoadmapSyncStatus} from './entityTypes.ts';
import {parseFormalWorkPackageRegistry} from '../taskEntityBinding.ts';

// Roadmap evidence is deliberately semantic: timestamps, HEADs and unrelated files are ignored.
function relevant(e:RoadmapEvidence):string{
  const phases=Object.entries(e.phaseEvidence??{}).sort().map(([id,value])=>`${id}:${value}`).join('|');
  const wps=Object.entries(e.workPackages??{}).sort().map(([id,wp])=>`${id}:${wp.title}|${Object.entries(wp.fields??{}).sort().map(([k,v])=>`${k}=${v}`).join(',')}`).join('|');
  const roadmap=e.content.replace(/<!--.*?-->/gs,'').split('\n').filter(line=>/^###\s+M\d+(?:\.\d+)?\s+—|\s*Work Packages?:|`[^`\s]+`\s+—\s+`?[A-Za-z][A-Za-z0-9_ /-]*`?[;:,]|\s*Phase\s+\d+|\s*Current (Phase|Work Package):/i.test(line)).map(line=>line.trim().replace(/\s+/g,' ')).join('\n');
  return `${roadmap}\n${phases}\n${wps}`;
}
function relevantSet(e:RoadmapEvidence):Set<string>{
  const text=relevant(e);
  return new Set([
    ...[...text.matchAll(/\bM\d+(?:\.\d+)?\b/g)].map(match=>`milestone:${match[0]}`),
    ...[...parseFormalWorkPackageRegistry(e.content).keys()].map(id=>`wp:${id}`),
    ...Object.entries(e.phaseEvidence??{}).map(([id,value])=>`phase:${id}:${value}`),
  ]);
}
function phaseMap(e:RoadmapEvidence){return Object.fromEntries(Object.entries(e.phaseEvidence??{}));}
export function resolveRoadmapSyncState(localEvidence:RoadmapEvidence,githubEvidence:RoadmapEvidence|null,updatedAt=new Date().toISOString()):RoadmapSyncState{
  if(!githubEvidence)return {localEvidence,githubEvidence:null,syncStatus:'SYNCED',currentProgressSource:'Local + GitHub',updatedAt};
  const local= relevant(localEvidence), github=relevant(githubEvidence);
  if(local===github)return {localEvidence,githubEvidence,syncStatus:'SYNCED',currentProgressSource:'Local + GitHub',updatedAt};
  const localSet=relevantSet(localEvidence), githubSet=relevantSet(githubEvidence);
  const localContained=[...localSet].every(item=>githubSet.has(item));
  const githubContained=[...githubSet].every(item=>localSet.has(item));
  if(localContained&&!githubContained)return {localEvidence,githubEvidence,syncStatus:'GITHUB_AHEAD',currentProgressSource:'GitHub',updatedAt};
  if(githubContained&&!localContained)return {localEvidence,githubEvidence,syncStatus:'LOCAL_AHEAD',currentProgressSource:'Local',updatedAt};
  const lp=phaseMap(localEvidence),gp=phaseMap(githubEvidence);
  const localOnly=Object.keys(lp).some(k=>lp[k]!==gp[k]);
  const githubOnly=Object.keys(gp).some(k=>gp[k]!==lp[k]);
  const localPhase=Object.values(lp).join('|'), githubPhase=Object.values(gp).join('|');
  const localAhead=localOnly && (!githubOnly || localPhase>githubPhase);
  const githubAhead=githubOnly && (!localOnly || githubPhase>localPhase);
  const syncStatus:RoadmapSyncStatus=localAhead?'LOCAL_AHEAD':githubAhead?'GITHUB_AHEAD':'DIVERGED';
  const currentProgressSource:RoadmapProgressSource=syncStatus==='LOCAL_AHEAD'?'Local':syncStatus==='GITHUB_AHEAD'?'GitHub':syncStatus==='DIVERGED'?'Local / GitHub':'Local + GitHub';
  return {localEvidence,githubEvidence,syncStatus,currentProgressSource,updatedAt};
}
