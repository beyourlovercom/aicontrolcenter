import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign} from 'node:crypto';
import {DEV_EVIDENCE_SCHEMA,DEV_EVIDENCE_AUDIENCE,DEV_EVIDENCE_DOMAIN,
 evaluateDevSignedEvidence} from '../lib/dc-signed-evidence-sandbox-v3.mjs';
import {assertDcAutomaticDispatchAllowed} from '../lib/dc-primary-gate-v3.mjs';
import {readDcRealCanaryReadiness} from '../lib/dc-canary-readiness-v3.mjs';

const NOW=1793592000000;
function sample(){
 const ownerKeys=generateKeyPairSync('ed25519');
 const healthKeys=generateKeyPairSync('ed25519');
 const binding={nonce:'nonce_test_12345',projectId:'project_test_123',
  workPackageId:'workpkg_test_123',taskId:'task_test_123',
  repositoryIdentity:'beyourlovercom/aicontrolcenter',head:'a'.repeat(40),
  deviceId:'us-macmini',operation:'remote_process_selftest'};
 const shared={schema:DEV_EVIDENCE_SCHEMA,audience:DEV_EVIDENCE_AUDIENCE,
  issuedAtMs:NOW-5000,expiresAtMs:NOW+20000,
  ...binding};
 const claimOwner={...shared,role:'OWNER_SCOPE',issuer:'DEV_OWNER_TEST_ISSUER',
  maxCalls:1,devOnly:true,production:false};
 const claimHealth={...shared,role:'DEVICE_HEALTH',issuer:'DEV_DEVICE_TEST_ISSUER',
  healthSource:'SYNTHETIC_TEST_HEALTH',verified:true};
 const encode=(claim,keys,keyId)=>{
  const bytes=Buffer.from(JSON.stringify(claim));
  return {keyId,claimsB64:bytes.toString('base64url'),
   signatureB64:sign(null,Buffer.concat([Buffer.from(DEV_EVIDENCE_DOMAIN),bytes]),
    keys.privateKey).toString('base64url')};
 };
 const roots={ownerRoot:{keyId:'dev_owner_test_root',publicKey:ownerKeys.publicKey},
  healthRoot:{keyId:'dev_health_test_root',publicKey:healthKeys.publicKey}};
 const signed={owner:encode(claimOwner,ownerKeys,roots.ownerRoot.keyId),
  health:encode(claimHealth,healthKeys,roots.healthRoot.keyId)};
 const evaluate=(patch={})=>evaluateDevSignedEvidence(
  patch.signed||signed,patch.roots||roots,patch.binding||binding,{nowMs:patch.nowMs??NOW});
 return {binding,roots,signed,claimOwner,claimHealth,ownerKeys,healthKeys,encode,evaluate};
}
function denied(p,code){assert.throws(p,e=>e?.code===code);}
test('two independent signed Dev proofs validate integrity but never authorize real DC',()=>{
 const f=sample(),x=f.evaluate();
 assert.equal(x.evidenceIntegrity,'SYNTHETIC_SIGNATURES_VERIFIED');
 assert.equal(x.decision,'STOP');
 assert.equal(x.automaticDispatchAllowed,false);
 assert.equal(x.serviceDelegation,'NOT_VERIFIED');
 assert.equal(x.remoteReplayGuard,'NOT_IMPLEMENTED');
 assert.equal(x.productionEnabled,false);
 assert.equal(readDcRealCanaryReadiness().decision,'STOP');
 denied(()=>assertDcAutomaticDispatchAllowed(),'DC_AUTO_DISPATCH_NOT_AUTHORIZED');
});
test('tampered payload and tampered signature fail closed',()=>{
 const f=sample();
 const payload=JSON.parse(Buffer.from(f.signed.owner.claimsB64,'base64url').toString());
 payload.head='b'.repeat(40);
 denied(()=>f.evaluate({signed:{...f.signed,owner:{...f.signed.owner,
  claimsB64:Buffer.from(JSON.stringify(payload)).toString('base64url')}}}),
  'DC_DEV_EVIDENCE_SIGNATURE_INVALID');
 const raw=Buffer.from(f.signed.health.signatureB64,'base64url');raw[0]^=0x20;
 denied(()=>f.evaluate({signed:{...f.signed,health:{...f.signed.health,
  signatureB64:raw.toString('base64url')}}}),'DC_DEV_EVIDENCE_SIGNATURE_INVALID');
});
test('a fake ownerApproved, READY or runtime flags cannot act as signed proof',()=>{
 const f=sample();
 denied(()=>f.evaluate({signed:{...f.signed,owner:{ownerApproved:true}}}),
  'DC_DEV_EVIDENCE_TRUST_ROOT_INVALID');
 denied(()=>f.evaluate({signed:{...f.signed,health:{state:'READY',verified:true}}}),
  'DC_DEV_EVIDENCE_TRUST_ROOT_INVALID');
 denied(()=>f.evaluate({signed:{...f.signed,
  owner:{...f.signed.owner,ownerApproved:true}}}),'DC_DEV_EVIDENCE_TRUST_ROOT_INVALID');
});
test('exact nonce, project, task, head, device and operation are mandatory',()=>{
 const changes=[
  {head:'b'.repeat(40)}, {nonce:'nonce_other_123'}, {projectId:'project_other_123'},
  {workPackageId:'workpkg_other_123'}, {taskId:'task_other_123'},
  {deviceId:'china-mac'}, {operation:'start_process'},
  {repositoryIdentity:'other/repo'}];
 for(const change of changes){
  const f=sample();
  denied(()=>f.evaluate({binding:{...f.binding,...change}}),'DC_DEV_EVIDENCE_SCOPE_MISMATCH');
 }
});
test('expiry, future issue and excessive lifetime STOP',()=>{
 const f=sample();
 denied(()=>f.evaluate({nowMs:NOW+25000}),'DC_DEV_EVIDENCE_EXPIRED_OR_UNFRESH');
 denied(()=>f.evaluate({nowMs:NOW-10000}),'DC_DEV_EVIDENCE_EXPIRED_OR_UNFRESH');
 const longer={...f.claimOwner,expiresAtMs:NOW+90000};
 denied(()=>f.evaluate({signed:{...f.signed,owner:f.encode(longer,f.ownerKeys,f.roots.ownerRoot.keyId)}}),
  'DC_DEV_EVIDENCE_EXPIRED_OR_UNFRESH');
});
test('independent role keys, issuer, scope and typed read-only tool are enforced',()=>{
 const f=sample();
 denied(()=>f.evaluate({roots:{ownerRoot:f.roots.healthRoot,healthRoot:f.roots.ownerRoot}}),
  'DC_DEV_EVIDENCE_TRUST_ROOT_INVALID');
 denied(()=>f.evaluate({roots:{ownerRoot:f.roots.ownerRoot,healthRoot:f.roots.ownerRoot}}),
  'DC_DEV_EVIDENCE_ROLE_SEPARATION_REQUIRED');
 const changes=[
  {...f.claimOwner,issuer:'FAKE_OWNER'},
  {...f.claimOwner,devOnly:false},
  {...f.claimOwner,production:true},
  {...f.claimOwner,maxCalls:2},
  {...f.claimOwner,operation:'remote_call'},
  {...f.claimOwner,healthSource:'extra'}
 ];
 for(const claim of changes){
  const expected=claim.issuer!=='DEV_OWNER_TEST_ISSUER'||Object.hasOwn(claim,'healthSource')
   ?'DC_DEV_EVIDENCE_CLAIMS_INVALID':'DC_DEV_EVIDENCE_SCOPE_MISMATCH';
  denied(()=>f.evaluate({signed:{...f.signed,
   owner:f.encode(claim,f.ownerKeys,f.roots.ownerRoot.keyId)}}),expected);
 }
});
test('same public-key bytes with different keyIds cannot impersonate two roles',()=>{
 const f=sample();
 const spoofRoots={ownerRoot:f.roots.ownerRoot,healthRoot:{
  keyId:'separate_fake_id_123',publicKey:f.roots.ownerRoot.publicKey}};
 const spoofHealth=f.encode(f.claimHealth,f.ownerKeys,spoofRoots.healthRoot.keyId);
 denied(()=>f.evaluate({roots:spoofRoots,signed:{...f.signed,health:spoofHealth}}),
  'DC_DEV_EVIDENCE_ROLE_SEPARATION_REQUIRED');
});
test('private KeyObject and private PEM are rejected as trust anchors',()=>{
 const f=sample();
 denied(()=>f.evaluate({roots:{...f.roots,ownerRoot:{
  keyId:f.roots.ownerRoot.keyId,publicKey:f.ownerKeys.privateKey}}}),
  'DC_DEV_EVIDENCE_TRUST_ROOT_INVALID');
 denied(()=>f.evaluate({roots:{...f.roots,healthRoot:{
  keyId:f.roots.healthRoot.keyId,
  publicKey:f.healthKeys.privateKey.export({format:'pem',type:'pkcs8'})}}}),
  'DC_DEV_EVIDENCE_TRUST_ROOT_INVALID');
});
test('unauthorized key, invalid canonical JSON and evidence replay claims reject',()=>{
 const f=sample();
 const outsider=generateKeyPairSync('ed25519');
 const faked=f.encode(f.claimOwner,outsider,f.roots.ownerRoot.keyId);
 denied(()=>f.evaluate({signed:{...f.signed,owner:faked}}),'DC_DEV_EVIDENCE_SIGNATURE_INVALID');
 const dup=Buffer.from(JSON.stringify(f.claimOwner).replace('"role":','"role":"OWNER_SCOPE","role":'));
 const signedDup={...f.signed.owner,claimsB64:dup.toString('base64url'),
  signatureB64:sign(null,Buffer.concat([Buffer.from(DEV_EVIDENCE_DOMAIN),dup]),
   f.ownerKeys.privateKey).toString('base64url')};
 denied(()=>f.evaluate({signed:{...f.signed,owner:signedDup}}),
  'DC_DEV_EVIDENCE_CLAIMS_INVALID');
});
