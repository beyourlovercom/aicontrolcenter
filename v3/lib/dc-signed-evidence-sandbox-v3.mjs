/**
 * R6-B1: Ed25519 verification of synthetic, independent Dev evidence.
 * IMPORTANT: This module cannot grant permission, provide OAuth, or dispatch.
 * Trust anchors are caller-injected TEST FIXTURES, never remote or prod trust.
 */
import {verify as ed25519Verify,createHash} from 'node:crypto';

export const DEV_EVIDENCE_SCHEMA='aicc.v3b.dev-signed-evidence.v1';
export const DEV_EVIDENCE_AUDIENCE='AICC_DEV_EVIDENCE_EVALUATOR';
export const DEV_EVIDENCE_DOMAIN='AICC_V3B_R6B_DEV_SIGNED_EVIDENCE_V1\n';
export const DEV_EVIDENCE_DEVICE='us-macmini';
export const DEV_EVIDENCE_OPERATION='remote_process_selftest';
const REF=/^[a-zA-Z0-9_-]{8,80}$/;
const SHA=/^[a-f0-9]{40}$/;
const COMMON=['schema','role','issuer','audience','issuedAtMs','expiresAtMs','nonce',
 'projectId','workPackageId','taskId','repositoryIdentity','head','deviceId','operation'];
const OWNER_KEYS=[...COMMON,'maxCalls','devOnly','production'];
const HEALTH_KEYS=[...COMMON,'healthSource','verified'];
const MAX_PROOF_BYTES=8192;
function stop(code){const e=new Error(code);e.code=code;throw e;}
function exactKeys(value,keys){
 return value&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===keys.length&&
  keys.every(key=>Object.hasOwn(value,key));
}
function decodeCanonical(encoded){
 if(typeof encoded!=='string'||encoded.length>MAX_PROOF_BYTES*2||
    !/^[A-Za-z0-9_-]+$/.test(encoded))stop('DC_DEV_EVIDENCE_ENCODING_INVALID');
 let b;
 try{b=Buffer.from(encoded,'base64url');}
 catch{stop('DC_DEV_EVIDENCE_ENCODING_INVALID');}
 if(b.length===0||b.length>MAX_PROOF_BYTES||b.toString('base64url')!==encoded)
  stop('DC_DEV_EVIDENCE_ENCODING_INVALID');
 return b;
}
function claimsFrom(raw){
 let claims;
 try{claims=JSON.parse(raw.toString('utf8'));}
 catch{stop('DC_DEV_EVIDENCE_CLAIMS_INVALID');}
 if(!claims||JSON.stringify(claims)!==raw.toString('utf8'))
  stop('DC_DEV_EVIDENCE_CLAIMS_INVALID');
 return claims;
}
function verifyOne(envelope,root,role,issuer,binding,now){
 if(!exactKeys(envelope,['keyId','claimsB64','signatureB64'])||
   typeof envelope.keyId!=='string'||!exactKeys(root,['keyId','publicKey'])||
   envelope.keyId!==root.keyId)stop('DC_DEV_EVIDENCE_TRUST_ROOT_INVALID');
 const raw=decodeCanonical(envelope.claimsB64);
 const signature=decodeCanonical(envelope.signatureB64);
 if(signature.length!==64)stop('DC_DEV_EVIDENCE_SIGNATURE_INVALID');
 // Public KeyObject only: do not accept private keys or PEM strings as trust roots.
 const key=root.publicKey;
 if(!key||key.type!=='public'||key.asymmetricKeyType!=='ed25519'||
    typeof key.export!=='function')stop('DC_DEV_EVIDENCE_TRUST_ROOT_INVALID');
 const message=Buffer.concat([Buffer.from(DEV_EVIDENCE_DOMAIN),raw]);
 if(!ed25519Verify(null,message,key,signature))stop('DC_DEV_EVIDENCE_SIGNATURE_INVALID');
 const claims=claimsFrom(raw);
 if(!exactKeys(claims,role==='OWNER_SCOPE'?OWNER_KEYS:HEALTH_KEYS)||
    claims.schema!==DEV_EVIDENCE_SCHEMA||claims.role!==role||
    claims.issuer!==issuer||claims.audience!==DEV_EVIDENCE_AUDIENCE)
  stop('DC_DEV_EVIDENCE_CLAIMS_INVALID');
 if(!Number.isSafeInteger(claims.issuedAtMs)||
    !Number.isSafeInteger(claims.expiresAtMs)||
    claims.issuedAtMs>now||claims.expiresAtMs<=now||
    claims.expiresAtMs<=claims.issuedAtMs||
    claims.expiresAtMs-claims.issuedAtMs>60000)
  stop('DC_DEV_EVIDENCE_EXPIRED_OR_UNFRESH');
 if(!REF.test(claims.nonce)||claims.nonce!==binding.nonce||
    claims.projectId!==binding.projectId||
    claims.workPackageId!==binding.workPackageId||
    claims.taskId!==binding.taskId||
    claims.repositoryIdentity!==binding.repositoryIdentity||
    claims.head!==binding.head||
    claims.deviceId!==DEV_EVIDENCE_DEVICE||
    claims.operation!==DEV_EVIDENCE_OPERATION)
  stop('DC_DEV_EVIDENCE_SCOPE_MISMATCH');
 if(role==='OWNER_SCOPE'){
  if(claims.maxCalls!==1||claims.devOnly!==true||claims.production!==false)
   stop('DC_DEV_EVIDENCE_SCOPE_MISMATCH');
 }else if(claims.healthSource!=='SYNTHETIC_TEST_HEALTH'||claims.verified!==true)
  stop('DC_DEV_EVIDENCE_SCOPE_MISMATCH');
 return claims;
}
/**
 * An evaluation result is ALWAYS STOP regardless of valid signed *test* proof.
 * Real service delegation, a trusted key registry, nonce ledger, signed agent
 * health and remote receipt protocol have not been implemented.
 */
export function evaluateDevSignedEvidence({owner,health},{ownerRoot,healthRoot},binding,{nowMs}={}){
 if(!binding||binding.deviceId!==DEV_EVIDENCE_DEVICE||
    binding.operation!==DEV_EVIDENCE_OPERATION||
    !SHA.test(binding.head||'')||!REF.test(binding.nonce||'')||
    !REF.test(binding.projectId||'')||!REF.test(binding.workPackageId||'')||
    !REF.test(binding.taskId||'')||
    binding.repositoryIdentity!=='beyourlovercom/aicontrolcenter')
  stop('DC_DEV_EVIDENCE_SCOPE_MISMATCH');
 if(!Number.isSafeInteger(nowMs))stop('DC_DEV_EVIDENCE_TIME_REQUIRED');
 if(!ownerRoot||!healthRoot||ownerRoot.keyId===healthRoot.keyId)
  stop('DC_DEV_EVIDENCE_ROLE_SEPARATION_REQUIRED');
 // Different key IDs are insufficient. Compare canonical public key SPKI digests.
 for(const root of [ownerRoot,healthRoot]){
  if(root.publicKey?.type!=='public'||root.publicKey.asymmetricKeyType!=='ed25519'||
     typeof root.publicKey.export!=='function')
   stop('DC_DEV_EVIDENCE_TRUST_ROOT_INVALID');
 }
 let ownerHash,healthHash;
 try{
  ownerHash=createHash('sha256').update(ownerRoot.publicKey.export({format:'der',type:'spki'})).digest('hex');
  healthHash=createHash('sha256').update(healthRoot.publicKey.export({format:'der',type:'spki'})).digest('hex');
 }catch{stop('DC_DEV_EVIDENCE_TRUST_ROOT_INVALID');}
 if(ownerHash===healthHash)stop('DC_DEV_EVIDENCE_ROLE_SEPARATION_REQUIRED');
 verifyOne(owner,ownerRoot,'OWNER_SCOPE','DEV_OWNER_TEST_ISSUER',binding,nowMs);
 verifyOne(health,healthRoot,'DEVICE_HEALTH','DEV_DEVICE_TEST_ISSUER',binding,nowMs);
 return Object.freeze({schema:'aicc.v3b.dc-dev-evidence-assessment.v1',
  evidenceIntegrity:'SYNTHETIC_SIGNATURES_VERIFIED',
  evidenceSource:'CALLER_INJECTED_DEV_TEST_KEYS',
  decision:'STOP',automaticDispatchAllowed:false,
  productionEnabled:false,realCanaryExecuted:false,
  serviceDelegation:'NOT_VERIFIED',remoteReplayGuard:'NOT_IMPLEMENTED',
  trustedRuntimeAuthority:'NOT_ESTABLISHED'});
}
