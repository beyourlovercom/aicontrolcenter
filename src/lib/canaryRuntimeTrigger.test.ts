import assert from 'node:assert/strict';
import {triggerCanaryRuntime} from './canaryRuntimeTrigger.ts';
import type {DeliveryContextStore,GitWorktreeAdapter,ProvisionedExecutionBinding} from './deliveryProvisioning.ts';

const contexts=new Map<string,any>();const bindings=new Map<string,ProvisionedExecutionBinding>();const worktrees=new Set<string>();const branches=new Set<string>();let creates=0;
const store:DeliveryContextStore={get:(id:string)=>contexts.get(id)??null,put:c=>contexts.set(c.workPackageId,c)};
const bindingStore={get:(id:string)=>bindings.get(id)??null,put:(b:ProvisionedExecutionBinding)=>bindings.set(b.work_package_id,b)};
const git:GitWorktreeAdapter={head:()=> 'abcdef0123456789',worktreeExists:p=>worktrees.has(p),branchExists:b=>branches.has(b),createWorktree:(p,b)=>{creates++;worktrees.add(p);branches.add(b)}};
const input={repository:'/repo',baseBranch:'rebuild/aicc-v2',worktreeRoot:'/tmp/aicc-canary',executionId:'exec-canary-1',store,git,bindings:bindingStore};
const first=triggerCanaryRuntime(input);assert.equal(first.workPackageId,'AICC-M6-AUTONOMOUS-DELIVERY-CANARY-001');assert.equal(first.deliveryContext.workPackageId,first.workPackageId);assert.equal(first.executionBinding.execution_id,'exec-canary-1');assert.equal(creates,1);
assert.ok(worktrees.has(first.deliveryContext.worktreePath),'Canary creates Worktree');assert.ok(branches.has(first.deliveryContext.deliveryBranch),'Canary creates Branch');assert.equal(first.executionBinding.delivery_context_id,first.deliveryContext.deliveryContextId);
const second=triggerCanaryRuntime({...input,executionId:'exec-canary-2'});assert.equal(second.reusedContext,true);assert.equal(second.reusedBinding,true);assert.equal(second.deliveryContext.deliveryContextId,first.deliveryContext.deliveryContextId);assert.equal(second.deliveryContext.worktreePath,first.deliveryContext.worktreePath);assert.equal(second.deliveryContext.deliveryBranch,first.deliveryContext.deliveryBranch);assert.equal(second.executionBinding.execution_id,'exec-canary-2');assert.equal(creates,1);
console.log('canary runtime trigger integration matrix passed');
