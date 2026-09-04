import {bindProvisionedExecution,provisionWorkPackageRuntime,type DeliveryContextStore,type GitWorktreeAdapter, type ProvisionedExecutionBinding} from './deliveryProvisioning.ts';
import type {ExecutionProviderContext} from './executionProvider.ts';
import type {ExecutionProviderRegistry} from './executionProviderRegistry.ts';

export type RuntimeWorkPackage={id:string;title:string;status:'CREATED';createdAt:string};
export type RuntimeWorkPackageStore={get(id:string):RuntimeWorkPackage|null;put(item:RuntimeWorkPackage):void};
export type RealWorkPackageRuntimeInput={workPackageId:string;repository:string;baseBranch:string;worktreeRoot:string;executionId:string;executionType:string;sandbox:'workspace-write'|'read-only';store:DeliveryContextStore;workPackages:RuntimeWorkPackageStore;bindings:{get(id:string):ProvisionedExecutionBinding|null;put(binding:ProvisionedExecutionBinding):void};git:GitWorktreeAdapter;providers:ExecutionProviderRegistry;now?:string};
export type RealWorkPackageRuntimeResult={workPackage:RuntimeWorkPackage;deliveryContext:ReturnType<typeof provisionWorkPackageRuntime>;executionContext:ExecutionProviderContext;executionBinding:ProvisionedExecutionBinding;providerId:string;reusedWorkPackage:boolean;reusedBinding:boolean};

export function startRealWorkPackageRuntime(input:RealWorkPackageRuntimeInput):RealWorkPackageRuntimeResult{
  const now=input.now??new Date().toISOString();
  const existing=input.workPackages.get(input.workPackageId);
  const workPackage=existing??{id:input.workPackageId,title:input.workPackageId,status:'CREATED' as const,createdAt:now};
  if(!existing)input.workPackages.put(workPackage);
  const deliveryContext=provisionWorkPackageRuntime(input);
  const provider=input.providers.selectDefault();
  if(!provider)throw new Error('PROVIDER_NOT_FOUND');
  const executionContext:ExecutionProviderContext={execution_id:input.executionId,instruction_id:`instruction-${input.executionId}`,repository:input.repository,branch:deliveryContext.deliveryBranch,worktree_path:deliveryContext.worktreePath,sandbox:input.sandbox,execution_type:input.executionType};
  const descriptor=input.providers.describe(provider.providerId);
  const error=input.providers.validate(provider.providerId,executionContext);
  if(error)throw new Error(error.code);
  const binding={...bindProvisionedExecution(deliveryContext,input.executionId),provider_id:provider.providerId};
  const existingBinding=input.bindings.get(input.workPackageId);if(!existingBinding)input.bindings.put(binding);
  return {workPackage,deliveryContext,executionContext,executionBinding:existingBinding?{...existingBinding,provider_id:existingBinding.provider_id??provider.providerId}:binding,providerId:descriptor?.provider_id??provider.providerId,reusedWorkPackage:Boolean(existing),reusedBinding:Boolean(existingBinding)};
}
