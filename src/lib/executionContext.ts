import type {SelectedEntityRef} from './model/entityTypes.ts';

export type ExecutionContextEntity=SelectedEntityRef|{type:'task';id:string;workPackageId?:string|null};
export type ExecutionContextLock={locked:boolean;entity:ExecutionContextEntity|null};
export const EXECUTION_CONTEXT_LOCK_KEY='aicc-v2-execution-context-lock';

export function unlockedExecutionContext():ExecutionContextLock{return {locked:false,entity:null};}
export function readExecutionContextLock(storage:Pick<Storage,'getItem'>|null=typeof localStorage==='undefined'?null:localStorage):ExecutionContextLock{
  if(!storage)return unlockedExecutionContext();
  try{const value=JSON.parse(storage.getItem(EXECUTION_CONTEXT_LOCK_KEY)||'null');if(value?.locked===true&&value.entity&&['milestone','work_package','phase','pull_request','task'].includes(value.entity.type)&&typeof value.entity.id==='string')return {locked:true,entity:value.entity};}catch{}
  return unlockedExecutionContext();
}
export function persistExecutionContextLock(lock:ExecutionContextLock,storage:Pick<Storage,'setItem'>|null=typeof localStorage==='undefined'?null:localStorage):void{if(storage)storage.setItem(EXECUTION_CONTEXT_LOCK_KEY,JSON.stringify(lock));}
export function resolveExecutionContext(explicit:ExecutionContextEntity|null,lock:ExecutionContextLock):ExecutionContextEntity|null{return explicit??(lock.locked?lock.entity:null);}
export function lockExecutionContext(entity:ExecutionContextEntity):ExecutionContextLock{return {locked:true,entity};}
export function unlockExecutionContext():ExecutionContextLock{return unlockedExecutionContext();}
