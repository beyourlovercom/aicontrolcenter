import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import type {DeliveryContextRecord} from './deliveryContextPersistence.ts';
import type {ExecutionProviderContext} from './executionProvider.ts';
import type {ExecutionProviderRegistry} from './executionProviderRegistry.ts';

export type RebuiltExecutionContext={execution_id:string;delivery_context_id:string;work_package_id:string;repository:string;branch:string;head_sha:string;provider_id:string;execution_type:string;status:'ACCEPTED';created_at:string;updated_at:string};
export interface ExecutionContextStore{get(key:string):RebuiltExecutionContext|null;put(context:RebuiltExecutionContext):void;}
export function createMemoryExecutionContextStore(initial:RebuiltExecutionContext[]=[]):ExecutionContextStore{const map=new Map(initial.map(item=>[`${item.delivery_context_id}:${item.head_sha}`,{...item}]));return {get:key=>map.get(key)??null,put:item=>map.set(`${item.delivery_context_id}:${item.head_sha}`,{...item})};}
export function createJsonExecutionContextStore(filePath:string):ExecutionContextStore{
  const read=():RebuiltExecutionContext[]=>{try{const value=JSON.parse(readFileSync(filePath,'utf8'));return Array.isArray(value)?value:[];}catch{return[];}};
  const memory=createMemoryExecutionContextStore(read());
  return {get:key=>memory.get(key),put:item=>{memory.put(item);const records=read().filter(value=>`${value.delivery_context_id}:${value.head_sha}`!==`${item.delivery_context_id}:${item.head_sha}`).concat(item);mkdirSync(dirname(filePath),{recursive:true});writeFileSync(filePath,JSON.stringify(records,null,2),{mode:0o600});}};
}

export function rebuildExecutionBinding(input:{delivery:DeliveryContextRecord;executionId:string;executionType:string;sandbox:'workspace-write'|'read-only';providerRegistry:ExecutionProviderRegistry;store:ExecutionContextStore;now?:string}):{context:RebuiltExecutionContext;reused:boolean}{
  const key=`${input.delivery.delivery_context_id}:${input.delivery.head_sha}`;const existing=input.store.get(key);if(existing)return {context:existing,reused:true};
  const provider=input.providerRegistry.selectDefault();if(!provider)throw new Error('PROVIDER_NOT_FOUND');
  const context:ExecutionProviderContext={execution_id:input.executionId,instruction_id:`instruction-${input.executionId}`,repository:input.delivery.repository,branch:input.delivery.delivery_branch,worktree_path:input.delivery.worktree_path,sandbox:input.sandbox,execution_type:input.executionType};
  const error=input.providerRegistry.validate(provider.providerId,context);if(error)throw new Error(error.code);
  const now=input.now??new Date().toISOString();const rebuilt:RebuiltExecutionContext={execution_id:input.executionId,delivery_context_id:input.delivery.delivery_context_id,work_package_id:input.delivery.work_package_id,repository:input.delivery.repository,branch:input.delivery.delivery_branch,head_sha:input.delivery.head_sha,provider_id:provider.providerId,execution_type:input.executionType,status:'ACCEPTED',created_at:now,updated_at:now};input.store.put(rebuilt);return {context:rebuilt,reused:false};
}
