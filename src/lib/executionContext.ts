import type {SelectedEntityRef} from './model/entityTypes.ts';

export type ExecutionContextLock={locked:boolean;entity:SelectedEntityRef|null};
export const EXECUTION_CONTEXT_LOCK_KEY='aicc-v2-execution-context-lock';

export function unlockedExecutionContext():ExecutionContextLock{return {locked:false,entity:null};}
export function readExecutionContextLock(storage:Pick<Storage,'getItem'>|null=typeof localStorage==='undefined'?null:localStorage):ExecutionContextLock{
  if(!storage)return unlockedExecutionContext();
  try{const value=JSON.parse(storage.getItem(EXECUTION_CONTEXT_LOCK_KEY)||'null');if(value?.locked===true&&value.entity&&['milestone','work_package','pull_request'].includes(value.entity.type)&&typeof value.entity.id==='string')return {locked:true,entity:value.entity};}catch{}
  return unlockedExecutionContext();
}
export function persistExecutionContextLock(lock:ExecutionContextLock,storage:Pick<Storage,'setItem'>|null=typeof localStorage==='undefined'?null:localStorage):void{if(storage)storage.setItem(EXECUTION_CONTEXT_LOCK_KEY,JSON.stringify(lock));}
export function resolveExecutionContext(explicit:SelectedEntityRef|null,lock:ExecutionContextLock):SelectedEntityRef|null{return explicit??(lock.locked?lock.entity:null);}
export function lockExecutionContext(entity:SelectedEntityRef):ExecutionContextLock{return {locked:true,entity};}
export function unlockExecutionContext():ExecutionContextLock{return unlockedExecutionContext();}
