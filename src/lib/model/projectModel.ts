import type {AiccStatus,RoadmapNode} from '../workflow.ts';
import {resolveRoadmapSyncState} from './roadmapSync.ts';
import type {AiccProjectSnapshot,AuthorizationRecord,FormalWorkPackage,HumanUatRecord,LifecycleEvidenceRecord,PullRequestRecord,RepositoryState,RuntimeRecord,SourceValue,WorkPackagePhaseProgress,WorkPackagePhaseStatus} from './entityTypes.ts';
import {resolveProgressTruthState} from './progressTruth.ts';
import type {CiEvidence,ReviewEvidence} from '../exactHeadEvidence.ts';
import {extractRoadmapMilestoneWorkPackageIds,extractRoadmapWorkPackageTitle} from '../taskEntityBinding.ts';

export type EntityDisplayMetadata={repositoryKey:string;entityType:'milestone'|'work_package'|'pull_request';entityId:string;description:string;updatedAt?:string;updatedBy?:'owner'};
export type RawProjectSources={roadmap?:{content:string;source:string}|null;roadmapNodes?:RoadmapNode[];githubRoadmap?:{content:string;source?:string}|null;repository?:RepositoryState|null;formalWorkPackages?:Record<string,FormalWorkPackage>;entityDescriptions?:EntityDisplayMetadata[];authorization?:AuthorizationRecord|null;runtime?:RuntimeRecord|null;humanUat?:HumanUatRecord[];lifecycleEvidence?:LifecycleEvidenceRecord[];pullRequests?:PullRequestRecord[];reviewEvidence?:ReviewEvidence[];ciEvidence?:CiEvidence[];localDevelopment?:boolean;sourceErrors?:Partial<Record<'roadmap'|'repository'|'formalWorkPackages'|'formalWorkPackageRead'|'authorizations'|'runtime'|'pullRequests',string>>};
const available=<T>(value:T):SourceValue<T>=>({availability:'AVAILABLE',value});
const unavailable=<T>(code:string):SourceValue<T>=>({availability:'UNAVAILABLE',value:null,errorCode:code});

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
const escapeRegExp=(value:string)=>value.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
export function resolveWorkPackagePhaseProgress(content:string,workPackageId:string,milestoneId=''):WorkPackagePhaseProgress|null{const escapedId=escapeRegExp(workPackageId);const block=content.match(new RegExp(`^###\\s+${escapedId}\\s+Phase Plan\\s*\\n([\\s\\S]*?)(?=^###\\s|(?![\\s\\S]))`,'mi'))?.[1]??content.match(new RegExp('^`'+escapedId+'`\\s+—\\s+`?[A-Za-z][A-Za-z0-9_ /-]*`?[;:,][^\\n]*\\n([\\s\\S]*?)(?=^`[^`\\s]+`\\s+—\\s+`?[A-Za-z][A-Za-z0-9_ /-]*`?[;:,]|^###\\s+M\\d|^##\\s|(?![\\s\\S]))','mi'))?.[1]??'';if(!block)return null;const phases=[...block.matchAll(/^Phase\s+(\d+)\s+[—-]\s+(.+?)\s+\[([^\]]+)\]\s*$/gmi)].map(match=>{const exact=match[3].trim().toUpperCase();return {number:Number(match[1]),title:match[2].trim(),status:(exact==='COMPLETE'?'COMPLETE':exact==='ACTIVE'||exact==='CURRENT'?'ACTIVE':'PENDING') as WorkPackagePhaseStatus}});if(!phases.length)return null;const current=phases.find(item=>item.status==='ACTIVE')??null;return {workPackageId,milestoneId,totalPhases:phases.length,completedCount:phases.filter(item=>item.status==='COMPLETE').length,currentPhaseNumber:current?.number??null,currentPhaseTitle:current?.title??null,phases};}

function canonicalStatus(value:string|undefined):{status:AiccStatus;canonicalStatus:string}{
  const exact=value?.trim().replace(/^`|`$/g,'')||'UNAVAILABLE';
  const token=exact.toUpperCase().split(/[\s/;,]+/)[0];
  if(['COMPLETE','COMPLETED','CLOSED','MERGED','DONE','PASS'].includes(token))return {status:'COMPLETE',canonicalStatus:exact};
  if(['BLOCKED','FAILED','ERROR'].includes(token))return {status:token==='FAILED'||token==='ERROR'?'FAILED':'BLOCKED',canonicalStatus:exact};
  if(['ACTIVE','CURRENT','IN_PROGRESS','RUNNING','READY','PLANNED','PENDING'].includes(token))return {status:token==='PLANNED'||token==='PENDING'?'NOT_STARTED':'IN_PROGRESS',canonicalStatus:exact};
  if(token==='WAITING_OWNER')return {status:'WAITING_OWNER',canonicalStatus:exact};
  if(token==='WAITING_UAT')return {status:'WAITING_UAT',canonicalStatus:exact};
  return {status:'NOT_STARTED',canonicalStatus:exact};
}

function explicitMetadata(block:string):{status:AiccStatus;canonicalStatus:string;progress:number|null}{
  const statusValue=block.match(/^Status:\s*`?([^`\n]+)`?\s*$/mi)?.[1];
  const progressValue=block.match(/^Progress:\s*`?(\d{1,3})%?`?\s*$/mi)?.[1];
  const parsedProgress=progressValue===undefined?null:Number(progressValue);
  return {...canonicalStatus(statusValue),progress:typeof parsedProgress==='number'&&Number.isInteger(parsedProgress)&&parsedProgress>=0&&parsedProgress<=100?parsedProgress:null};
}

export function normalizeRoadmap(content:string,localDevelopment=false, pullRequests:PullRequestRecord[]=[],runtime:RuntimeRecord|null=null,formalWorkPackages:Record<string,FormalWorkPackage>={},entityDescriptions:EntityDisplayMetadata[]=[]):RoadmapNode[]{
  const activeSection=content.split('## Active V2 Milestones')[1];
  const active=activeSection?.split('## Legacy Historical Milestones')[0]??'';
  const milestones=[...active.matchAll(/^###\s+(M\d+)\s+—\s+(.+)$/gm)];
  if(!activeSection||!milestones.length)throw new Error('ROADMAP_PARSE_FAILED');
  const effectivePullRequests=localDevelopment?(pullRequests.length?pullRequests:[LOCAL_DEMO_PR]):pullRequests.filter(pr=>pr.fixture!==true);
  const descriptionFor=(entityType:EntityDisplayMetadata['entityType'],entityId:string)=>entityDescriptions.find(item=>item.entityType===entityType&&item.entityId===entityId)?.description.trim()||'';
  return milestones.map((match,milestoneOrder)=>{
    const id=match[1],name=match[2].trim(),bodyStart=(match.index??0)+match[0].length,bodyEnd=milestones[milestoneOrder+1]?.index??active.length,body=active.slice(bodyStart,bodyEnd);
    const groupPattern=new RegExp(`^#{3,6}\\s+(?:M)?(${id.slice(1)}\\.\\d+)\\s+—\\s+(.+)$`,'gm');
    const groupMatches=[...body.matchAll(groupPattern)];
    const milestoneMeta=explicitMetadata(body.slice(0,groupMatches[0]?.index??body.length));
    const segments=[
      {body:body.slice(0,groupMatches[0]?.index??body.length),groupNumber:undefined,groupTitle:undefined},
      ...groupMatches.map((group,index)=>({body:body.slice((group.index??0)+group[0].length,groupMatches[index+1]?.index??body.length),groupNumber:group[1],groupTitle:group[2].trim()}))
    ];
    const workPackages=segments.flatMap(segment=>extractRoadmapMilestoneWorkPackageIds(segment.body).map(wpId=>({wpId,...segment}))).filter((entry,index,all)=>all.findIndex(candidate=>candidate.wpId===entry.wpId)===index);
    const children:RoadmapNode[]=workPackages.map(({wpId,body:wpBody,groupNumber,groupTitle},wpOrder)=>{
      const wpTitle=descriptionFor('work_package',wpId)||formalWorkPackages[wpId]?.title?.trim()||extractRoadmapWorkPackageTitle(body,wpId)||wpId;
      const wpLine=wpBody.split('\n').find(line=>line.includes(wpId))??'';
      const inlineStatus=wpLine.match(new RegExp(`${wpId}[^\\n]*?\\x60([A-Z][A-Z0-9_ /-]+)\\x60`))?.[1];
      const wpSection=content.match(new RegExp(`^###\\s+${wpId}\\s+Phase Plan\\s*\\n([\\s\\S]*?)(?=^###\\s|(?![\\s\\S]))`,'mi'))?.[1]??'';
      const wpMeta=inlineStatus?{...canonicalStatus(inlineStatus),progress:null}:explicitMetadata(wpSection);
      const phaseProgress=resolveWorkPackagePhaseProgress(content,wpId,id);
      const phases=(phaseProgress?.phases??[]).map((phase,phaseOrder)=>{const phaseState=canonicalStatus(phase.status);return {id:`${wpId}:phase:${phase.number}`,type:'phase' as const,title:phase.title,displayCode:`Phase ${phase.number}`,displayTitle:phase.title,...phaseState,progress:null,parentId:wpId,parentWpId:wpId,ordering:phaseOrder,hasChildren:false,children:[]}});
      const prs=effectivePullRequests.filter(pr=>pr.workPackageId===wpId).map((pr,prOrder)=>{const prTitle=descriptionFor('pull_request',pr.id)||pr.title?.trim()||(pr.number?`PR #${pr.number}`:pr.id||'PR');const exactReference=pr.number?body.search(new RegExp(`PR\\s*#?${pr.number}\\b`,'i')):-1;return {id:pr.id,type:'pull_request' as const,title:prTitle,displayCode:pr.number?`PR${pr.number}`:'PR',displayTitle:prTitle.replace(/^PR\s*#?\d+\s*[—–·:-]?\s*/i,''),...canonicalStatus('UNAVAILABLE'),progress:null,parentId:wpId,parentWpId:wpId,ordering:exactReference>=0?exactReference:10000+prOrder,hasChildren:false,children:[]}});
      const orderedChildren=[...phases,...prs].sort((left,right)=>(left.ordering??0)-(right.ordering??0));
      return {id:wpId,type:'work_package' as const,title:wpTitle,displayCode:'WP',displayTitle:wpTitle,...wpMeta,parentId:id,parentWpId:null,ordering:wpOrder,hasChildren:orderedChildren.length>0,children:orderedChildren,phaseProgress,resolution:formalWorkPackages[wpId]?'RESOLVED':'UNRESOLVED',roadmapGroupNumber:groupNumber,roadmapGroupTitle:groupTitle};
    });
    return {id,type:'milestone' as const,title:name,displayCode:id,displayTitle:name,...milestoneMeta,parentId:null,parentWpId:null,ordering:milestoneOrder,hasChildren:children.length>0,children,roadmapGroups:groupMatches.map(group=>({number:group[1],title:group[2].trim()}))};
  });
}
export function mergeRoadmapNodes(primary:RoadmapNode[], secondary:RoadmapNode[]):RoadmapNode[]{
  const byMilestone=new Map(primary.map(node=>[node.id,node]));
  for(const incoming of secondary){
    const existing=byMilestone.get(incoming.id);
    if(!existing){byMilestone.set(incoming.id,incoming);continue;}
    const children=new Map(existing.children.map(child=>[child.id,child]));
    for(const child of incoming.children)if(!children.has(child.id))children.set(child.id,child);
    byMilestone.set(existing.id,{...existing,children:[...children.values()]});
  }
  return [...byMilestone.values()].sort(compareMilestoneIdentity);
}

export function compareMilestoneIdentity(left:RoadmapNode,right:RoadmapNode):number{
  const leftNumber=Number(left.id.slice(1)),rightNumber=Number(right.id.slice(1));
  if(Number.isFinite(leftNumber)&&Number.isFinite(rightNumber)&&leftNumber!==rightNumber)return leftNumber-rightNumber;
  return left.id.localeCompare(right.id,undefined,{numeric:true});
}

export function createProjectSnapshot(raw:RawProjectSources):AiccProjectSnapshot{
  const active=raw.runtime&&['STARTING','RUNNING','STOPPING'].includes(raw.runtime.phase);
  const projectedRoadmap=raw.roadmapNodes??(raw.roadmap?mergeRoadmapNodes(normalizeRoadmap(raw.roadmap.content,raw.localDevelopment===true,raw.pullRequests??(raw.localDevelopment===true?[LOCAL_DEMO_PR]:[]),raw.runtime??null,raw.formalWorkPackages??{},raw.entityDescriptions??[]),raw.githubRoadmap?normalizeRoadmap(raw.githubRoadmap.content,false,raw.pullRequests??[],raw.runtime??null,raw.formalWorkPackages??{},raw.entityDescriptions??[]):[]):null);
  const snapshot:AiccProjectSnapshot={
    roadmap:raw.sourceErrors?.roadmap?unavailable(raw.sourceErrors.roadmap):projectedRoadmap?available(projectedRoadmap):unavailable('ROADMAP_UNAVAILABLE'),
    repository:raw.repository?available(raw.repository):unavailable(raw.sourceErrors?.repository??'REPOSITORY_UNAVAILABLE'),
    formalWorkPackages:raw.sourceErrors?.formalWorkPackages?unavailable(raw.sourceErrors.formalWorkPackages):available(raw.formalWorkPackages??{}),
    authorizations:raw.sourceErrors?.authorizations?unavailable(raw.sourceErrors.authorizations):available(raw.authorization?[raw.authorization]:[]),
    runtime:raw.sourceErrors?.runtime?unavailable(raw.sourceErrors.runtime):available(raw.runtime??null),
    writerLock:available({status:active?'HELD':'NOT_HELD',scope:'repository',...(active&&raw.runtime?{workPackageId:raw.runtime.workPackageId}:{})}),
    reviewEvidence:available(raw.reviewEvidence??[]),ciEvidence:available(raw.ciEvidence??[]),
    humanUat:available(raw.humanUat??[]),lifecycleEvidence:available(raw.lifecycleEvidence??[]),pullRequests:raw.sourceErrors?.pullRequests?unavailable(raw.sourceErrors.pullRequests):available(raw.localDevelopment===true?(raw.pullRequests??[LOCAL_DEMO_PR]):(raw.pullRequests??[]).filter(pr=>pr.fixture!==true)),roadmapSource:raw.roadmap?.source??'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',roadmapSync:resolveRoadmapSyncState({content:raw.roadmap?.content??''},raw.githubRoadmap?{content:raw.githubRoadmap.content}:null),formalWorkPackageReadError:raw.sourceErrors?.formalWorkPackageRead,progressTruth:{}
  };
  const reconciled=snapshot;
  const progressTruth:Record<string,ReturnType<typeof resolveProgressTruthState>>={};
  const nodes=reconciled.roadmap.value??[];
  for(const milestone of nodes)for(const node of milestone.children)if(node.type==='work_package'){const truth=resolveProgressTruthState({entityId:node.id,milestoneId:milestone.id,workPackageId:node.id,roadmap:node.phaseProgress??null,runtime:raw.runtime?.workPackageId===node.id?raw.runtime:null,codexResult:raw.runtime?.workPackageId===node.id?raw.runtime.canonicalResult??null:null,uat:raw.humanUat?.find(item=>item.workPackageId===node.id)??null,lifecycleEvidence:raw.lifecycleEvidence?.find(item=>item.workPackageId===node.id)??null,roadmapSync:reconciled.roadmapSync});progressTruth[node.id]=truth;node.phaseProgress=truth.phaseStatuses.length?{...(node.phaseProgress??{workPackageId:node.id,milestoneId:milestone.id,totalPhases:truth.phaseStatuses.length,completedCount:0,currentPhaseNumber:null,currentPhaseTitle:null}),phases:truth.phaseStatuses,totalPhases:truth.phaseStatuses.length,completedCount:truth.phaseStatuses.filter(phase=>phase.status==='COMPLETE').length,currentPhaseNumber:truth.currentPhaseNumber,currentPhaseTitle:truth.currentPhaseTitle}:node.phaseProgress;}
  return {...reconciled,progressTruth};
}
