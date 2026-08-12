import {prStages,statusText,type AiccStatus,type RoadmapNode} from '../workflow.ts';
import type {AiccProjectSnapshot,FormalizationState,MilestoneEntityContext,ResolvedEntityContext,SelectedEntityRef,WorkPackageEntityContext} from '../model/entityTypes.ts';
import {resolveAuthorizationForEntity} from './authorizationResolver.ts';
import {resolveWorkPackageLifecycle} from './lifecycleResolver.ts';
import {resolveAvailableActions} from './actionEligibility.ts';
import {resolveLifecycleProgress,resolveMilestoneProgress} from '../progress.ts';

function findNode(nodes:RoadmapNode[],selected:SelectedEntityRef){for(const milestone of nodes){if(milestone.id===selected.id)return milestone;const child=milestone.children.find(item=>item.id===selected.id);if(child)return child;}return null;}
function milestoneContext(snapshot:AiccProjectSnapshot,entity:Extract<SelectedEntityRef,{type:'milestone'}>,node:RoadmapNode):MilestoneEntityContext{
  const wps=node.children.filter(child=>child.type==='work_package'),prs=node.children.filter(child=>child.type==='pull_request');
  const complete=wps.filter(child=>['COMPLETE','PASS'].includes(child.status)).length,waiting=wps.filter(child=>['WAITING_OWNER','WAITING_UAT','IN_PROGRESS'].includes(child.status)).length,blocked=wps.filter(child=>['BLOCKED','FAILED'].includes(child.status)).length;
  return {entity,type:'milestone',id:node.id,title:node.title,displayTitle:node.title,status:node.status,statusLabel:statusText(node.status),progress:resolveMilestoneProgress(wps.map(child=>child.progress)),breadcrumb:`Control Center / Roadmap / ${node.id}`,evidence:[`Roadmap source: ${snapshot.roadmapSource}`],availableActions:resolveAvailableActions(entity,snapshot),goal:'完成当前里程碑下的必需 Work Package，并保留真实可核验的证据。',dependencies:'依赖子 Work Package 的有效状态与 Owner 决策。',children:node.children,summary:{workPackages:wps.length,complete,waiting,blocked,pullRequests:prs.filter(pr=>!((snapshot.pullRequests.value??[]).find(item=>item.id===pr.id)?.fixture)).length},blockers:blocked?['存在阻塞或失败的 Work Package。']:[],nextAction:node.status==='WAITING_UAT'?'Owner 完成当前 Human UAT。':node.status==='IN_PROGRESS'?'继续当前进行中的 Work Package。':'等待前置条件。',recentActivity:`${node.id} · ${statusText(node.status)}`};
}
export function resolveEntityContext(snapshot:AiccProjectSnapshot,selected:SelectedEntityRef):ResolvedEntityContext{
  const nodes=snapshot.roadmap.value??[],node=findNode(nodes,selected);
  if(selected.type==='milestone')return milestoneContext(snapshot,selected,node??{id:selected.id,type:'milestone',title:selected.id,status:'NOT_STARTED',progress:0,parentId:null,children:[]});
  if(selected.type==='pull_request'){const record=(snapshot.pullRequests.value??[]).find(pr=>pr.id===selected.id)??null;const parent=record?.workPackageId??node?.parentId??null;const status=record?.status??'NOT_STARTED';const stages=prStages.map(([id,label],index)=>({id,label,status:index===0?status:'N_A',evidence:record?[`PR context: ${record.id}`]:[]}));return {entity:selected,type:'pull_request',id:selected.id,title:record?.fixture?'PR #DEMO — Dual Panel Fixture':selected.id,displayTitle:record?.fixture?'PR #DEMO — Dual Panel Fixture':selected.id,status,statusLabel:statusText(status),progress:resolveLifecycleProgress(stages),breadcrumb:`Control Center / Roadmap / ${parent??'M1'} / ${selected.id}`,evidence:record?.fixture?['DEMO','LOCAL FIXTURE','Production PR evidence absent']:['Production PR evidence absent'],availableActions:resolveAvailableActions(selected,snapshot),parentWorkPackageId:parent,record,stages,currentStage:stages[0].id,tabs:['概览','流程','运行','Diff','Review','CI','Merge','证据']};}
  const formal=snapshot.formalWorkPackages.value?.[selected.id]??null;
  const formalization:FormalizationState=snapshot.formalWorkPackages.availability==='UNAVAILABLE'||snapshot.formalWorkPackageReadError?.startsWith('FORMAL_WP_INVALID')?'FORMAL_INVALID':formal?'FORMAL_READY':'PLANNED_ONLY';
  const authorization=resolveAuthorizationForEntity(selected,snapshot),lifecycle=resolveWorkPackageLifecycle(selected.id,formalization,authorization,snapshot);
  const parent=nodes.find(milestone=>milestone.children.some(child=>child.id===selected.id))??null;
  const runtime=snapshot.runtime.value?.workPackageId===selected.id?snapshot.runtime.value:null;
  const humanUat=snapshot.humanUat.value?.find(item=>item.workPackageId===selected.id)??null;
  const writerLock=snapshot.writerLock.value??{status:'UNAVAILABLE' as const,scope:'repository' as const};
  const context:WorkPackageEntityContext={entity:selected,type:'work_package',id:selected.id,title:formal?.title??node?.title??selected.id,displayTitle:selected.id,status:lifecycle.effectiveStatus,statusLabel:statusText(lifecycle.effectiveStatus),progress:resolveLifecycleProgress(lifecycle.stages),breadcrumb:`Control Center / Roadmap / ${selected.id}`,evidence:[`Roadmap source: ${snapshot.roadmapSource}`],availableActions:[],parentMilestone:parent,formalization,formalWorkPackage:formal,lifecycle,authorization,runtime,writerLock,humanUat,relatedPullRequests:(snapshot.pullRequests.value??[]).filter(pr=>pr.workPackageId===selected.id)};
  context.availableActions=resolveAvailableActions(selected,snapshot,formalization,lifecycle,authorization);return context;
}
