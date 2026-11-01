import test from 'node:test';
import assert from 'node:assert/strict';
import {DC_PRIMARY_ID,DC_CANONICAL_DEVICES,DC_READ_ONLY_OPERATIONS,DC_APPROVED_DEV_SCOPE,
 assessDcSupervisedIntent,validateDcTypedReadIntent,assertDcAutomaticDispatchAllowed}
 from '../lib/dc-primary-gate-v3.mjs';
const scope=()=>({provider:DC_PRIMARY_ID,executionClass:'CODE_CHANGE',
 ...DC_APPROVED_DEV_SCOPE,
 actualMainSha:DC_APPROVED_DEV_SCOPE.mainSha,
 expectedHead:'b'.repeat(40),actualHead:'b'.repeat(40),
 actualBranch:DC_APPROVED_DEV_SCOPE.branch,
 ownerApproved:true,authenticatedFormalOAuth:true,deviceId:'us-macmini'});
const denied=(cb,code)=>assert.throws(cb,e=>e?.code===code);
test('V3 current named WP, exact main/branch and fixed device are enforced',()=>{
 const x=assessDcSupervisedIntent(scope());
 assert.deepEqual({decision:x.decision,reason:x.reason,auto:x.automaticDispatchAllowed},
 {decision:'STOP_GATE',reason:'DC_V3_INDEPENDENT_OWNER_ATTESTATION_REQUIRED',auto:false});
 assert.equal(x.independentAuthorization,'NOT_ATTESTED');assert(Object.isFrozen(x));
 for(const k of ['workPackageId','repositoryIdentity','mainSha','branch']){
  const s=scope();s[k]='untrusted';denied(()=>assessDcSupervisedIntent(s),'DC_V3_SCOPE_MISMATCH');
 }
 for(const k of ['actualMainSha','expectedHead','actualHead','actualBranch']){
  const s=scope();s[k]='c'.repeat(40);denied(()=>assessDcSupervisedIntent(s),'DC_V3_AUTHORITY_DRIFT');
 }
});
test('V3 never trusts caller-asserted approval, defaults to STOP',()=>{
 for(const ownerApproved of [true,false,'signed',undefined]){
  const x=assessDcSupervisedIntent({...scope(),ownerApproved});
  assert.equal(x.decision,'STOP_GATE');assert.equal(x.automaticDispatchAllowed,false);
 }
 denied(()=>assessDcSupervisedIntent({...scope(),deviceId:null}),'DC_V3_DEVICE_NOT_ALLOWLISTED');
 denied(()=>assessDcSupervisedIntent({...scope(),deviceId:'forged'}),'DC_V3_DEVICE_NOT_ALLOWLISTED');
 denied(()=>assessDcSupervisedIntent({...scope(),authenticatedFormalOAuth:false}),'DC_V3_FORMAL_OAUTH_REQUIRED');
 denied(()=>assessDcSupervisedIntent({...scope(),platformDenied:true}),'DC_V3_PLATFORM_DENIED');
});
test('V3 excludes Claude, unrelated provider and unscoped IDs',()=>{
 denied(()=>assessDcSupervisedIntent({...scope(),provider:'CLAUDE_CODE'}),'DC_V3_CLAUDE_RETIRED');
 denied(()=>assessDcSupervisedIntent({...scope(),provider:'CODEX'}),'DC_V3_PROVIDER_INVALID');
 denied(()=>assessDcSupervisedIntent({...scope(),workPackageId:''}),'DC_V3_SCOPE_MISMATCH');
});
test('only typed inventory/fixed selftest accepted; no arbitrary shell or file access',()=>{
 assert.equal(DC_CANONICAL_DEVICES.length,4);assert.equal(DC_READ_ONLY_OPERATIONS.length,3);
 assert.deepEqual(validateDcTypedReadIntent({op:'remote_list_devices'}),{op:'remote_list_devices'});
 assert.deepEqual(validateDcTypedReadIntent({op:'remote_list_tools',deviceId:'007windows'}),
  {op:'remote_list_tools',deviceId:'007windows'});
 denied(()=>validateDcTypedReadIntent({op:'remote_call',deviceId:'windows',arguments:{name:'start_process'}}),'DC_V3_TOOL_NOT_ALLOWLISTED');
 denied(()=>validateDcTypedReadIntent({op:'start_process',deviceId:'windows'}),'DC_V3_TOOL_NOT_ALLOWLISTED');
 denied(()=>validateDcTypedReadIntent({op:'remote_list_tools',deviceId:'unknown'}),'DC_V3_DEVICE_NOT_ALLOWLISTED');
 denied(()=>validateDcTypedReadIntent({op:'remote_list_tools',deviceId:'windows',arguments:{command:'ls'}}),'DC_V3_ARGUMENTS_INVALID');
});
test('automatic dispatch stays STOP until independently trusted adapter is approved',()=>{
 denied(()=>assertDcAutomaticDispatchAllowed(),'DC_AUTO_DISPATCH_NOT_AUTHORIZED');
});
