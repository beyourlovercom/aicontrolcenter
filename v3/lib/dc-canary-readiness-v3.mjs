/**
 * Read-only inventory of evidence absent from the real DC auto-dispatch path.
 * Not a credential probe, authorization decision or executable transport.
 * Caller-supplied flags / request fields NEVER turn any prerequisite green.
 */
export const DC_CANARY_READINESS_SCHEMA='aicc.v3b.dc-canary-readiness.v1';
export const DC_CANARY_REQUIRED_EVIDENCE=Object.freeze([
  Object.freeze({gate:'OWNER_ATTESTATION',state:'NOT_ATTESTED',
    reason:'No independent, persistent, verifiable Owner scope grant is wired to this AICC runtime'}),
  Object.freeze({gate:'SERVICE_DELEGATION',state:'NOT_EVIDENCED',
    reason:'ChatGPT formal OAuth tool access is not an AICC runtime service delegation'}),
  Object.freeze({gate:'SIGNED_DEVICE_HEALTH',state:'NOT_EVIDENCED',
    reason:'READY registration and supervised self-test are not signed device health attestations'}),
  Object.freeze({gate:'LIVE_TYPED_TOOL_ALLOWLIST',state:'NOT_IMPLEMENTED',
    reason:'Current typed operations execute only through a synthetic mock transport'}),
  Object.freeze({gate:'LIVE_NONCE_RECEIPT_AND_REVOCATION',state:'NOT_IMPLEMENTED',
    reason:'Synthetic nonce, lease and receipts do not establish remote exactly-once semantics'}),
  Object.freeze({gate:'REAL_DISPATCH_AUTHORIZATION',state:'NOT_AUTHORIZED',
    reason:'The existing V3 automatic dispatch gate intentionally always rejects'})
]);
export function readDcRealCanaryReadiness(){
  // Do not inspect env, HTTP payloads, ownerApproved, or injected "trusted" facts.
  // There is deliberately no promotion path to ALLOW in this evidence inventory.
  return Object.freeze({
    schema:DC_CANARY_READINESS_SCHEMA,
    scope:'DEV_REAL_DC_CANARY_PREFLIGHT',
    decision:'STOP',
    automaticDispatchAllowed:false,
    realCanaryExecuted:false,
    productionEnabled:false,
    prerequisites:DC_CANARY_REQUIRED_EVIDENCE,
    nextAction:'SUPERVISED_READ_ONLY_EVIDENCE_COLLECTION_AND_SEPARATE_OWNER_SCOPE_APPROVAL'
  });
}
