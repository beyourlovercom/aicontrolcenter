export const EXECUTION_CLASSES=Object.freeze(['CODE_CHANGE','TEST_ONLY']);
export const EXECUTION_PROVIDERS=Object.freeze(['CLAUDE_CODE','CODEX']);

function fail(code){const e=new Error(code);e.code=code;throw e;}

export function defaultProvider(executionClass){
  if(executionClass==='CODE_CHANGE')return 'CLAUDE_CODE';
  if(executionClass==='TEST_ONLY')return 'CODEX';
  fail('PROVIDER_ROUTING_CLASS_INVALID');
}

/**
 * Validates a provider routing decision supplied by GPT.
 * Returns the validated fields plus `isOverride` (true when the
 * provider differs from the class default — requires an auditable reason).
 * Explicit override is representable; it is never silently inferred.
 */
export function validateProviderDecision(input){
  if(!EXECUTION_CLASSES.includes(input?.executionClass))fail('PROVIDER_ROUTING_CLASS_INVALID');
  if(!EXECUTION_PROVIDERS.includes(input?.provider))fail('PROVIDER_ROUTING_PROVIDER_INVALID');
  if(typeof input?.providerRoutingReason!=='string'||!input.providerRoutingReason.trim())fail('PROVIDER_ROUTING_REASON_REQUIRED');
  const def=defaultProvider(input.executionClass);
  return {
    executionClass:input.executionClass,
    provider:input.provider,
    providerRoutingReason:input.providerRoutingReason.trim(),
    isOverride:input.provider!==def
  };
}
