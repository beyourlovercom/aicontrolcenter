import type {SelectedEntityRef} from './model/entityTypes.ts';
export type GlobalTaskGroup='inProgress'|'waitingOwner'|'needsAction'|'recentCompleted';
export type GlobalTaskItem={id:string;label:string;state:string;group:GlobalTaskGroup;workPackageId?:string;runId?:string;scope:'KNOWN'|'UNKNOWN';entity?:SelectedEntityRef};
export type GlobalTaskGroups=Record<GlobalTaskGroup,GlobalTaskItem[]>;

const empty=():GlobalTaskGroups=>({inProgress:[],waitingOwner:[],needsAction:[],recentCompleted:[]});

/** Global-only navigation projection; it never supplies entity-detail authority. */
export function buildGlobalTaskGroups(items:any[]):GlobalTaskGroups{
  const groups=empty();
  for(const item of items){
    const phase=String(item?.runtimeState??item?.terminalState??item?.state??'').toUpperCase();
    const group:GlobalTaskGroup|undefined=['STARTING','RUNNING','STOPPING'].includes(phase)?'inProgress':phase==='READY'?'waitingOwner':['FAILED','STOPPED','BLOCKED','RECOVERY_REQUIRED'].includes(phase)?'needsAction':phase==='COMPLETED'?'recentCompleted':undefined;
    if(!group)continue;
    const workPackageId=typeof item?.instruction?.workPackageId==='string'&&item.instruction.workPackageId?item.instruction.workPackageId:undefined;
    const entityType=String(item?.instruction?.entityType??'').toLowerCase();const entityId=typeof item?.instruction?.entityId==='string'&&item.instruction.entityId!=='UNBOUND'?item.instruction.entityId:undefined;
    let entity:SelectedEntityRef|undefined;if(entityId&&['milestone','work_package','pull_request'].includes(entityType))entity={type:entityType as SelectedEntityRef['type'],id:entityId};else if(workPackageId)entity={type:'work_package',id:workPackageId};
    groups[group].push({id:String(item.id??item.runId??`${group}-${groups[group].length}`),label:String(item.instruction?.title??item.instruction?.instructionId??item.runId??'未命名任务'),state:phase,group,workPackageId,runId:typeof item?.runId==='string'?item.runId:undefined,scope:entity?'KNOWN':'UNKNOWN',entity});
  }
  return groups;
}
