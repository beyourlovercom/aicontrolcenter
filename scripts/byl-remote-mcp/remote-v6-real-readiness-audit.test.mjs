import test from 'node:test';
import assert from 'node:assert/strict';
import {DEVICE_IDS,REQUIRED_RELEASE_GATES,buildFourDeviceRealReadinessReport,
  normalizeToolObservation} from './remote-v6-real-readiness-audit.mjs';

const NOW=1792400000000;
const reg=Object.fromEntries(DEVICE_IDS.map(id=>[id,{state:'READY'}]));
const good=id=>({status:'tool_call_success',toolCount:24,observedAtMs:NOW});
const out=(status,toolCount=null)=>({status,toolCount,observedAtMs:NOW});
const defaultObs=()=>Object.fromEntries(DEVICE_IDS.map(id=>[id,good(id)]));
const build=(observations=defaultObs(),registry=reg,nowMs=NOW)=>
  buildFourDeviceRealReadinessReport({registry,observations,nowMs});

test('concrete 2026-10-19 observation: static READY lies about 007windows parity unreachable',()=>{
 const o={...defaultObs(),'007windows':out('parity_agent_unreachable')};
 const x=build(o);
 assert.deepEqual(x.staticReadyContradictions,['007windows']);
 assert.equal(x.devices[0].controlPlane,'unreachable');
 assert.equal(x.devices[0].controlReason,'PARITY_AGENT_UNREACHABLE');
 assert.equal(x.devices[0].registryRaw,'READY');
 assert.equal(x.devices[0].exactDeviceReleaseReady,false);
 assert(x.devices.filter(y=>y.deviceId!=='007windows').every(y=>y.toolCount===24));
 assert.equal(x.decision,'HOLD');
 assert.equal(x.canDeploy,false);
 assert.equal(x.canReplaceStaticReady,false);
 assert(Object.isFrozen(x)&&Object.isFrozen(x.devices)&&Object.isFrozen(x.devices[0]));
});
test('even four successful operational tool calls are NOT signed Agent proof',()=>{
 const report=build();
 assert(report.devices.every(x=>x.controlPlane==='tool_call_success'&&x.toolCount===24));
 assert(report.devices.every(x=>x.signedHealth==='unknown'&&!x.signedHealthCryptographicallyVerified));
 assert.equal(report.realFourDeviceSignedUat,'NOT_COMPLETE');
 assert.equal(report.cryptoSignedAgentProof,'NOT_OBSERVED');
 assert.equal(report.canDeploy,false);
});
test('platform safety denial must be unknown rather than backend offline, no fallback instruction',()=>{
 const x=build({...defaultObs(),windows:out('platform_safety_block')});
 const w=x.devices.find(z=>z.deviceId==='windows');
 assert.equal(w.controlPlane,'unknown');
 assert.equal(w.controlReason,'PLATFORM_SAFETY_CHECK_BLOCKED');
 assert.equal(x.staticReadyContradictions.length,0);
 assert(x.evidenceLimits.includes('DO_NOT_RETRY_PLATFORM_SAFETY_BLOCK_VIA_ALTERNATE_LINK'));
});
test('stale tool-success observations do not imply current reachability',()=>{
 const x=build(defaultObs(),reg,NOW+30001);
 assert(x.devices.every(y=>y.controlPlane==='unknown'&&y.toolCount===null));
 assert(x.devices.every(y=>y.controlReason==='STALE_OR_INVALID_TIMESTAMP'));
 assert.equal(x.canDeploy,false);
});
test('future timestamps fail safely without signing proof',()=>{
 const x=build(defaultObs(),reg,NOW-2000);
 assert(x.devices.every(y=>y.controlPlane==='unknown'));
});
test('missing or extra fifth devices cannot be accepted',()=>{
 const observations=defaultObs();
 delete observations.windows;
 assert.throws(()=>build(observations),/EXACT_FOUR_DEVICE_SET_REQUIRED/);
 const extra={...defaultObs(),othermachine:good('othermachine')};
 assert.throws(()=>build(extra),/EXACT_FOUR_DEVICE_SET_REQUIRED/);
});
test('registry input cannot be used to smuggle attacker URL or false signed READY',()=>{
 const malformed={...reg,'us-macmini':{state:'READY',endpoint:'https://attacker'}};
 assert.throws(()=>build(defaultObs(),malformed),/REGISTRY_SHAPE_INVALID/);
});
test('only bounded, sanitized result codes and tool counts',()=>{
 assert.throws(()=>normalizeToolObservation({status:'READY',toolCount:24,observedAtMs:NOW},{nowMs:NOW}),/STATUS_NOT_ALLOWED/);
 assert.throws(()=>normalizeToolObservation({status:'tool_call_success',toolCount:Infinity,observedAtMs:NOW},{nowMs:NOW}),/TOOL_COUNT_INVALID/);
 assert.throws(()=>normalizeToolObservation({status:'tool_call_success',toolCount:250,observedAtMs:NOW},{nowMs:NOW}),/TOOL_COUNT_INVALID/);
 assert.throws(()=>normalizeToolObservation({status:'parity_agent_unreachable',toolCount:24,observedAtMs:NOW},{nowMs:NOW}),/NON_SUCCESS_HAS_TOOL_COUNT/);
});
test('raw errors and tokens are not accepted, echoed or logged',()=>{
 const o={...defaultObs(),windows:{
  status:'parity_agent_unreachable',toolCount:null,observedAtMs:NOW,
  rawError:'Bearer Secret-Token and path'
 }};
 assert.throws(()=>build(o),/OBSERVATION_SHAPE_INVALID/);
 assert(!JSON.stringify(build()).includes('Bearer'));
});
test('release gates remain blocked regardless of operational observations',()=>{
 const x=build();
 assert.equal(REQUIRED_RELEASE_GATES.length,8);
 assert(REQUIRED_RELEASE_GATES.includes('REAL_AGENT_R2A_RECOVERABLE_BACKUP_AND_ISOLATED_RESTORE'));
 assert(REQUIRED_RELEASE_GATES.includes('INDEPENDENT_ISSUER_AND_FOUR_SIGNER_KEY_WITNESS_ENROLLMENT'));
 assert.equal(x.canDeploy,false);
 assert.equal(x.canReplaceStaticReady,false);
 assert.equal(x.ownerReleaseAuthorization,'NOT_GRANTED');
 assert(!Object.hasOwn(x,'promote'));
});
test('registrar UNKNOWN does not masquerade as configured despite tools responding',()=>{
 const r={...reg,windows:{state:'UNKNOWN'}};
 const x=build(defaultObs(),r);
 const w=x.devices.find(y=>y.deviceId==='windows');
 assert.equal(w.registryConfigured,false);
 assert.equal(w.signedHealth,'unknown');
 assert.equal(w.exactDeviceReleaseReady,false);
});
