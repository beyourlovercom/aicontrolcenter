export const EXECUTION_CLASSES=Object.freeze(['CODE_CHANGE','TEST_ONLY']);
export const EXECUTION_PROVIDERS=Object.freeze(['CLAUDE_CODE','CODEX']);
export const V3_EXECUTION_PROVIDERS=Object.freeze(['SELF_HOSTED_DC','CODEX']);

function fail(code){const e=new Error(code);e.code=code;throw e;}

export function defaultProvider(executionClass,options={}){
  if(options.v3Enabled===true&&EXECUTION_CLASSES.includes(executionClass))return 'SELF_HOSTED_DC';
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
export function validateProviderDecision(input,options={}){
  if(!EXECUTION_CLASSES.includes(input?.executionClass))fail('PROVIDER_ROUTING_CLASS_INVALID');
  const v3=options.v3Enabled===true;
  if(!(v3?V3_EXECUTION_PROVIDERS:EXECUTION_PROVIDERS).includes(input?.provider))
    fail(v3&&input?.provider==='CLAUDE_CODE'?'PROVIDER_ROUTING_CLAUDE_RETIRED':'PROVIDER_ROUTING_PROVIDER_INVALID');
  if(typeof input?.providerRoutingReason!=='string'||!input.providerRoutingReason.trim())fail('PROVIDER_ROUTING_REASON_REQUIRED');
  if(v3&&input.provider==='CODEX'&&!/^SECURITY_REVIEW:\s*\S/i.test(input.providerRoutingReason.trim()))
    fail('PROVIDER_ROUTING_CODEX_SECURITY_REASON_REQUIRED');
  const def=defaultProvider(input.executionClass,options);
  return {
    executionClass:input.executionClass,
    provider:input.provider,
    providerRoutingReason:input.providerRoutingReason.trim(),
    isOverride:input.provider!==def
  };
}
