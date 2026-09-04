import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {bindProvisionedExecution,createCanaryWorkPackageRuntime,type DeliveryContextStore,type GitWorktreeAdapter,type ProvisionedExecutionBinding} from './deliveryProvisioning.ts';
import type {DeliveryContext} from './deliveryWorkspace.ts';
import {resolveAiccStateDir} from './stateDirectory.ts';

export const CANARY_WORK_PACKAGE_ID='AICC-M6-AUTONOMOUS-DELIVERY-CANARY-001';

export type ExecutionBindingStore={get(workPackageId:string):ProvisionedExecutionBinding|null;put(binding:ProvisionedExecutionBinding):void};
export type CanaryRuntimeTriggerInput={repository:string;baseBranch:string;worktreeRoot:string;executionId:string;store:DeliveryContextStore;git:GitWorktreeAdapter;bindings:ExecutionBindingStore;now?:string};
export type CanaryRuntimeTriggerResult={workPackageId:string;deliveryContext:DeliveryContext;executionBinding:ProvisionedExecutionBinding;reusedContext:boolean;reusedBinding:boolean};

/** The sole Canary entry point. Runtime provisioning remains canonical in deliveryProvisioning.ts. */
export function triggerCanaryRuntime(input:CanaryRuntimeTriggerInput):CanaryRuntimeTriggerResult{
  const existing=input.store.get(CANARY_WORK_PACKAGE_ID);
  const context=createCanaryWorkPackageRuntime(input);
  const existingBinding=input.bindings.get(CANARY_WORK_PACKAGE_ID);
  const binding=bindProvisionedExecution(context,input.executionId);
  input.bindings.put(binding);
  return {workPackageId:CANARY_WORK_PACKAGE_ID,deliveryContext:context,executionBinding:binding,reusedContext:Boolean(existing),reusedBinding:Boolean(existingBinding)};
}

type JsonStore<T>={items:T[];get(id:string):T|null;put(item:T):void};
function jsonStore<T extends {workPackageId?:string;work_package_id?:string}>(file:string):JsonStore<T>{
  const load=():T[]=>{try{const value=JSON.parse(readFileSync(file,'utf8'));return Array.isArray(value)?value:[]}catch{return[]}};
  const save=(items:T[])=>{mkdirSync(join(file,'..'),{recursive:true});writeFileSync(file,JSON.stringify(items,null,2),{mode:0o600})};
  return {items:load(),get:(id)=>load().find(item=>(item.workPackageId??item.work_package_id)===id)??null,put:(item)=>{const items=load();const id=item.workPackageId??item.work_package_id;save([...items.filter(value=>(value.workPackageId??value.work_package_id)!==id),item])}};
}
export function createLocalCanaryRuntimeInput(repository:string,baseBranch:string,executionId:string){
  const stateDir=resolveAiccStateDir();
  const contexts=jsonStore<DeliveryContext>(join(stateDir,'delivery-contexts.json')) as DeliveryContextStore;
  const bindings=jsonStore<ProvisionedExecutionBinding>(join(stateDir,'delivery-execution-bindings.json')) as ExecutionBindingStore;
  const git:GitWorktreeAdapter={
    head:()=>execFileSync('git',['rev-parse',baseBranch],{cwd:repository,encoding:'utf8'}).trim(),
    worktreeExists:path=>{if(!existsSync(path))return false;try{return execFileSync('git',['-C',path,'rev-parse','--is-inside-work-tree'],{encoding:'utf8',stdio:['ignore','pipe','ignore']}).trim()==='true'}catch{return false}},
    branchExists:branch=>{try{execFileSync('git',['show-ref','--verify',`refs/heads/${branch}`],{cwd:repository,stdio:'ignore'});return true}catch{return false}},
    createWorktree:(path,branch,base)=>{execFileSync('git',['worktree','add','-b',branch,path,base],{cwd:repository,stdio:'ignore'})},
    worktreeHead:path=>execFileSync('git',['rev-parse','HEAD'],{cwd:path,encoding:'utf8'}).trim()
  };
  return {repository,baseBranch,worktreeRoot:join(stateDir,'delivery-worktrees'),executionId,store:contexts,git,bindings};
}
