import test from 'node:test';
import assert from 'node:assert/strict';
import {evaluateA4ServicePreflight} from './official-parity-a4-service-preflight.mjs';
const gitSha='0d8806b1d077fe32ff117ffd0e3b3a57915cf9a0';
const fakeSha='a'.repeat(64);
function evidence(){
 return {
  repo:{mainSha:gitSha,reviewedSha:gitSha},
  ci:{foundation:'success',parity:'success'},
  service:{
   manager:'launchd',label:'com.byl.remote-mcp-oauth-compat',
   pid:28984,listenerPid:28984,host:'127.0.0.1',port:8797,path:'/oauth/mcp',
   healthCode:200,unauthCode:401,
   runtimeModifiedAt:'2026-10-12T08:56:55Z',runtimeSha256:fakeSha
  },
  rollback:{
   createdAt:'2026-10-15T00:00:00Z',sha256:fakeSha,
   privateStorage:true,restoreRehearsalVerified:true
  },
  access:{legacyNames:['remote_list_devices','remote_list_tools',
   'remote_call','remote_process_selftest'],newDirectCount:0},
  devices:Object.fromEntries(['us-macmini','china-mac','windows','007windows']
   .map(id=>[id,{hostnameObserved:true}])),
  privateConfigVerified:true,operatorPolicyVerified:true,
  ownerExactReleaseApproval:true
 };
}
test('validated metadata can only declare ready for HUMAN review, not deploy',()=>{
 const r=evaluateA4ServicePreflight(evidence());
 assert.equal(r.status,'READY_FOR_HUMAN_RELEASE_REVIEW');
 assert.equal(r.canDeploy,false);
 assert.deepEqual(r.blockers,[]);
});
test('existing Oct 11 backup predating Oct 12 live change BLOCKS release',()=>{
 const e=evidence();
 e.rollback.createdAt='2026-10-11T01:00:00Z';
 const r=evaluateA4ServicePreflight(e);
 assert.equal(r.status,'BLOCKED');
 assert(r.blockers.includes('CURRENT_RUNTIME_SNAPSHOT_MISSING'));
 assert.equal(r.canDeploy,false);
});
test('no snapshot, no verified restore, no exact release approval all block',()=>{
 const e=evidence();
 e.rollback={};e.ownerExactReleaseApproval=false;
 const r=evaluateA4ServicePreflight(e);
 assert(r.blockers.includes('CURRENT_RUNTIME_SNAPSHOT_MISSING'));
 assert(r.blockers.includes('ROLLBACK_BYTES_NOT_VERIFIED'));
 assert(r.blockers.includes('PRIVATE_ROLLBACK_NOT_REHEARSED'));
 assert(r.blockers.includes('EXACT_RELEASE_APPROVAL_NOT_RECORDED'));
});
test('MCP legacy name drift / unsigned offline devices / unexpected direct tools block',()=>{
 for(const fn of [
  e=>e.access.legacyNames.push('dc_write_file'),
  e=>e.access.newDirectCount=5,
  e=>e.devices['007windows'].hostnameObserved=false,
  e=>{delete e.devices['china-mac'];}
 ]){
  const e=evidence();fn(e);
  const r=evaluateA4ServicePreflight(e);
  assert.equal(r.status,'BLOCKED');
  assert(r.blockers.some(x=>x==='LEGACY_MCP_INVENTORY_DRIFT'||
    x==='FOUR_DEVICE_READONLY_BASELINE_MISSING'));
 }
});
test('wrong listener PID, public binding, alternate route or HTTP auth bypass block',()=>{
 for(const fn of [
  e=>e.service.listenerPid=123,
  e=>e.service.host='0.0.0.0',
  e=>e.service.port=8792,
  e=>e.service.path='/mcp',
  e=>e.service.unauthCode=200
 ]){
  const e=evidence();fn(e);
  assert.equal(evaluateA4ServicePreflight(e).status,'BLOCKED');
 }
});
test('different sha/CI, invalid private config and wrong backup bytes block',()=>{
 for(const fn of [
  e=>e.repo.reviewedSha='b'.repeat(40),
  e=>e.ci.parity='failure',
  e=>e.privateConfigVerified=false,
  e=>e.operatorPolicyVerified=false,
  e=>e.rollback.sha256='b'.repeat(64)
 ]){
  const e=evidence();fn(e);
  assert.equal(evaluateA4ServicePreflight(e).status,'BLOCKED');
 }
});
test('missing/invalid evidence returns safe blockers, no credentials or paths',()=>{
 for(const payload of [null,undefined,[],{},'invalid']){
  const r=evaluateA4ServicePreflight(payload);
  assert.equal(r.status,'BLOCKED');
  assert.equal(r.canDeploy,false);
  assert.equal(JSON.stringify(r).includes('/Users/'),false);
 }
});
test('the report never propagates private keys, host values or backup storage paths',()=>{
 const e=evidence();
 e.privateKey='SECRET_DO_NOT_PRINT';
 e.service.backupPath='/Users/a/private/auth/oauth-backup';
 const r=evaluateA4ServicePreflight(e);
 assert.equal(JSON.stringify(r).includes('SECRET_DO_NOT_PRINT'),false);
 assert.equal(JSON.stringify(r).includes('/Users/a'),false);
});
