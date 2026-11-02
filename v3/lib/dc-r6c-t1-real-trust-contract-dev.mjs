/**
 * R6-C-T1: read-only real-trust integration contract (Dev source only).
 * Verifies signature integrity using CALLER-SUPPLIED public roots; NEVER
 * asserts independent enrollment, actual service delegation or dispatch.
 * No transport, network, shell, filesystem write, OAuth or private key.
 */
import {createHash,verify as verifyEd25519} from 'node:crypto';
import {verifyHealthResponse} from '../../scripts/byl-remote-mcp/remote-v2-signed-health.mjs';
export const T1_RECEIPT_SCHEMA='aicc.v3b.r6c.real-receipt-contract.v1';
export const T1_RECEIPT_DOMAIN='AICC_R6C_T1_REMOTE_RECEIPT_CONTRACT_V1\n';
const HEX64=/^[a-f0-9]{64}$/;
const HEX40=/^[a-f0-9]{40}$/;
const REF=/^[A-Za-z0-9_-]{8,80}$/;
const PAYLOAD=['schema','issuer','audience','issuedAtMs','expiresAtMs',
 'nonce','projectId','workPackageId','taskId','repositoryIdentity','head',
 'deviceId','operation','requestId','planDigest','ownerGrantDigest',
 'servicePrincipalHash','revocationEpoch','resultDigest','status','consumedNonce'];
const BIND=['nonce','projectId','workPackageId','taskId','repositoryIdentity',
 'head','deviceId','operation','requestId','planDigest','ownerGrantDigest',
 'servicePrincipalHash','revocationEpoch'];
const err=c=>{const e=new Error(c);e.code=c;throw e;};
const exact=(v,keys)=>!!v&&typeof v==='object'&&!Array.isArray(v)&&
 Object.getPrototypeOf(v)===Object.prototype&&Object.keys(v).length===keys.length&&
 keys.every(k=>Object.hasOwn(v,k));
const digest=v=>createHash('sha256').update(v).digest('hex');
function publicRoot(k){
 if(!k||k.type!=='public'||k.asymmetricKeyType!=='ed25519'||
    typeof k.export!=='function')err('R6C_T1_PUBLIC_KEY_REQUIRED');
 try{return digest(k.export({format:'der',type:'spki'}));}
 catch{err('R6C_T1_PUBLIC_KEY_REQUIRED');}
}
function b64(s,cap){
 if(typeof s!=='string'||s.length>cap*2||!/^[A-Za-z0-9_-]+$/.test(s))
  err('R6C_T1_ENCODING_INVALID');
 const b=Buffer.from(s,'base64url');
 if(!b.length||b.length>cap||b.toString('base64url')!==s)
  err('R6C_T1_ENCODING_INVALID');
 return b;
}
function validBound(b){
 if(!exact(b,BIND)||!REF.test(b.nonce||'')||
    !REF.test(b.projectId||'')||!REF.test(b.workPackageId||'')||
    !REF.test(b.taskId||'')||!REF.test(b.requestId||'')||
    b.repositoryIdentity!=='beyourlovercom/aicontrolcenter'||
    !HEX40.test(b.head||'')||b.deviceId!=='us-macmini'||
    b.operation!=='remote_process_selftest'||!HEX64.test(b.planDigest||'')||
    !HEX64.test(b.ownerGrantDigest||'')||!HEX64.test(b.servicePrincipalHash||'')||
    !Number.isSafeInteger(b.revocationEpoch)||b.revocationEpoch<0)
  err('R6C_T1_SCOPE_DENIED');
}
/** Never accepts a caller-controlled command, URL or arbitrary tool. */
export function validateT1SelftestIntent(intent){
 if(!exact(intent,['deviceId','operation','arguments'])||
    intent.deviceId!=='us-macmini'||
    intent.operation!=='remote_process_selftest'||
    !exact(intent.arguments,[]))err('R6C_T1_OPERATION_DENIED');
 return Object.freeze({deviceId:'us-macmini',operation:'remote_process_selftest',
   arguments:Object.freeze({}),transport:'NONE',automaticDispatchAllowed:false,
   decision:'STOP'});
}
/**
 * Integrity-only check of a canonical signed remote receipt. A genuine signed
 * receipt additionally requires issuer enrollment, durable remote nonce
 * consumption, active Owner grant, a distinct service credential and Agent
 * attestation. None of those is established by this function.
 */
export function verifyT1ReceiptContract(envelope,publicKey,binding,nowMs){
 validBound(binding);
 const fingerprint=publicRoot(publicKey);
 if(!Number.isSafeInteger(nowMs))err('R6C_T1_TRUSTED_CLOCK_REQUIRED');
 if(!exact(envelope,['claimsB64','signatureB64']))err('R6C_T1_ENVELOPE_DENIED');
 const raw=b64(envelope.claimsB64,8192),sig=b64(envelope.signatureB64,128);
 if(sig.length!==64||!verifyEd25519(null,
     Buffer.concat([Buffer.from(T1_RECEIPT_DOMAIN),raw]),publicKey,sig))
  err('R6C_T1_SIGNATURE_DENIED');
 let claims;
 try{claims=JSON.parse(raw.toString('utf8'));}
 catch{err('R6C_T1_CLAIMS_DENIED');}
 if(!exact(claims,PAYLOAD)||JSON.stringify(claims)!==raw.toString('utf8')||
    claims.schema!==T1_RECEIPT_SCHEMA||claims.issuer!=='DEV_RECEIPT_FIXTURE'||
    claims.audience!=='AICC_R6C_DEV_REVIEW_ONLY'||claims.status!=='SELFTEST_OK'||
    claims.consumedNonce!==true)err('R6C_T1_CLAIMS_DENIED');
 if(!Number.isSafeInteger(claims.issuedAtMs)||
    !Number.isSafeInteger(claims.expiresAtMs)||claims.issuedAtMs>nowMs||
    claims.expiresAtMs<=nowMs||claims.expiresAtMs<=claims.issuedAtMs||
    claims.expiresAtMs-claims.issuedAtMs>60000)
  err('R6C_T1_STALE_PROOF');
 for(const field of BIND)
  if(claims[field]!==binding[field])err('R6C_T1_SCOPE_DENIED');
 if(!HEX64.test(claims.resultDigest||''))err('R6C_T1_RESULT_DENIED');
 return Object.freeze({signatureIntegrity:'TEST_FIXTURE_ONLY',
  fixturePublicFingerprint:fingerprint,decision:'STOP',
  actualDeviceReceiptVerified:false,remoteDurableNonceProven:false,
  serviceDelegationVerified:false,ownerGrantVerified:false,
  automaticDispatchAllowed:false,productionEnabled:false});
}
/** Existing canonical health verifier reused; enrollment is deliberately NOT claimed. */
export function inspectT1HealthSignature(challenge,response,publicKey,expectedFingerprint,nowMs){
 const fingerprint=publicRoot(publicKey);
 if(!HEX64.test(expectedFingerprint||'')||fingerprint!==expectedFingerprint)
  err('R6C_T1_TRUST_PIN_MISMATCH');
 if(!Number.isSafeInteger(nowMs))err('R6C_T1_TRUSTED_CLOCK_REQUIRED');
 const result=verifyHealthResponse(challenge,response,{publicKey,clock:()=>nowMs});
 return Object.freeze({signatureValid:result.ok===true,
  signatureCode:result.ok===true?'CRYPTOGRAPHICALLY_VALID':result.code,
  independentlyEnrolledAgentKey:false,liveInstalledAgentAttested:false,
  decision:'STOP',automaticDispatchAllowed:false});
}
export function inspectT1Readiness(){
 return Object.freeze({schema:'aicc.v3b.r6c-t1.real-trust-preflight.v1',
  scope:'US_MAC_SINGLE_READ_ONLY',decision:'STOP',
  servicePrincipal:'NOT_INDEPENDENTLY_EVIDENCED',
  ownerAuthorization:'NOT_ATTESTED',signedAgentHealth:'NOT_ATTESTED',
  remoteDurableReceipt:'NOT_IMPLEMENTED',
  liveToolAllowlist:'NOT_VERIFIED',realCanaryExecuted:false,
  automaticDispatchAllowed:false,productionEnabled:false});
}
