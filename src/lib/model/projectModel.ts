import {prStages,type AiccStatus,type RoadmapNode} from '../workflow.ts';
import type {AiccProjectSnapshot,AuthorizationRecord,FormalWorkPackage,HumanUatRecord,LifecycleEvidenceRecord,PullRequestRecord,RepositoryState,RuntimeRecord,SourceValue} from './entityTypes.ts';
import {resolveLifecycleProgress,resolveRuntimeImplementationProgress,resolveStatusProgress} from '../progress.ts';
import {resolveAuthorizationForEntity} from '../context/authorizationResolver.ts';
import {resolveWorkPackageLifecycle} from '../context/lifecycleResolver.ts';

export type RawProjectSources={roadmap?:{content:string;source:string}|null;repository?:RepositoryState|null;formalWorkPackages?:Record<string,FormalWorkPackage>;authorization?:AuthorizationRecord|null;runtime?:RuntimeRecord|null;humanUat?:HumanUatRecord[];lifecycleEvidence?:LifecycleEvidenceRecord[];pullRequests?:PullRequestRecord[];localDevelopment?:boolean;sourceErrors?:Partial<Record<'roadmap'|'repository'|'formalWorkPackages'|'authorizations'|'runtime'|'pullRequests',string>>};
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
export const LOCAL_DEMO_PR:PullRequestRecord={id:'demo-local-pr-dual-panel-001',workPackageId:'AICC-V2-DUAL-PANEL-001',status:'WAITING_OWNER',fixture:true,sourceBranch:'demo/local-dual-panel',targetBranch:'main',headSha:'NOT_BOUND',commitEvidence:'LOCAL FIXTURE ONLY',reviewEvidence:'NOT_RUN',ciEvidence:'NOT_RUN',filesChanged:0,mergeability:'NOT_RUN',mergeResult:'NOT_RUN',mainVerification:'NOT_RUN'};
export function normalizeRoadmap(content:string,localDevelopment=false, pullRequests:PullRequestRecord[]=[],runtime:RuntimeRecord|null=null):RoadmapNode[]{
  const activeSection=content.split('## Active V2 Milestones')[1];
  const active=activeSection?.split('## Legacy Historical Milestones')[0]??'';
  const matches=[...active.matchAll(/^###\s+(M\d+(?:\.\d+)?)\s+—\s+(.+)\n([\s\S]*?)(?=^###\s+M\d+(?:\.\d+)?\s+—|$)/gm)];
  if(!activeSection||!matches.length)throw new Error('ROADMAP_PARSE_FAILED');
  return matches.map(match=>{const id=match[1],name=match[2].trim(),wpIds=[...match[3].matchAll(/`(AICC-[A-Z0-9-]+)`/g)].map(item=>item[1]);const children:RoadmapNode[]=wpIds.map(wpId=>{const prs=(localDevelopment?pullRequests:[]).filter(pr=>pr.workPackageId===wpId).map(pr=>{const stages=prStages.map(([stageId,label],index)=>({id:stageId,label,status:index===0?pr.status:'N_A',evidence:[]}));return {id:pr.id,type:'pull_request' as const,title:'PR #DEMO — Dual Panel Fixture',status:pr.status,progress:resolveLifecycleProgress(stages),parentId:wpId,children:[]}});const status=workPackageStatus(wpId),progress=runtime?.workPackageId===wpId?resolveRuntimeImplementationProgress(runtime):resolveStatusProgress(status);return {id:wpId,type:'work_package' as const,title:wpId,status,progress,parentId:id,children:prs}});const status=id==='M1'&&children.some(child=>child.status==='WAITING_UAT')?'IN_PROGRESS':resolveMilestoneStatus(children);return {id,type:'milestone' as const,title:`${id} — ${name}`,status,progress:children.length?Math.round(children.reduce((sum,child)=>sum+(child.progress??0),0)/children.length):0,parentId:null,children};});
}

const CURRENT_UAT:HumanUatRecord[]=[{repository:'local',workPackageId:'AICC-V2-UI-WORKFLOW-001',entityType:'work_package',status:'IN_PROGRESS',ownerLabel:'Owner',items:[],createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:00:00.000Z',source:'existing Owner UI UAT evidence'}];
function reconcileRoadmapLifecycle(snapshot:AiccProjectSnapshot):AiccProjectSnapshot{
  if(snapshot.roadmap.availability!=='AVAILABLE'||!snapshot.roadmap.value)return snapshot;
  const roadmap=snapshot.roadmap.value.map(milestone=>{const children=milestone.children.map(node=>{
    if(node.type!=='work_package')return node;
    const formal=snapshot.formalWorkPackages.value?.[node.id];
    if(!formal)return node;
    const authorization=resolveAuthorizationForEntity({type:'work_package',id:node.id},snapshot);
    const formalization=snapshot.formalWorkPackages.availability==='UNAVAILABLE'?'FORMAL_INVALID':'FORMAL_READY';
    const lifecycle=resolveWorkPackageLifecycle(node.id,formalization,authorization,snapshot);
    return {...node,status:lifecycle.effectiveStatus,progress:resolveLifecycleProgress(lifecycle.stages)};
  });
  const status=resolveMilestoneStatus(children);
  const values=children.filter(child=>child.type==='work_package').map(child=>child.progress).filter((value):value is number=>typeof value==='number');
  return {...milestone,status,progress:values.length?Math.round(values.reduce((sum,value)=>sum+value,0)/values.length):0,children};});
  return {...snapshot,roadmap:{...snapshot.roadmap,value:roadmap}};
}
export function createProjectSnapshot(raw:RawProjectSources):AiccProjectSnapshot{
  const active=raw.runtime&&['STARTING','RUNNING','STOPPING'].includes(raw.runtime.phase);
  const snapshot:AiccProjectSnapshot={
    roadmap:raw.sourceErrors?.roadmap?unavailable(raw.sourceErrors.roadmap):raw.roadmap?available(normalizeRoadmap(raw.roadmap.content,raw.localDevelopment===true,raw.pullRequests??(raw.localDevelopment===true?[LOCAL_DEMO_PR]:[]),raw.runtime??null)):unavailable('ROADMAP_UNAVAILABLE'),
    repository:raw.repository?available(raw.repository):unavailable(raw.sourceErrors?.repository??'REPOSITORY_UNAVAILABLE'),
    formalWorkPackages:raw.sourceErrors?.formalWorkPackages?unavailable(raw.sourceErrors.formalWorkPackages):available(raw.formalWorkPackages??{}),
    authorizations:raw.sourceErrors?.authorizations?unavailable(raw.sourceErrors.authorizations):available(raw.authorization?[raw.authorization]:[]),
    runtime:raw.sourceErrors?.runtime?unavailable(raw.sourceErrors.runtime):available(raw.runtime??null),
    writerLock:available({status:active?'HELD':'NOT_HELD',scope:'repository',...(active&&raw.runtime?{workPackageId:raw.runtime.workPackageId}:{})}),
    humanUat:available(raw.humanUat??CURRENT_UAT),lifecycleEvidence:available(raw.lifecycleEvidence??[]),pullRequests:raw.sourceErrors?.pullRequests?unavailable(raw.sourceErrors.pullRequests):available(raw.localDevelopment===true?(raw.pullRequests??[LOCAL_DEMO_PR]):(raw.pullRequests??[])),roadmapSource:raw.roadmap?.source??'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md'
  };
  return reconcileRoadmapLifecycle(snapshot);
}
