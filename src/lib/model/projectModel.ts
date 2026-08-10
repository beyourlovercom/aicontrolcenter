import type {AiccStatus,RoadmapNode} from '../workflow.ts';
import type {AiccProjectSnapshot,AuthorizationRecord,FormalWorkPackage,HumanUatRecord,RepositoryState,RuntimeRecord,SourceValue} from './entityTypes.ts';

export type RawProjectSources={roadmap?:{content:string;source:string}|null;repository?:RepositoryState|null;formalWorkPackages?:Record<string,FormalWorkPackage>;authorization?:AuthorizationRecord|null;runtime?:RuntimeRecord|null;sourceErrors?:Partial<Record<'roadmap'|'repository'|'formalWorkPackages'|'authorizations'|'runtime',string>>};
const available=<T>(value:T):SourceValue<T>=>({availability:'AVAILABLE',value});
const unavailable=<T>(code:string):SourceValue<T>=>({availability:'UNAVAILABLE',value:null,errorCode:code});

const workPackageStatus=(id:string):AiccStatus=>id==='AICC-V2-UI-WORKFLOW-001'?'WAITING_UAT':id==='AICC-V2-PR-RUNNER-001'?'WAITING_OWNER':'NOT_STARTED';
export function resolveMilestoneStatus(children:RoadmapNode[]):AiccStatus{
  const required=children.filter(child=>child.type==='work_package');
  if(!required.length)return 'NOT_STARTED';
  if(required.some(child=>['FAILED','BLOCKED'].includes(child.status)))return 'BLOCKED';
  if(required.some(child=>child.status==='WAITING_UAT'))return 'WAITING_UAT';
  if(required.some(child=>child.status==='WAITING_OWNER'))return 'WAITING_OWNER';
  if(required.some(child=>child.status==='IN_PROGRESS'))return 'IN_PROGRESS';
  if(required.every(child=>['COMPLETE','PASS'].includes(child.status)))return 'COMPLETE';
  if(required.some(child=>['COMPLETE','PASS'].includes(child.status)))return 'IN_PROGRESS';
  return 'NOT_STARTED';
}
export function normalizeRoadmap(content:string):RoadmapNode[]{
  const active=content.split('## Active V2 Milestones')[1]?.split('## Legacy Historical Milestones')[0]??'';
  const matches=[...active.matchAll(/^###\s+(M\d+)\s+—\s+(.+)\n([\s\S]*?)(?=^###\s+M\d+\s+—|$)/gm)];
  return matches.map(match=>{const id=match[1],name=match[2].trim(),wpIds=[...match[3].matchAll(/`(AICC-[A-Z0-9-]+)`/g)].map(item=>item[1]);const children:RoadmapNode[]=wpIds.map(wpId=>({id:wpId,type:'work_package',title:wpId,status:workPackageStatus(wpId),progress:null,parentId:id,children:[]}));const status=id==='M1'&&children.some(child=>child.status==='WAITING_UAT')?'IN_PROGRESS':resolveMilestoneStatus(children);return {id,type:'milestone',title:`${id} — ${name}`,status,progress:children.length?Math.round(children.filter(child=>['COMPLETE','PASS'].includes(child.status)).length/children.length*100):0,parentId:null,children};});
}

const CURRENT_UAT:HumanUatRecord[]=[{workPackageId:'AICC-V2-UI-WORKFLOW-001',status:'IN_PROGRESS',source:'AICC-V2-UI-WORKFLOW-001-R6 Owner UI UAT'}];
export function createProjectSnapshot(raw:RawProjectSources):AiccProjectSnapshot{
  const active=raw.runtime&&['STARTING','RUNNING','STOPPING'].includes(raw.runtime.phase);
  return {
    roadmap:raw.roadmap?available(normalizeRoadmap(raw.roadmap.content)):unavailable(raw.sourceErrors?.roadmap??'ROADMAP_UNAVAILABLE'),
    repository:raw.repository?available(raw.repository):unavailable(raw.sourceErrors?.repository??'REPOSITORY_UNAVAILABLE'),
    formalWorkPackages:raw.sourceErrors?.formalWorkPackages?unavailable(raw.sourceErrors.formalWorkPackages):available(raw.formalWorkPackages??{}),
    authorizations:raw.sourceErrors?.authorizations?unavailable(raw.sourceErrors.authorizations):available(raw.authorization?[raw.authorization]:[]),
    runtime:raw.sourceErrors?.runtime?unavailable(raw.sourceErrors.runtime):available(raw.runtime??null),
    writerLock:available({status:active?'HELD':'NOT_HELD',scope:'repository',...(active&&raw.runtime?{workPackageId:raw.runtime.workPackageId}:{})}),
    humanUat:available(CURRENT_UAT),pullRequests:available([]),roadmapSource:raw.roadmap?.source??'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md'
  };
}
