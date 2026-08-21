import {statusText,type AiccStatus,type RoadmapNode} from './workflow.ts';

export type RoadmapStatusVisualFamily='BLOCKED'|'ACTIVE'|'COMPLETE';
export type CollapsedNodeIds=Set<string>;
export const roadmapGroupKey=(parentId:string,groupNumber:string)=>`roadmap-group:${parentId}:${groupNumber}`;

export function toggleCollapsedNode(collapsedNodeIds:CollapsedNodeIds,id:string):CollapsedNodeIds{
  const next=new Set(collapsedNodeIds);
  if(next.has(id))next.delete(id);else next.add(id);
  return next;
}

export function roadmapEntityLabel(node:Pick<RoadmapNode,'id'|'title'|'displayCode'|'displayTitle'>):string{
  const code=(node.displayCode??node.id).trim();
  const title=(node.displayTitle??node.title).trim();
  return title?`${code} - ${title}`:code;
}

const completeStatuses=new Set(['COMPLETE','COMPLETED','MERGED','CLOSED','DONE','PASS']);
const blockedStatuses=new Set(['BLOCKED','FAILED','ERROR']);

export function mapRoadmapStatusToVisualFamily(status:string):RoadmapStatusVisualFamily{
  const normalized=status.trim().toUpperCase();
  if(blockedStatuses.has(normalized))return 'BLOCKED';
  if(completeStatuses.has(normalized))return 'COMPLETE';
  return 'ACTIVE';
}

export function roadmapStatusChineseLabel(status:string):string{
  const normalized=status.trim().toUpperCase();
  if(blockedStatuses.has(normalized))return normalized==='FAILED'||normalized==='ERROR'?'失败':'阻塞';
  if(completeStatuses.has(normalized))return '已完成';
  return statusText(normalized as AiccStatus)??'进行中';
}

export function normalizeRoadmapProgress(progress:number|null|undefined):number|null{
  return Number.isInteger(progress)&&progress!>=0&&progress!<=100?progress!:null;
}

export function roadmapProgressLabel(progress:number|null|undefined):string{
  const normalized=normalizeRoadmapProgress(progress);
  return normalized===null?'—':`${normalized}%`;
}

export function roadmapPath(nodes:RoadmapNode[],id:string,path:RoadmapNode[]=[]):RoadmapNode[]{
  for(const node of nodes){
    const current=[...path,node];
    if(node.id===id)return current;
    const found=roadmapPath(node.children,id,current);
    if(found.length)return found;
  }
  return [];
}

export function expandableRoadmapIds(nodes:RoadmapNode[]):string[]{
  return nodes.flatMap(node=>{
    const groups=[...new Set(node.children.map(child=>child.roadmapGroupNumber).filter((group):group is string=>Boolean(group)))].map(group=>roadmapGroupKey(node.id,group));
    return node.children.length?[node.id,...groups,...expandableRoadmapIds(node.children)]:[];
  });
}

export function expandRoadmapAncestors(nodes:RoadmapNode[],id:string,current:CollapsedNodeIds):CollapsedNodeIds{
  const next=new Set(current);
  const path=roadmapPath(nodes,id);
  for(const [index,node] of path.entries()){
    if(node.children.length)next.delete(node.id);
    const child=path[index+1];
    if(child?.roadmapGroupNumber)next.delete(roadmapGroupKey(node.id,child.roadmapGroupNumber));
  }
  return next;
}

export function allRoadmapExpanded(nodes:RoadmapNode[],collapsedNodeIds:CollapsedNodeIds):boolean{
  return expandableRoadmapIds(nodes).every(id=>!collapsedNodeIds.has(id));
}
