/** R6-B3: Dev-only service proof integrity; NOT a delegated OAuth identity. */
import {createHash,verify as verifyEd25519} from 'node:crypto';

export const SERVICE_PROOF_DOMAIN='AICC_V3B_R6B3_SYNTHETIC_SERVICE_PROOF_V1\n';
export const SERVICE_PROOF_SCHEMA='aicc.v3b.synthetic-service-proof.v1';
const FIELDS=['schema','role','issuer','audience','issuedAtMs','expiresAtMs','nonce',
  'projectId','workPackageId','taskId','repositoryIdentity','head',
  'deviceId','operation','serviceId','scope','maxCalls','devOnly','production'];
const REF=/^[a-zA-Z0-9_-]{8,80}$/;
const SHA=/^[0-9a-f]{40}$/;
const KEY=/^[a-zA-Z0-9_-]{8,80}$/;
const error=(code)=>Object.assign(new Error(code),{code});
function stop(code){throw error(code);}
function exact(o,keys){return !!o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));}
function decode(s){
 if(typeof s!=='string'||s.length>16384||!/^[A-Za-z0-9_-]+$/.test(s))stop('R6B3_ENCODING_INVALID');
 const b=Buffer.from(s,'base64url');
 if(!b.length||b.length>8192||b.toString('base64url')!==s)stop('R6B3_ENCODING_INVALID');
 return b;
}
export function publicKeyFingerprint(key){
 if(!key||key.type!=='public'||key.asymmetricKeyType!=='ed25519'||typeof key.export!=='function')
  stop('R6B3_PUBLIC_ROOT_REQUIRED');
 try{return createHash('sha256').update(key.export({type:'spki',format:'der'})).digest('hex');}
 catch{stop('R6B3_PUBLIC_ROOT_REQUIRED');}
}
export function verifySyntheticServiceEvidence(envelope,root,binding,nowMs){
 if(!exact(envelope,['keyId','claimsB64','signatureB64'])||
    !exact(root,['keyId','publicKey'])||!KEY.test(envelope.keyId)||
    envelope.keyId!==root.keyId)stop('R6B3_ROOT_INVALID');
 publicKeyFingerprint(root.publicKey);
 if(!Number.isSafeInteger(nowMs))stop('R6B3_TRUSTED_CLOCK_NOT_AVAILABLE');
 if(!binding||!REF.test(binding.nonce||'')||!SHA.test(binding.head||'')||
    !REF.test(binding.projectId||'')||!REF.test(binding.workPackageId||'')||
    !REF.test(binding.taskId||'')||binding.repositoryIdentity!=='beyourlovercom/aicontrolcenter'||
    binding.deviceId!=='us-macmini'||binding.operation!=='remote_process_selftest')
  stop('R6B3_SCOPE_DENIED');
 const bytes=decode(envelope.claimsB64), signature=decode(envelope.signatureB64);
 if(signature.length!==64||!verifyEd25519(null,Buffer.concat([Buffer.from(SERVICE_PROOF_DOMAIN),bytes]),
      root.publicKey,signature))stop('R6B3_SIGNATURE_INVALID');
 let claims;
 try{claims=JSON.parse(bytes.toString('utf8'));}catch{stop('R6B3_CLAIMS_INVALID');}
 if(!exact(claims,FIELDS)||JSON.stringify(claims)!==bytes.toString('utf8')||
  claims.schema!==SERVICE_PROOF_SCHEMA||claims.role!=='SERVICE_DELEGATION_FIXTURE'||
  claims.issuer!=='DEV_TEST_BROKER'||claims.audience!=='AICC_DEV_SERVICE_PROOF_TEST')
  stop('R6B3_CLAIMS_INVALID');
 if(!Number.isSafeInteger(claims.issuedAtMs)||!Number.isSafeInteger(claims.expiresAtMs)||
  claims.issuedAtMs>nowMs||claims.expiresAtMs<=nowMs||
  claims.expiresAtMs-claims.issuedAtMs>60000)stop('R6B3_STALE');
 for(const field of ['nonce','projectId','workPackageId','taskId','repositoryIdentity',
                      'head','deviceId','operation'])
  if(claims[field]!==binding[field])stop('R6B3_SCOPE_DENIED');
 if(claims.serviceId!=='synthetic_dev_service'||claims.scope!=='device:selftest:read'||
    claims.maxCalls!==1||claims.devOnly!==true||claims.production!==false)
  stop('R6B3_SCOPE_DENIED');
 // Valid fixture signature has zero authority in the actual runtime.
 return Object.freeze({schema:'aicc.v3b.service-evidence-assessment.v1',
  syntheticSignatureVerified:true, evidenceSource:'CALLER_INJECTED_TEST_ROOT',
  runtimeOAuthDelegated:false, trustedAgentHealth:false,
  independentOwnerAuthorization:false, realCanaryExecuted:false,
  decision:'STOP',automaticDispatchAllowed:false,productionEnabled:false});
}

/** A combination of synthetic verified receipts still never becomes a live grant. */
export function evaluateDevProofSeparation(ownerRoot,healthRoot,serviceRoot){
 const keys=[ownerRoot,healthRoot,serviceRoot].map(root=>publicKeyFingerprint(root));
 if(new Set(keys).size!==3)stop('R6B3_ROLE_ROOT_COLLISION');
 return Object.freeze({threeDistinctFixtureKeys:true, decision:'STOP',
   automaticDispatchAllowed:false, runtimeTrustAnchor:'NOT_INSTALLED'});
}

export function validateR6BTypedSelftestIntent(input){
 if(!exact(input,['deviceId','operation','arguments'])||
    input.deviceId!=='us-macmini'||input.operation!=='remote_process_selftest'||
    !exact(input.arguments,[]))stop('R6B4_TYPED_TOOL_DENIED');
 return Object.freeze({deviceId:'us-macmini',operation:'remote_process_selftest',
   arguments:Object.freeze({}),decision:'STOP',automaticDispatchAllowed:false});
}
