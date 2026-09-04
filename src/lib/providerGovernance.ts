import type {ExecutionProviderContext,ExecutionProviderError} from './executionProvider.ts';
import type {ProviderCapability,ProviderDescriptor} from './executionProviderRegistry.ts';

export type ProviderGovernanceRule={provider_id:string;allowed_capabilities:ProviderCapability[];allowed_execution_types:string[]};
export function validateProviderGovernance(descriptor:ProviderDescriptor,context:ExecutionProviderContext,rules:ProviderGovernanceRule[]):ExecutionProviderError|null{
  const rule=rules.find(item=>item.provider_id===descriptor.provider_id);
  if(!rule)return {code:'PROVIDER_NOT_FOUND',message:`No governance policy for provider: ${descriptor.provider_id}`};
  const executionType=context.execution_type.trim().toLowerCase().replace(/[ -]+/g,'_');
  const capability=executionType==='read_only_audit'?'read_only_audit':executionType==='remediation'?'remediation':executionType==='review'?'review':executionType==='analysis'?'analysis':'implementation';
  if(!rule.allowed_capabilities.includes(capability))return {code:'CAPABILITY_NOT_SUPPORTED',message:`CAPABILITY_NOT_ALLOWED: ${capability}`};
  if(rule.allowed_execution_types.length&&!rule.allowed_execution_types.includes(executionType)&&!rule.allowed_execution_types.includes('*'))return {code:'CAPABILITY_NOT_SUPPORTED',message:`EXECUTION_TYPE_NOT_SUPPORTED: ${context.execution_type}`};
  return null;
}
