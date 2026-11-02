import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {createHealthChallenge,signHealthResponse} from
 '../../scripts/byl-remote-mcp/remote-v2-signed-health.mjs';
import {T1_RECEIPT_DOMAIN,T1_RECEIPT_SCHEMA,validateT1SelftestIntent,
 verifyT1ReceiptContract,inspectT1HealthSignature,inspectT1Readiness}
 from '../lib/dc-r6c-t1-real-trust-contract-dev.mjs';
import {assertDcAutomaticDispatchAllowed} from '../lib/dc-primary-gate-v3.mjs';
const NOW=1793592000000;
const hash=x=>createHash('sha256').update(x).digest('hex');
const denied=(f,code)=>assert.throws(f,e=>e?.code===code);
function fixture(){
 const keys=generateKeyPairSync('ed25519');
 const binding={nonce:'nonce_t1_dev_123',projectId:'project_dev_123',
  workPackageId:'workpack_dev_123',taskId:'task_dev_123',
  repositoryIdentity:'beyourlovercom/aicontrolcenter',head:'a'.repeat(40),
  deviceId:'us-macmini',operation:'remote_process_selftest',
  requestId:'request_dev_123',planDigest:'b'.repeat(64),
  ownerGrantDigest:'c'.repeat(64),servicePrincipalHash:'d'.repeat(64),
  revocationEpoch:1};
 const claims={schema:T1_RECEIPT_SCHEMA,issuer:'DEV_RECEIPT_FIXTURE',
  audience:'AICC_R6C_DEV_REVIEW_ONLY',issuedAtMs:NOW-1000,
  expiresAtMs:NOW+10000,...binding,resultDigest:'e'.repeat(64),
  status:'SELFTEST_OK',consumedNonce:true};
 const encode=(obj=claims,signingKey=keys.privateKey)=>{
  const raw=Buffer.from(JSON.stringify(obj));
  return {claimsB64:raw.toString('base64url'),
   signatureB64:sign(null,Buffer.concat([Buffer.from(T1_RECEIPT_DOMAIN),raw]),
    signingKey).toString('base64url')};
 };
 return {keys,binding,claims,encode,
  verify:(obj=claims,bindingOverride=binding)=>verifyT1ReceiptContract(
   encode(obj),keys.publicKey,bindingOverride,NOW)};
}
test('T1-A/B first-party preflight never declares real service or Agent attestation',()=>{
 const status=inspectT1Readiness();
 assert.equal(status.decision,'STOP');
 assert.equal(status.servicePrincipal,'NOT_INDEPENDENTLY_EVIDENCED');
 assert.equal(status.signedAgentHealth,'NOT_ATTESTED');
 assert.equal(status.actualDeviceReceiptVerified,undefined);
 assert.equal(status.automaticDispatchAllowed,false);
 denied(()=>assertDcAutomaticDispatchAllowed(),'DC_AUTO_DISPATCH_NOT_AUTHORIZED');
});
test('T1-C only one fixed device and operation with empty arguments',()=>{
 const o=validateT1SelftestIntent({deviceId:'us-macmini',
  operation:'remote_process_selftest',arguments:{}});
 assert.equal(o.transport,'NONE');
 assert.equal(o.automaticDispatchAllowed,false);
 for(const wrong of [
  {deviceId:'china-mac',operation:'remote_process_selftest',arguments:{}},
  {deviceId:'us-macmini',operation:'start_process',arguments:{}},
  {deviceId:'us-macmini',operation:'remote_process_selftest',arguments:{command:'hostname'}},
  {deviceId:'us-macmini',operation:'remote_process_selftest',arguments:{},ownerApproved:true},
  {deviceId:'us-macmini',operation:'remote_process_selftest',arguments:{url:'http://localhost'}}
 ])denied(()=>validateT1SelftestIntent(wrong),'R6C_T1_OPERATION_DENIED');
});
test('T1-D signed fixture proves contract integrity, NEVER device trust or dispatch',()=>{
 const f=fixture(),r=f.verify();
 assert.equal(r.signatureIntegrity,'TEST_FIXTURE_ONLY');
 assert.equal(r.actualDeviceReceiptVerified,false);
 assert.equal(r.remoteDurableNonceProven,false);
 assert.equal(r.automaticDispatchAllowed,false);
 assert.equal(r.ownerGrantVerified,false);
 assert.equal(r.decision,'STOP');
});
test('T1-D payload modification without re-signing fails',()=>{
 const f=fixture(),signed=f.encode(f.claims);
 const raw=JSON.parse(Buffer.from(signed.claimsB64,'base64url').toString());
 raw.resultDigest='f'.repeat(64);
 denied(()=>verifyT1ReceiptContract({...signed,
  claimsB64:Buffer.from(JSON.stringify(raw)).toString('base64url')},
  f.keys.publicKey,f.binding,NOW),'R6C_T1_SIGNATURE_DENIED');
});
test('T1-D outsider signer, swapped public key and private roots rejected',()=>{
 const f=fixture(),outsider=generateKeyPairSync('ed25519');
 denied(()=>verifyT1ReceiptContract(f.encode(f.claims,outsider.privateKey),
  f.keys.publicKey,f.binding,NOW),'R6C_T1_SIGNATURE_DENIED');
 denied(()=>verifyT1ReceiptContract(f.encode(),outsider.publicKey,f.binding,NOW),
  'R6C_T1_SIGNATURE_DENIED');
 denied(()=>verifyT1ReceiptContract(f.encode(),f.keys.privateKey,f.binding,NOW),
  'R6C_T1_PUBLIC_KEY_REQUIRED');
});
test('T1-D every binding field—including revocation epoch—is enforced',()=>{
 for(const [field,value] of [
  ['nonce','nonce_wrong_123'],['requestId','request_wrong_123'],
  ['projectId','project_wrong_123'],['workPackageId','workpack_wrong_123'],
  ['taskId','task_wrong_123'],['head','f'.repeat(40)],
  ['ownerGrantDigest','f'.repeat(64)],['servicePrincipalHash','f'.repeat(64)],
  ['planDigest','f'.repeat(64)],['revocationEpoch',2]
 ]){const f=fixture();
  denied(()=>f.verify({...f.claims,[field]:value}),'R6C_T1_SCOPE_DENIED');
 }
});
test('T1-D wrong device or operation cannot satisfy fixed binding',()=>{
 const f=fixture();
 for(const patch of [{deviceId:'china-mac'},{operation:'start_process'},
  {repositoryIdentity:'external/repo'}])
  denied(()=>f.verify({...f.claims,...patch}),'R6C_T1_SCOPE_DENIED');
});
test('T1-D expired, future-issued and excessive TTL reject',()=>{
 const f=fixture();
 for(const patch of [
  {expiresAtMs:NOW},{issuedAtMs:NOW+1000},
  {expiresAtMs:NOW+90000}
 ])denied(()=>f.verify({...f.claims,...patch}),'R6C_T1_STALE_PROOF');
});
test('T1-D fake issuer, audience, nonce claim and status reject',()=>{
 const f=fixture();
 for(const patch of [
  {issuer:'ACTUAL_AGENT'}, {audience:'REAL_PRODUCTION'},
  {status:'SHELL_DONE'},{consumedNonce:false}
 ])denied(()=>f.verify({...f.claims,...patch}),'R6C_T1_CLAIMS_DENIED');
});
test('T1-D forged result digest and extra fields reject',()=>{
 const f=fixture();
 denied(()=>f.verify({...f.claims,resultDigest:'x'}),
  'R6C_T1_RESULT_DENIED');
 denied(()=>f.verify({...f.claims,secret:'injected'}),
  'R6C_T1_CLAIMS_DENIED');
});
test('T1-D duplicate JSON keys and noncanonical whitespace reject',()=>{
 const f=fixture();
 let raw=Buffer.from(JSON.stringify(f.claims).replace(
  '"schema":','"schema":"aicc.v3b.r6c.real-receipt-contract.v1","schema":'));
 let signed={claimsB64:raw.toString('base64url'),
  signatureB64:sign(null,Buffer.concat([Buffer.from(T1_RECEIPT_DOMAIN),raw]),
   f.keys.privateKey).toString('base64url')};
 denied(()=>verifyT1ReceiptContract(signed,f.keys.publicKey,f.binding,NOW),
  'R6C_T1_CLAIMS_DENIED');
});
test('T1-D malformed canonical encoding and signature length rejected',()=>{
 const f=fixture(),signed=f.encode();
 denied(()=>verifyT1ReceiptContract({...signed,claimsB64:signed.claimsB64+'='},
   f.keys.publicKey,f.binding,NOW),'R6C_T1_ENCODING_INVALID');
 denied(()=>verifyT1ReceiptContract({...signed,signatureB64:'dGVzdA'},
   f.keys.publicKey,f.binding,NOW),'R6C_T1_SIGNATURE_DENIED');
});
test('T1-B canonical health signature fixture verifies cryptography, not installed Agent',()=>{
 const keys=generateKeyPairSync('ed25519'),id='us-macmini';
 const challenge=createHealthChallenge(id,{clock:()=>NOW,
  nonceSource:()=> 'b'.repeat(48)});
 const health=signHealthResponse(challenge,{privateKey:keys.privateKey,clock:()=>NOW});
 const fp=hash(keys.publicKey.export({format:'der',type:'spki'}));
 const r=inspectT1HealthSignature(challenge,health,keys.publicKey,fp,NOW);
 assert.equal(r.signatureValid,true);
 assert.equal(r.independentlyEnrolledAgentKey,false);
 assert.equal(r.liveInstalledAgentAttested,false);
 assert.equal(r.decision,'STOP');
});
test('T1-B wrong trust pin or stale challenge fails closed',()=>{
 const keys=generateKeyPairSync('ed25519');
 const challenge=createHealthChallenge('us-macmini',{clock:()=>NOW,
  nonceSource:()=> 'c'.repeat(48)});
 const health=signHealthResponse(challenge,{privateKey:keys.privateKey,clock:()=>NOW});
 const fp=hash(keys.publicKey.export({format:'der',type:'spki'}));
 denied(()=>inspectT1HealthSignature(challenge,health,keys.publicKey,
  'a'.repeat(64),NOW),'R6C_T1_TRUST_PIN_MISMATCH');
 const stale=inspectT1HealthSignature(challenge,health,keys.publicKey,fp,NOW+30000);
 assert.equal(stale.signatureValid,false);
 assert.equal(stale.decision,'STOP');
});
test('T1-B synthetic degradation cannot be represented as healthy',()=>{
 const keys=generateKeyPairSync('ed25519');
 const challenge=createHealthChallenge('us-macmini',{clock:()=>NOW,
  nonceSource:()=> 'd'.repeat(48)});
 const health=signHealthResponse(challenge,{privateKey:keys.privateKey,
  clock:()=>NOW,status:'degraded'});
 const fp=hash(keys.publicKey.export({format:'der',type:'spki'}));
 const r=inspectT1HealthSignature(challenge,health,keys.publicKey,fp,NOW);
 assert.equal(r.signatureValid,false);
 assert.equal(r.signatureCode,'AGENT_DEGRADED');
});

test('T1-D invalid raw UTF-8 bytes are rejected even if a fixture signs them',()=>{
 const f=fixture(),good=Buffer.from(JSON.stringify(f.claims));
 const bad=Buffer.concat([good.subarray(0,2),Buffer.from([0xff]),good.subarray(2)]);
 const forged={claimsB64:bad.toString('base64url'),
  signatureB64:sign(null,Buffer.concat([Buffer.from(T1_RECEIPT_DOMAIN),bad]),
   f.keys.privateKey).toString('base64url')};
 denied(()=>verifyT1ReceiptContract(forged,f.keys.publicKey,f.binding,NOW),
  'R6C_T1_CLAIMS_DENIED');
});
