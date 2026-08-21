import type {SelectedEntityRef} from './model/entityTypes.ts';
export type GlobalTaskGroup='inProgress'|'waitingOwner'|'needsAction'|'recentCompleted';
export type GlobalTaskItem={id:string;canonicalTaskId?:string;label:string;state:string;group:GlobalTaskGroup;workPackageId?:string;runId?:string;scope:'GLOBAL_TASK'|'KNOWN';entity?:SelectedEntityRef;task?:any;createdAt?:string;completedAt?:string;branch?:string;prBinding?:string};
export type GlobalTaskGroups=Record<GlobalTaskGroup,GlobalTaskItem[]>;
export type GlobalTaskSummary={all:number;running:number;waitingOwner:number;completed:number;failed:number;global:number};

const empty=():GlobalTaskGroups=>({inProgress:[],waitingOwner:[],needsAction:[],recentCompleted:[]});

/** Global-only navigation projection; it never supplies entity-detail authority. */
export function buildGlobalTaskGroups(items:any[]):GlobalTaskGroups{
  const groups=empty();
  for(const item of items){
    const phase=String(item?.status??item?.runtimeState??item?.terminalState??item?.state??'').toUpperCase();
    const group:GlobalTaskGroup|undefined=['SUBMITTING','STARTING','RUNNING'].includes(phase)?'inProgress':['READY','WAITING_OWNER'].includes(phase)?'waitingOwner':['FAILED','STOPPED','CANCELLED','BLOCKED','RECOVERY_REQUIRED'].includes(phase)?'needsAction':phase==='COMPLETED'?'recentCompleted':undefined;
    if(!group)continue;
    const normalizedBinding=Boolean(item&&('entityClass' in item||'entity_class' in item||'formalWpId' in item||'formal_wp_id' in item));
    const rawWorkPackageId=(normalizedBinding?[item?.formalWpId,item?.formal_wp_id,item?.instruction?.formalWpId]:[item?.workPackageId,item?.instruction?.workPackageId]).find(value=>typeof value==='string'&&value) as string|undefined;
    const rawEntityType=String(item?.instruction?.entityType??'').toLowerCase();const rawEntityId=typeof item?.instruction?.entityId==='string'&&item.instruction.entityId!=='UNBOUND'?item.instruction.entityId:undefined;
    const isGlobal=item?.instruction?.entityScope==='GLOBAL_TASK'||rawEntityType==='global_task'||(!rawEntityId&&!rawWorkPackageId);
    const workPackageId=isGlobal||rawWorkPackageId==='UNBOUND'||rawWorkPackageId==='UNKNOWN_WP'?undefined:rawWorkPackageId;
    const entityId=isGlobal?undefined:rawEntityId;
    let entity:SelectedEntityRef|undefined;if(entityId&&['milestone','work_package','pull_request'].includes(rawEntityType))entity={type:rawEntityType as SelectedEntityRef['type'],id:entityId};else if(workPackageId)entity={type:'work_package',id:workPackageId};
    const canonicalTaskId=typeof item?.taskId==='string'&&item.taskId.trim()?item.taskId:undefined;
    groups[group].push({id:String(canonicalTaskId??item.id??item.runId??`${group}-${groups[group].length}`),canonicalTaskId,label:String(item.instruction?.title??item.instruction?.instructionId??item.instructionId??item.runId??'未命名任务'),state:phase,group,workPackageId,runId:typeof item?.runId==='string'?item.runId:undefined,scope:isGlobal?'GLOBAL_TASK':'KNOWN',entity,task:item,createdAt:item.createdAt,completedAt:item.completedAt,branch:item.branch??item.instruction?.branch,prBinding:item.prId??item.instruction?.pullRequestId??item.instruction?.prId});
  }
  for(const group of Object.values(groups))group.sort((left,right)=>Date.parse(right.createdAt??'')-Date.parse(left.createdAt??''));
  return groups;
}

export function summarizeGlobalTasks(groups:GlobalTaskGroups):GlobalTaskSummary{
  const all=Object.values(groups).flat();
  return {all:all.length,running:groups.inProgress.length,waitingOwner:groups.waitingOwner.length,completed:groups.recentCompleted.length,failed:groups.needsAction.length,global:all.filter(item=>item.scope==='GLOBAL_TASK').length};
}
