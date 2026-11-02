import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {mkdtempSync,realpathSync,chmodSync,symlinkSync,unlinkSync,mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {SERVICE_PROOF_SCHEMA,SERVICE_PROOF_DOMAIN,verifySyntheticServiceEvidence,
  evaluateDevProofSeparation,validateR6BTypedSelftestIntent} from '../lib/dc-r6b-service-proof-dev.mjs';
import {reserveDevRequest,readDevRequest,stageSyntheticAttempt,
  recordSyntheticReceipt,revokeDevRequest,reconcileDevLedger,devLedgerStatus}
  from '../lib/dc-r6b-ledger-dev.mjs';

const NOW=1793592000000;
function setup(){
 const root=mkdtempSync(join(realpathSync('/tmp'),'aicc-v3b-r6b-test-'));
 const binding={nonce:'nonce_test_abc123',projectId:'project_test_001',
  workPackageId:'workpack_test_001',taskId:'task_test_001',
  repositoryIdentity:'beyourlovercom/aicontrolcenter',head:'a'.repeat(40),
  deviceId:'us-macmini',operation:'remote_process_selftest'};
 const keys=generateKeyPairSync('ed25519');
 const claims={schema:SERVICE_PROOF_SCHEMA,role:'SERVICE_DELEGATION_FIXTURE',
  issuer:'DEV_TEST_BROKER',audience:'AICC_DEV_SERVICE_PROOF_TEST',
  issuedAtMs:NOW-1000,expiresAtMs:NOW+20000,...binding,
  serviceId:'synthetic_dev_service',scope:'device:selftest:read',
  maxCalls:1,devOnly:true,production:false};
 function signClaim(payload=claims,privateKey=keys.privateKey){
  const bytes=Buffer.from(JSON.stringify(payload));
  return {keyId:'test_service_key_123',claimsB64:bytes.toString('base64url'),
   signatureB64:sign(null,Buffer.concat([Buffer.from(SERVICE_PROOF_DOMAIN),bytes]),
    privateKey).toString('base64url')};
 }
 const keyroot={keyId:'test_service_key_123',publicKey:keys.publicKey};
 const plan={requestId:'request_test_001',...binding,branch:'feat-r6b-dev',
  scopeDigest:'c'.repeat(64),expiresAtMs:NOW+20000};
 const receipt={source:'SYNTHETIC_ONLY',requestId:plan.requestId,nonce:plan.nonce,
  planDigest:null,deviceId:plan.deviceId,operation:plan.operation,
  resultDigest:'b'.repeat(64),ok:true};
 return {root,binding,keys,claims,signClaim,keyroot,plan,receipt};
}
const denied=(fn,code)=>assert.throws(fn,e=>e?.code===code);
test('R6-B3 synthetic signed service proof never becomes actual OAuth authority',()=>{
 const f=setup();const x=verifySyntheticServiceEvidence(f.signClaim(),f.keyroot,f.binding,NOW);
 assert.equal(x.syntheticSignatureVerified,true);
 assert.equal(x.runtimeOAuthDelegated,false);
 assert.equal(x.trustedAgentHealth,false);
 assert.equal(x.independentOwnerAuthorization,false);
 assert.equal(x.automaticDispatchAllowed,false);
 assert.equal(x.decision,'STOP');
});
test('R6-B3 rejects forged service, wrong signatures and stale grants',()=>{
 const f=setup();
 denied(()=>verifySyntheticServiceEvidence({ownerApproved:true},f.keyroot,f.binding,NOW),'R6B3_ROOT_INVALID');
 const outsider=generateKeyPairSync('ed25519');
 denied(()=>verifySyntheticServiceEvidence(f.signClaim(f.claims,outsider.privateKey),
  f.keyroot,f.binding,NOW),'R6B3_SIGNATURE_INVALID');
 denied(()=>verifySyntheticServiceEvidence(f.signClaim(),f.keyroot,f.binding,NOW+30000),'R6B3_STALE');
 denied(()=>verifySyntheticServiceEvidence(f.signClaim(),f.keyroot,
  {...f.binding,head:'e'.repeat(40)},NOW),'R6B3_SCOPE_DENIED');
 const bad={...f.claims,scope:'device:*'};
 denied(()=>verifySyntheticServiceEvidence(f.signClaim(bad),f.keyroot,f.binding,NOW),
 'R6B3_SCOPE_DENIED');
});
test('R6-B3 role-root reuse rejected even with different key names',()=>{
 const f=setup();const a=generateKeyPairSync('ed25519').publicKey;
 denied(()=>evaluateDevProofSeparation(a,a,f.keyroot.publicKey),'R6B3_ROLE_ROOT_COLLISION');
 const b=generateKeyPairSync('ed25519').publicKey;
 assert.equal(evaluateDevProofSeparation(a,b,f.keyroot.publicKey).decision,'STOP');
 denied(()=>verifySyntheticServiceEvidence(f.signClaim(),
  {...f.keyroot,publicKey:f.keys.privateKey},f.binding,NOW),'R6B3_PUBLIC_ROOT_REQUIRED');
});
test('R6-B4 typed map denies arbitrary tools, cross-device, or command payload',()=>{
 const x=validateR6BTypedSelftestIntent({deviceId:'us-macmini',
 operation:'remote_process_selftest',arguments:{}});
 assert.equal(x.automaticDispatchAllowed,false);
 for(const input of [
  {deviceId:'us-macmini',operation:'start_process',arguments:{}},
  {deviceId:'china-mac',operation:'remote_process_selftest',arguments:{}},
  {deviceId:'us-macmini',operation:'remote_process_selftest',arguments:{command:'pwd'}},
  {deviceId:'us-macmini',operation:'remote_process_selftest',arguments:{},ownerApproved:true}
 ])denied(()=>validateR6BTypedSelftestIntent(input),'R6B4_TYPED_TOOL_DENIED');
});
test('R6-B2 local synthetic reservation persists once and replay is STOP',()=>{
 const f=setup();const r=reserveDevRequest(f.root,f.plan,NOW);
 assert.equal(r.state,'PREPARED_DEV_ONLY');assert.equal(r.realDispatch,'STOP');
 assert.equal(readDevRequest(f.root,f.plan.requestId).planDigest,r.planDigest);
 denied(()=>reserveDevRequest(f.root,f.plan,NOW),'R6B4_NONCE_REPLAY_STOP');
 denied(()=>reserveDevRequest(f.root,{...f.plan,requestId:'request_other_123'},NOW),
  'R6B4_NONCE_REPLAY_STOP');
 denied(()=>reserveDevRequest(f.root,{...f.plan,branch:'main',requestId:'request_other_001'},NOW),
 'R6B4_PLAN_DENIED');
});
test('R6-B4 synthetic receipt validates plan binding and ends without real dispatch',()=>{
 const f=setup();reserveDevRequest(f.root,f.plan,NOW);
 const s=stageSyntheticAttempt(f.root,f.plan.requestId,NOW);
 assert.equal(s.state,'SYNTHETIC_INFLIGHT');
 const receipt={...f.receipt,planDigest:s.planDigest};
 const done=recordSyntheticReceipt(f.root,f.plan.requestId,receipt,NOW+1000);
 assert.equal(done.state,'SYNTHETIC_COMPLETED');
 assert.equal(done.realDispatch,'STOP');assert.equal(done.syntheticAttempts,1);
 denied(()=>stageSyntheticAttempt(f.root,f.plan.requestId,NOW+2000),'R6B4_STAGE_DENIED');
});
test('R6-B4 forged receipt quarantines request and blocks concurrent project',()=>{
 const f=setup();reserveDevRequest(f.root,f.plan,NOW);
 const s=stageSyntheticAttempt(f.root,f.plan.requestId,NOW);
 const result=recordSyntheticReceipt(f.root,f.plan.requestId,
  {...f.receipt,planDigest:s.planDigest,deviceId:'china-mac'},NOW+1000);
 assert.equal(result.state,'UNCERTAIN_STOP');
 const second={...f.plan,requestId:'request_other_001',nonce:'nonce_other_001'};
 reserveDevRequest(f.root,second,NOW);
 denied(()=>stageSyntheticAttempt(f.root,second.requestId,NOW),'R6B4_PROJECT_BUSY');
 assert.equal(reconcileDevLedger(f.root).length,0);
});
test('R6-B2 revocation and in-flight crash recovery stop without replay',()=>{
 const f=setup();reserveDevRequest(f.root,f.plan,NOW);
 assert.equal(revokeDevRequest(f.root,f.plan.requestId).state,'REVOKED_STOP');
 denied(()=>stageSyntheticAttempt(f.root,f.plan.requestId,NOW),'R6B4_STAGE_DENIED');
 const g=setup();reserveDevRequest(g.root,g.plan,NOW);
 stageSyntheticAttempt(g.root,g.plan.requestId,NOW);
 const fixed=reconcileDevLedger(g.root);
 assert.deepEqual(fixed,[g.plan.requestId]);
 assert.equal(readDevRequest(g.root,g.plan.requestId).state,'UNCERTAIN_STOP');
 denied(()=>stageSyntheticAttempt(g.root,g.plan.requestId,NOW),'R6B4_STAGE_DENIED');
});
test('R6-B2 files require private isolated root; synthetic status hard STOP',()=>{
 const f=setup();chmodSync(f.root,0o755);
 denied(()=>reserveDevRequest(f.root,f.plan,NOW),'R6B4_PRIVATE_ROOT_REQUIRED');
 const s=devLedgerStatus();assert.equal(s.automaticDispatchAllowed,false);
 assert.equal(s.liveRemoteReceiptVerified,false);
 assert.equal(s.decision,'STOP');
});
test('R6-B4 receipt that arrives after scope expiry is quarantined',()=>{
 const f=setup();reserveDevRequest(f.root,f.plan,NOW);
 const s=stageSyntheticAttempt(f.root,f.plan.requestId,NOW);
 const out=recordSyntheticReceipt(f.root,f.plan.requestId,
  {...f.receipt,planDigest:s.planDigest},NOW+21000);
 assert.equal(out.state,'UNCERTAIN_STOP');
 assert.equal(out.errorCode,'R6B4_SYNTHETIC_RECEIPT_UNVERIFIED');
});
test('R6-B4 interrupted synthetic attempt cannot be silently retried after restart',()=>{
 const f=setup();reserveDevRequest(f.root,f.plan,NOW);
 stageSyntheticAttempt(f.root,f.plan.requestId,NOW);
 assert.deepEqual(reconcileDevLedger(f.root),[f.plan.requestId]);
 assert.deepEqual(reconcileDevLedger(f.root),[]);
 assert.equal(readDevRequest(f.root,f.plan.requestId).syntheticAttempts,1);
 const other={...f.plan,requestId:'request_else_234',nonce:'nonce_else_234'};
 reserveDevRequest(f.root,other,NOW);
 denied(()=>stageSyntheticAttempt(f.root,other.requestId,NOW),'R6B4_PROJECT_BUSY');
});
test('R6-B3 signed scope cannot silently change device or service identity',()=>{
 const f=setup();
 denied(()=>verifySyntheticServiceEvidence(f.signClaim({...f.claims,deviceId:'china-mac'}),
  f.keyroot,f.binding,NOW),'R6B3_SCOPE_DENIED');
 denied(()=>verifySyntheticServiceEvidence(f.signClaim({...f.claims,serviceId:'chatgpt_token'}),
  f.keyroot,f.binding,NOW),'R6B3_SCOPE_DENIED');
 denied(()=>verifySyntheticServiceEvidence(f.signClaim({...f.claims,production:true}),
  f.keyroot,f.binding,NOW),'R6B3_SCOPE_DENIED');
});

test('R6-B4 symlinked top-level root and nonce directory are fail-closed',()=>{
 const f=setup(),tmp=realpathSync('/tmp');
 const alias=join(tmp,'aicc-v3b-alias-'+f.plan.nonce);
 try{
  symlinkSync(f.root,alias,'dir');
  denied(()=>reserveDevRequest(alias,f.plan,NOW),'R6B4_PRIVATE_ROOT_REQUIRED');
 }finally{unlinkSync(alias);}
 const g=setup();
 const external=mkdtempSync(join(tmp,'aicc-v3b-external-'));
 symlinkSync(external,join(g.root,'nonces'),'dir');
 denied(()=>reserveDevRequest(g.root,g.plan,NOW),'R6B4_PRIVATE_ROOT_REQUIRED');
});
