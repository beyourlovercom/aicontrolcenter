import type {ExecutionProvider,ExecutionProviderContext,ExecutionProviderError} from './executionProvider.ts';

export type ProviderStatus='active'|'disabled';
export type ProviderCapability='implementation'|'remediation'|'read_only_audit'|'review'|'analysis'|'ci';
export type ProviderDescriptor={provider_id:string;display_name:string;capabilities:ProviderCapability[];status:ProviderStatus;version:string;available_models?:string[];supported_reasoning_levels?:string[];default_model?:string;default_reasoning?:string};
export type RegisteredExecutionProvider={descriptor:ProviderDescriptor;provider:ExecutionProvider};

function executionCapability(executionType:string):ProviderCapability{
  const normalized=executionType.trim().toLowerCase().replace(/[ -]+/g,'_');
  if(normalized==='read_only_audit')return 'read_only_audit';
  if(normalized==='remediation')return 'remediation';
  if(normalized==='review')return 'review';
  if(normalized==='analysis')return 'analysis';
  if(normalized==='ci')return 'ci';
  return 'implementation';
}

export class ExecutionProviderRegistry{
  private readonly providers=new Map<string,RegisteredExecutionProvider>();
  private readonly defaultProvider:string;
  constructor(defaultProvider:string){this.defaultProvider=defaultProvider;}
  register(provider:ExecutionProvider,descriptor:ProviderDescriptor){this.providers.set(descriptor.provider_id,{provider,descriptor});return descriptor;}
  unregister(providerId:string){return this.providers.delete(providerId);}
  get(providerId:string){return this.providers.get(providerId)?.provider??null;}
  describe(providerId:string){return this.providers.get(providerId)?.descriptor??null;}
  list(){return [...this.providers.values()].map(item=>item.descriptor);}
  selectDefault(){return this.get(this.defaultProvider);}
  validate(providerId:string,context:ExecutionProviderContext):ExecutionProviderError|null{
    const entry=this.providers.get(providerId);if(!entry)return {code:'PROVIDER_NOT_FOUND',message:`Provider not found: ${providerId}`};
    if(entry.descriptor.status!=='active')return {code:'PROVIDER_DISABLED',message:`Provider disabled: ${providerId}`};
    const capability=executionCapability(context.execution_type);
    if(!entry.descriptor.capabilities.includes(capability))return {code:'CAPABILITY_NOT_SUPPORTED',message:`Provider does not support execution type: ${context.execution_type}`};
    return entry.provider.validateExecution(context);
  }
}
