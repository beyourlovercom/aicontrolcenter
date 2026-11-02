import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync} from 'node:fs';
import {join} from 'node:path';
import {generateKeyPairSync,sign} from 'node:crypto';
import {DEV_EVIDENCE_SCHEMA,DEV_EVIDENCE_AUDIENCE,DEV_EVIDENCE_DOMAIN} from '../lib/dc-signed-evidence-sandbox-v3.mjs';
import {SERVICE_PROOF_SCHEMA,SERVICE_PROOF_DOMAIN} from '../lib/dc-r6b-service-proof-dev.mjs';
import {r6cScopeDigest,r6cReadOnlyStatus,rehearseR6CDevOnly} from '../lib/dc-r6c-readonly-canary-dev.mjs';
import {readDevRequest} from '../lib/dc-r6b-ledger-dev.mjs';
import {assertDcAutomaticDispatchAllowed} from '../lib/dc-primary-gate-v3.mjs';
const NOW=1793592000000;
const fail=(fn,code)=>assert.throws(fn,e=>e?.code===code);
function scenario(){
 const root=mkdtempSync(join(realpathSync('/tmp'),'aicc-v3b-r6c-test-'));
 const pair={owner:generateKeyPairSync('ed25519'),health:generateKeyPairSync('ed25519'),
  service:generateKeyPairSync('ed25519')};
 const ownerRoot={keyId:'owner_test_123',publicKey:pair.owner.publicKey};
 const healthRoot={keyId:'health_test_123',publicKey:pair.health.publicKey};
 const serviceRoot={keyId:'service_test_123',publicKey:pair.service.publicKey};
 const binding={nonce:'nonce_dev_123456',projectId:'project_dev_1234',
  workPackageId:'workpack_dev_1234',taskId:'task_dev_1234',
  repositoryIdentity:'beyourlovercom/aicontrolcenter',head:'a'.repeat(40),
  deviceId:'us-macmini',operation:'remote_process_selftest'};
 const plan={requestId:'request_dev_1234',...binding,branch:'feat-r6c-dev',
  scopeDigest:r6cScopeDigest(binding),expiresAtMs:NOW+10000};
 const common={schema:DEV_EVIDENCE_SCHEMA,audience:DEV_EVIDENCE_AUDIENCE,
  issuedAtMs:NOW-1000,expiresAtMs:NOW+10000,...binding};
 const owner={...common,role:'OWNER_SCOPE',issuer:'DEV_OWNER_TEST_ISSUER',
  maxCalls:1,devOnly:true,production:false};
 const health={...common,role:'DEVICE_HEALTH',issuer:'DEV_DEVICE_TEST_ISSUER',
  healthSource:'SYNTHETIC_TEST_HEALTH',verified:true};
 const service={...common,schema:SERVICE_PROOF_SCHEMA,role:'SERVICE_DELEGATION_FIXTURE',
  issuer:'DEV_TEST_BROKER',audience:'AICC_DEV_SERVICE_PROOF_TEST',
  serviceId:'synthetic_dev_service',scope:'device:selftest:read',
  maxCalls:1,devOnly:true,production:false};
 function wrap(claim,privateKey,keyId,domain){
  const data=Buffer.from(JSON.stringify(claim));
  return {keyId,claimsB64:data.toString('base64url'),
   signatureB64:sign(null,Buffer.concat([Buffer.from(domain),data]),privateKey).toString('base64url')};
 }
 const ownerHealth={
  owner:wrap(owner,pair.owner.privateKey,ownerRoot.keyId,DEV_EVIDENCE_DOMAIN),
  health:wrap(health,pair.health.privateKey,healthRoot.keyId,DEV_EVIDENCE_DOMAIN)};
 const serviceProof=wrap(service,pair.service.privateKey,serviceRoot.keyId,SERVICE_PROOF_DOMAIN);
 const input={root,plan,nowMs:NOW,ownerHealth,ownerRoot,healthRoot,serviceProof,serviceRoot};
 return {input,plan,root,pair,ownerRoot,healthRoot,serviceRoot};
}
test('R6-C three independent synthetic proofs yield one Dev receipt but real dispatch STOP',()=>{
 const f=scenario();
 const r=rehearseR6CDevOnly(f.input);
 assert.equal(r.rehearsalState,'SYNTHETIC_COMPLETED');
 assert.equal(r.syntheticAttempts,1);
 assert.equal(r.automaticDispatchAllowed,false);
 assert.equal(r.realCanaryExecuted,false);
 assert.equal(r.runtimeOAuthDelegated,false);
 assert.equal(r.remoteReceiptVerified,false);
 assert.equal(r.productionEnabled,false);
 assert.equal(readDevRequest(f.root,f.plan.requestId).realDispatch,'STOP');
 fail(()=>assertDcAutomaticDispatchAllowed(),'DC_AUTO_DISPATCH_NOT_AUTHORIZED');
});
test('R6-C exactly-once nonce is permanently consumed; no second attempt',()=>{
 const f=scenario();rehearseR6CDevOnly(f.input);
 fail(()=>rehearseR6CDevOnly(f.input),'R6B4_NONCE_REPLAY_STOP');
});
test('R6-C unexpected scope digest cannot enter ledger',()=>{
 const f=scenario();
 fail(()=>rehearseR6CDevOnly({...f.input,plan:{...f.plan,scopeDigest:'f'.repeat(64)}}),'R6C_SCOPE_INVALID');
 fail(()=>readDevRequest(f.root,f.plan.requestId),'R6B4_RECORD_UNTRUSTED');
});
test('R6-C device/tool and unexpected forged instruction hard deny',()=>{
 const f=scenario();
 fail(()=>rehearseR6CDevOnly({...f.input,plan:{...f.plan,deviceId:'china-mac',
  scopeDigest:r6cScopeDigest({...f.plan,deviceId:'china-mac'})}}),'R6B4_TYPED_TOOL_DENIED');
 fail(()=>rehearseR6CDevOnly({...f.input,ownerApproved:true}),'R6C_INPUT_DENIED');
});
test('R6-C checks separate key material and role identity',()=>{
 const f=scenario();
 fail(()=>rehearseR6CDevOnly({...f.input,serviceRoot:{
  keyId:'different_service_test',publicKey:f.ownerRoot.publicKey}}),'R6B3_ROLE_ROOT_COLLISION');
});
test('R6-C synthetic expiry and missing service proof deny',()=>{
 const f=scenario();
 fail(()=>rehearseR6CDevOnly({...f.input,nowMs:NOW+20000}),'DC_DEV_EVIDENCE_EXPIRED_OR_UNFRESH');
 fail(()=>rehearseR6CDevOnly({...f.input,serviceProof:{ownerApproved:true}}),'R6B3_ROOT_INVALID');
});
test('R6-C status exposes no live authority or remote call permission',()=>{
 const status=r6cReadOnlyStatus();
 assert.equal(status.decision,'STOP');
 assert.equal(status.realCanaryCalls,0);
 assert.equal(status.automaticDispatchAllowed,false);
 assert.equal(status.trustedDeviceHealth,false);
});
