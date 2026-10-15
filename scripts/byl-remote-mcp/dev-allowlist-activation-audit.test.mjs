import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateDevActivation,evaluateG1StatusActivation} from './dev-allowlist-activation-audit.mjs';

function valid(){
 return {
 runtime:{sourceRepo:'beyourlovercom/aicontrolcenter',sourceRef:'main',
   commitSha:'a'.repeat(40),sourceParityVerified:true,productionGatewayUntouched:true,
   devOnlyBindingVerified:true,existingRemoteToolsPreserved:true,fourDevicePolicyPreserved:true},
 platform:{formalOAuthVerified:true,ownerActionReviewComplete:true,
   discoveredToolNames:['dev_release_prepare','dev_release_apply','dev_release_status','dev_release_rollback'],
   invokeAuthorizedToolNames:['dev_release_prepare','dev_release_apply','dev_release_status','dev_release_rollback']},
 receiver:{hostIdentity:'dev.beyourlover.com',noGeneralShell:true,
   preimageReadOnlyPassed:true,backupOutsideWebVerified:true,
   rollbackVerified:true,noOtherProjectsWritable:true},
 authority:{issuerVerified:true,ownerReceiptStoreVerified:true,
   githubHeadAndCIIndependent:true,artifactImmutableVerified:true,
   durableLockAndJournalVerified:true,crashRecoveryVerified:true},
 release:{environment:'dev',project:'byl-wordpress-core',ownerCanaryApproved:true,
   exactPathsAndHashesVerified:true,noCommerceOrWWWChanges:true,
   currentPrHeadAndFourCiPassed:true},
 };
}
test('missing all independent live probes cannot declare Dev Canary ready',()=>{
 const r=evaluateDevActivation();
 assert.equal(r.status,'BLOCKED');
 assert.equal(r.canApply,false);
 assert.equal(r.blockers.length,5);
});
test('a fully verified snapshot is readiness only, never an apply grant',()=>{
 const r=evaluateDevActivation(valid());
 assert.equal(r.status,'READY_FOR_SEPARATE_CANARY');
 assert.equal(r.canApply,false);
});
test('missing newly registered MCP tool blocks even with healthy OAuth',()=>{
 const v=valid();v.platform.discoveredToolNames.splice(0,1);
 assert.deepEqual(evaluateDevActivation(v).blockers,['G1_FORMAL_TOOL_REGISTRATION']);
});
test('server visibility does not replace ChatGPT action review + invocation',()=>{
 for(const key of ['ownerActionReviewComplete','invokeAuthorizedToolNames']){
  const v=valid();v.platform[key]=key==='invokeAuthorizedToolNames'?[]:false;
  assert.equal(evaluateDevActivation(v).status,'BLOCKED');
 }
});
test('main missing runtime provenance / production gateway evidence fails closed',()=>{
 for(const key of ['sourceParityVerified','productionGatewayUntouched','devOnlyBindingVerified',
 'existingRemoteToolsPreserved','fourDevicePolicyPreserved']){
  const v=valid();v.runtime[key]=false;
  assert.ok(evaluateDevActivation(v).blockers.includes('G1_RUNTIME_PROVENANCE'));
 }
});
test('WWW or Commerce receiver and unverified rollback refused',()=>{
 for(const [key,value] of [['hostIdentity','www.beyourlover.com'],['noGeneralShell',false],
 ['backupOutsideWebVerified',false],['noOtherProjectsWritable',false],['rollbackVerified',false]]){
  const v=valid();v.receiver[key]=value;
  assert.ok(evaluateDevActivation(v).blockers.includes('G2_DEV_RECEIVER_NOT_VERIFIED'));
 }
});
test('no trusted journal/attestation or immutable artifact cannot declare ready',()=>{
 for(const key of ['issuerVerified','ownerReceiptStoreVerified',
 'githubHeadAndCIIndependent','artifactImmutableVerified','durableLockAndJournalVerified','crashRecoveryVerified']){
  const v=valid();v.authority[key]=false;
  assert.ok(evaluateDevActivation(v).blockers.includes('G2_AUTHORITY_NOT_VERIFIED'));
 }
});
test('current PR exact head and four-CI evidence must not be stale',()=>{
 for(const key of ['ownerCanaryApproved','exactPathsAndHashesVerified',
 'currentPrHeadAndFourCiPassed','noCommerceOrWWWChanges']){
  const v=valid();v.release[key]=false;
  assert.ok(evaluateDevActivation(v).blockers.includes('G3_CANARY_APPROVAL_MISSING'));
 }
});
test('readiness never mutates input, and checks cannot grant deployment',()=>{
 const v=valid();const before=structuredClone(v);const r=evaluateDevActivation(v);
 assert.deepEqual(v,before);assert.equal(r.canApply,false);
 assert.equal(Object.isFrozen(r),true);
});

function validG1(){
 const v=valid();
 v.platform.discoveredToolNames=['dev_release_status'];
 v.platform.invokeAuthorizedToolNames=['dev_release_status'];
 return {runtime:v.runtime,platform:v.platform,statusBackend:{
  noFilesystemMutationsVerified:true,noDevBusinessWritesVerified:true,
  readAuthorizationVerified:true}};
}
test('G1 status-only gate does not require G2 receiver, G3 artifact or mutating tools',()=>{
 const r=evaluateG1StatusActivation(validG1());
 assert.equal(r.status,'READY_FOR_STATUS_UAT');
 assert.equal(r.canApply,false);
 assert.deepEqual(r.toolNames,['dev_release_status']);
});
test('G1 refuses to expose prepare, apply or rollback early',()=>{
 for(const key of ['discoveredToolNames','invokeAuthorizedToolNames']){
  const v=validG1();v.platform[key].push('dev_release_apply');
  assert.deepEqual(evaluateG1StatusActivation(v).blockers,['G1_STATUS_ONLY_TOOL_REGISTRATION']);
 }
});
test('G1 status backend cannot use directory-creating get() without independent no-write proof',()=>{
 for(const key of ['noFilesystemMutationsVerified','noDevBusinessWritesVerified','readAuthorizationVerified']){
  const v=validG1();v.statusBackend[key]=false;
  assert.deepEqual(evaluateG1StatusActivation(v).blockers,['G1_STATUS_READ_ONLY_NOT_VERIFIED']);
 }
});
test('G1 requires current four-device policy and original handler compatibility',()=>{
 const v=validG1();v.runtime.fourDevicePolicyPreserved=false;
 assert.deepEqual(evaluateG1StatusActivation(v).blockers,['G1_RUNTIME_PROVENANCE']);
});
test('G1 partial readiness diagnostics fail closed without real operator evidence',()=>{
 const r=evaluateG1StatusActivation();
 assert.equal(r.status,'BLOCKED');assert.equal(r.blockers.length,3);
 assert.equal(r.canApply,false);
});
