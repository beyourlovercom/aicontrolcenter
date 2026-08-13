import {statusText,type AiccStatus} from '../workflow.ts';
import type {ResolvedEntityContext,SelectedEntityRef} from '../model/entityTypes.ts';
import type {RoadmapNode} from '../workflow.ts';

type ReportLike={state?:string;report?:{runId?:string}};

export function resolveOwnerStatusProjection(context:ResolvedEntityContext,reports:ReportLike[]=[]):{status:AiccStatus;label:string;hasRealBlocker:boolean}{
  if(context.type!=='work_package')return {status:context.status,label:context.statusLabel,hasRealBlocker:context.status==='BLOCKED'||context.status==='FAILED'};
  const reportReady=Boolean(context.runtime?.runId&&reports.some(item=>item.state==='READY'&&item.report?.runId===context.runtime?.runId));
  const completedSuccessfully=context.runtime?.phase==='COMPLETED'&&context.runtime.exitCode===0;
  const runtimeCompletionTruth=completedSuccessfully&&reportReady;
  const hasRealBlocker=context.lifecycle.stages.some(stage=>stage.status==='BLOCKED'||stage.status==='FAILED')&&!runtimeCompletionTruth;
  if(hasRealBlocker)return {status:context.status,label:context.statusLabel,hasRealBlocker:true};
  if(completedSuccessfully&&reportReady)return {status:'WAITING_UAT',label:statusText('WAITING_UAT'),hasRealBlocker:false};
  if(context.formalization==='FORMAL_READY'&&context.status==='BLOCKED')return {status:'WAITING_OWNER',label:statusText('WAITING_OWNER'),hasRealBlocker:false};
  return {status:context.status,label:context.statusLabel,hasRealBlocker:false};
}

export function resolveOwnerWorkflowStages(context:ResolvedEntityContext,reports:ReportLike[]=[]){
  if(context.type!=='work_package')return context.type==='pull_request'?context.stages:[];
  const reportReady=Boolean(context.runtime?.runId&&reports.some(item=>item.state==='READY'&&item.report?.runId===context.runtime?.runId));
  const completedSuccessfully=context.runtime?.phase==='COMPLETED'&&context.runtime.exitCode===0&&reportReady;
  return context.lifecycle.stages.map(stage=>completedSuccessfully&&(stage.status==='BLOCKED'||stage.status==='FAILED')?{...stage,status:'COMPLETE' as const}:stage);
}

export function projectOwnerRoadmapNodes(nodes:RoadmapNode[],selected:SelectedEntityRef,projection:{status:AiccStatus}) :RoadmapNode[]{
  return nodes.map(node=>({...node,status:node.id===selected.id&&node.type===selected.type?projection.status:node.status,children:projectOwnerRoadmapNodes(node.children,selected,projection)}));
}
