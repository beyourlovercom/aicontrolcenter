import type {AiccStatus} from '../workflow.ts';
import type {ResolvedEntityContext,SelectedEntityRef} from '../model/entityTypes.ts';
import type {RoadmapNode} from '../workflow.ts';

type ReportLike={state?:string;report?:{runId?:string}};

export function resolveOwnerStatusProjection(context:ResolvedEntityContext,_reports:ReportLike[]=[]):{status:AiccStatus;label:string;hasRealBlocker:boolean}{
  return {status:context.status,label:context.statusLabel,hasRealBlocker:context.status==='BLOCKED'||context.status==='FAILED'};
}

export function resolveOwnerWorkflowStages(context:ResolvedEntityContext,reports:ReportLike[]=[]){
  void reports;
  if(context.type!=='work_package')return context.type==='pull_request'?context.stages:[];
  return context.lifecycle.stages;
}

export function projectOwnerRoadmapNodes(nodes:RoadmapNode[],selected:SelectedEntityRef,projection:{status:AiccStatus}) :RoadmapNode[]{
  return nodes.map(node=>({...node,status:node.id===selected.id&&node.type===selected.type?projection.status:node.status,children:projectOwnerRoadmapNodes(node.children,selected,projection)}));
}
