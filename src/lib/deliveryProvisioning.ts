import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {deterministicDeliveryBranch,type DeliveryContext} from './deliveryWorkspace.ts';

export type DeliveryContextStore={get(workPackageId:string):DeliveryContext|null;put(context:DeliveryContext):void};
export type GitWorktreeAdapter={head(repository:string,baseBranch:string):string;worktreeExists(path:string):boolean;branchExists(branch:string):boolean;createWorktree(path:string,branch:string,baseBranch:string):void;worktreeHead?(path:string):string};
export type ProvisionedExecutionBinding={delivery_context_id:string;worktree_path:string;branch:string;work_package_id:string;execution_id?:string;provider_id?:string};

export function provisionWorkPackageRuntime(input:{workPackageId:string;repository:string;baseBranch:string;worktreeRoot:string;store:DeliveryContextStore;git:GitWorktreeAdapter;now?:string}):DeliveryContext{
  if(!/^AICC-[A-Z0-9]+(?:-[A-Z0-9-]+)*$/.test(input.workPackageId))throw new Error('WP_INVALID_ID');
  const existing=input.store.get(input.workPackageId);if(existing){if(!input.git.worktreeExists(existing.worktreePath)||!input.git.branchExists(existing.deliveryBranch))throw new Error('DELIVERY_IDENTITY_MISSING');return existing;}
  const baseSha=input.git.head(input.repository,input.baseBranch);const branch=deterministicDeliveryBranch(input.workPackageId);const path=join(input.worktreeRoot,input.workPackageId.toLowerCase());
  if(path===input.repository||path.startsWith(`${input.repository}/`))throw new Error('DELIVERY_WORKTREE_MUST_BE_ISOLATED');
  if(branch===input.baseBranch)throw new Error('DELIVERY_BRANCH_MUST_BE_DETERMINISTIC_CHILD');
  if(input.git.worktreeExists(path))throw new Error('WORKTREE_IDENTITY_CONFLICT');
  if(input.git.branchExists(branch))throw new Error('DELIVERY_BRANCH_IDENTITY_CONFLICT');
  mkdirSync(input.worktreeRoot,{recursive:true});input.git.createWorktree(path,branch,input.baseBranch);if(!input.git.worktreeExists(path)||!input.git.branchExists(branch))throw new Error('DELIVERY_PROVISIONING_INCOMPLETE');if(input.git.worktreeHead&&input.git.worktreeHead(path)!==baseSha)throw new Error('DELIVERY_HEAD_MISMATCH');const now=input.now??new Date().toISOString();const context:DeliveryContext={deliveryContextId:`delivery-${input.workPackageId.toLowerCase()}-${baseSha.slice(0,12)}`,workPackageId:input.workPackageId,repository:input.repository,baseBranch:input.baseBranch,baseSha,worktreePath:path,deliveryBranch:branch,prNumber:null,prHeadSha:null,status:'READY_FOR_EXECUTION',createdAt:now,updatedAt:now};input.store.put(context);return context;
}
export function bindProvisionedExecution(context:DeliveryContext,executionId?:string):ProvisionedExecutionBinding{return {delivery_context_id:context.deliveryContextId,worktree_path:context.worktreePath,branch:context.deliveryBranch,work_package_id:context.workPackageId,...(executionId?{execution_id:executionId}:{})};}
export function createCanaryWorkPackageRuntime(input:Omit<Parameters<typeof provisionWorkPackageRuntime>[0],'workPackageId'>){return provisionWorkPackageRuntime({...input,workPackageId:'AICC-M6-AUTONOMOUS-DELIVERY-CANARY-001'});}
