/**
 * AICC DC S6 — strictly read-only OBSERVED runtime preflight.
 * A ChatGPT OAuth tool response can establish operational tool availability,
 * but NEVER an authenticated Ed25519 Agent health signal. No I/O here.
 * S6 intentionally returns no production-deployment GO.
 */
export const DEVICE_IDS=Object.freeze(['007windows','china-mac','us-macmini','windows']);
export const REQUIRED_RELEASE_GATES=Object.freeze([
  'REAL_AGENT_R2A_RECOVERABLE_BACKUP_AND_ISOLATED_RESTORE',
  'APPROVED_SERVICE_OWNER_AGENT_RELEASE_AND_OS_SIGNING',
  'ACTUAL_AUTHENTICATED_AGENT_SIGNED_HEALTH_HANDLER',
  'INDEPENDENT_ISSUER_AND_FOUR_SIGNER_KEY_WITNESS_ENROLLMENT',
  'DURABLE_EPOCH_AND_MULTI_INSTANCE_REPLAY_CONTROL',
  'REAL_GATEWAY_AUTH_AND_LOCAL_AGENT_HEALTH_MEASUREMENT',
  'FOUR_DEVICE_DEV_LIVE_SIGNED_PROOF_UAT',
  'OWNER_EXACT_HEAD_MERGE_AND_RELEASE_AUTHORIZATION'
]);
const statuses=new Set(['tool_call_success','parity_agent_unreachable','platform_safety_block','not_checked']);
const own=(o,k)=>Object.hasOwn(o,k);
const plain=x=>x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const fail=x=>{throw Object.assign(Error(x),{code:x});};
const keysEqual=(o,fields)=>plain(o)&&Object.keys(o).sort().join('|')===[...fields].sort().join('|');

/** Whitelist a bounded error category, without disclosing raw provider payloads. */
export function normalizeToolObservation(input,{nowMs=Date.now(),maxAgeMs=30000}={}){
  if(!keysEqual(input,['status','observedAtMs','toolCount']))fail('OBSERVATION_SHAPE_INVALID');
  if(!statuses.has(input.status))fail('STATUS_NOT_ALLOWED');
  if(!Number.isSafeInteger(nowMs)||!Number.isSafeInteger(maxAgeMs)||maxAgeMs<1||maxAgeMs>300000)
    fail('CLOCK_OR_TTL_INVALID');
  if(!Number.isSafeInteger(input.observedAtMs)||input.observedAtMs<=0||
     input.observedAtMs>nowMs+1500||nowMs-input.observedAtMs>maxAgeMs)
    return Object.freeze({controlPlane:'unknown',reason:'STALE_OR_INVALID_TIMESTAMP',toolCount:null});
  if(input.status==='tool_call_success'){
    if(!Number.isSafeInteger(input.toolCount)||input.toolCount<0||input.toolCount>200)
      fail('TOOL_COUNT_INVALID');
    return Object.freeze({
      controlPlane:'tool_call_success',
      reason:null,
      toolCount:input.toolCount
    });
  }
  if(input.toolCount!==null)fail('NON_SUCCESS_HAS_TOOL_COUNT');
  return Object.freeze({
    controlPlane:input.status==='parity_agent_unreachable'?'unreachable':'unknown',
    reason:input.status==='parity_agent_unreachable'?
      'PARITY_AGENT_UNREACHABLE':input.status==='platform_safety_block'?
      'PLATFORM_SAFETY_CHECK_BLOCKED':'NOT_CHECKED',
    toolCount:null
  });
}

/**
 * Strict four-device preflight using ONLY independently observed control-plane
 * tool-call results. A static READY register field is not accepted as
 * Ed25519 proof. Device signed-health states are UNKNOWN until a separately
 * authorized S2/S3/S4 installed runtime supplies verified cryptographic proof.
 *
 * NOTE: This report is a deployment-readiness blocker inventory, not an
 * automated release authorization engine. It has no 'allow' path.
 */
export function buildFourDeviceRealReadinessReport({
  registry,observations,nowMs=Date.now(),maxAgeMs=30000
}={}){
  if(!plain(registry)||!plain(observations)||Object.keys(registry).length!==4||
     Object.keys(observations).length!==4||
     DEVICE_IDS.some(id=>!own(registry,id)||!own(observations,id))||
     Object.keys(registry).some(id=>!DEVICE_IDS.includes(id))||
     Object.keys(observations).some(id=>!DEVICE_IDS.includes(id)))
    fail('EXACT_FOUR_DEVICE_SET_REQUIRED');
  const results=DEVICE_IDS.map(deviceId=>{
    // Registry READY is preserved as an observation of configuration only.
    if(!keysEqual(registry[deviceId],['state'])||
       !['READY','REGISTERED','UNKNOWN'].includes(registry[deviceId].state))
      fail('REGISTRY_SHAPE_INVALID');
    const observed=normalizeToolObservation(observations[deviceId],{nowMs,maxAgeMs});
    return Object.freeze({
      deviceId,registryConfigured:registry[deviceId].state==='READY'||
        registry[deviceId].state==='REGISTERED',
      registryRaw:registry[deviceId].state,
      controlPlane:observed.controlPlane,
      controlReason:observed.reason,
      toolCount:observed.toolCount,
      signedHealth:'unknown',
      signedHealthCryptographicallyVerified:false,
      independentlyEnrolledPublicKey:false,
      authenticatedInstalledAgentHandler:false,
      exactDeviceReleaseReady:false
    });
  });
  const contradictions=results.filter(x=>x.registryRaw==='READY'&&
    x.controlPlane==='unreachable').map(x=>x.deviceId);
  return Object.freeze({
    kind:'AICC_S6_READ_ONLY_REAL_RUNTIME_PREFLIGHT',
    codeMode:'DEV_ONLY',
    observationAuthenticity:'EXTERNAL_CALL_EVIDENCE_REQUIRED',
    cryptoSignedAgentProof:'NOT_OBSERVED',
    ownerReleaseAuthorization:'NOT_GRANTED',
    realFourDeviceSignedUat:'NOT_COMPLETE',
    canDeploy:false,
    canReplaceStaticReady:false,
    decision:'HOLD',
    blockers:REQUIRED_RELEASE_GATES,
    staticReadyContradictions:Object.freeze(contradictions),
    devices:Object.freeze(results),
    evidenceLimits:Object.freeze([
      'MCP_TOOL_SUCCESS_IS_NOT_SIGNED_AGENT_PROOF',
      'REGISTRY_READY_IS_NOT_ONLINE',
      'NO_INSTALLED_SIGNED_AGENT_ENDPOINT_VERIFIED',
      'DO_NOT_RETRY_PLATFORM_SAFETY_BLOCK_VIA_ALTERNATE_LINK'
    ])
  });
}
