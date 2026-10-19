import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {signHealthResponse} from './remote-v2-signed-health.mjs';
import {createDeviceAvailabilityAdapter,classifyDcControlPlaneFailure}
  from './remote-v2-verified-availability.mjs';

const ids=['us-macmini','china-mac','windows','007windows'];
const registry=Object.fromEntries(ids.map(id=>[id,{id}]));
const keys=Object.fromEntries(ids.map(id=>[id,generateKeyPairSync('ed25519')]));
const publicKeys=Object.fromEntries(ids.map(id=>[id,keys[id].publicKey]));
const at=1792000000000;
const clock=()=>at;
const transport=async({deviceId,challenge})=>
  signHealthResponse(challenge,{privateKey:keys[deviceId].privateKey,clock});

test('registry remains unknown until signed probes, not fake READY',()=>{
  const a=createDeviceAvailabilityAdapter({registry,publicKeys,transport,clock});
  const r=a.peek();
  assert.equal(r.length,4);
  assert(r.every(x=>x.state==='unknown'&&!x.verified&&x.registered&&x.reason==='NOT_CHECKED'));
  assert(r.every(x=>x.probe==='not_performed'));
  assert(!JSON.stringify(r).includes('READY'));
  assert(Object.isFrozen(r)&&Object.isFrozen(r[0]));
});
test('four signed identity-bound device proofs become reachable in explicit Dev refresh only',async()=>{
  let calls=0;
  const a=createDeviceAvailabilityAdapter({registry,publicKeys,clock,
    transport:async args=>{calls++;return transport(args);}});
  assert.equal(calls,0);
  const r=await a.refresh();
  assert.equal(calls,4);
  assert.deepEqual(r.map(x=>x.id),ids);
  assert(r.every(x=>x.state==='reachable'&&x.verified&&x.probe==='SIGNED_RESPONSE_VERIFIED'));
  assert(r.every(x=>x.reason===null&&x.cache==='fresh'));
});
test('one absent pinned key is not probed and cannot be reported online',async()=>{
  let targets=[];
  const a=createDeviceAvailabilityAdapter({registry,
    publicKeys:{'us-macmini':publicKeys['us-macmini']},clock,
    transport:async x=>{targets.push(x.deviceId);return transport(x);}});
  const out=await a.refresh();
  assert.deepEqual(targets,['us-macmini']);
  assert.equal(out[0].state,'reachable');
  assert.equal(out[1].state,'unknown');
  assert.equal(out[1].reason,'TRUST_KEY_NOT_ENROLLED');
  assert.equal(out[3].reason,'TRUST_KEY_NOT_ENROLLED');
});
test('no pinned keys means unknown and ZERO remote calls',async()=>{
  let called=0;
  const a=createDeviceAvailabilityAdapter({registry,transport:async()=>{called++;},clock});
  assert((await a.refresh()).every(x=>x.reason==='TRUST_KEY_NOT_ENROLLED'));
  assert.equal(called,0);
});
test('wrong device signature is rejected even when response claims correct device',async()=>{
  const a=createDeviceAvailabilityAdapter({registry,publicKeys,clock,
    transport:async({deviceId,challenge})=>signHealthResponse(challenge,{
      privateKey:keys['us-macmini'].privateKey,clock})});
  const result=await a.refresh();
  assert.equal(result[1].state,'unknown');
  assert.equal(result[1].verified,false);
  assert.equal(result[1].reason,'AUTH_FAILED');
});
test('signed degraded status never claims healthy',async()=>{
  const a=createDeviceAvailabilityAdapter({registry,publicKeys,clock,
    transport:async({deviceId,challenge})=>signHealthResponse(challenge,{
      privateKey:keys[deviceId].privateKey,status:deviceId==='windows'?'degraded':'ready',clock})});
  const r=await a.refresh();
  assert.equal(r[2].state,'degraded');
  assert.equal(r[2].verified,true);
  assert.equal(r[2].reason,'AGENT_DEGRADED');
});
test('network unreachable classification does not fabricate signing proof',async()=>{
  const a=createDeviceAvailabilityAdapter({registry,publicKeys,clock,
    transport:async()=>{throw Error('secret agent address and token');}});
  const r=await a.refresh();
  assert(r.every(x=>x.state==='unreachable'&&!x.verified&&x.reason==='UNREACHABLE'));
  assert(!JSON.stringify(r).includes('secret'));
});
test('stale proof becomes unknown on existing TTL logic',async()=>{
  let now=at;
  const a=createDeviceAvailabilityAdapter({registry,publicKeys,
    clock:()=>now,ttlMs:100,transport:async({deviceId,challenge})=>
      signHealthResponse(challenge,{privateKey:keys[deviceId].privateKey,clock:()=>now})});
  await a.refresh();now+=100;
  assert(a.peek().every(x=>x.state==='unknown'&&!x.verified&&x.reason==='STALE'));
});
test('unsigned replies remain unknown',async()=>{
  const a=createDeviceAvailabilityAdapter({registry,publicKeys,clock,
    transport:async({deviceId})=>({deviceId,ok:true})});
  assert((await a.refresh()).every(x=>x.state==='unknown'&&!x.verified));
});
test('no arbitrary registry/unknown trust key expansion allowed',()=>{
  assert.throws(()=>createDeviceAvailabilityAdapter({registry:{},publicKeys,transport}),/REGISTRY_INVALID/);
  assert.throws(()=>createDeviceAvailabilityAdapter({
    registry,publicKeys:{...publicKeys,'random-host':publicKeys.windows},transport}),/UNREGISTERED_TRUST_KEY/);
  assert.throws(()=>createDeviceAvailabilityAdapter({registry,publicKeys}),/APPROVED_TRANSPORT_REQUIRED/);
});
test('provider quota distinct from safety block and settings UI; redact sensitive details',()=>{
  assert.equal(classifyDcControlPlaneFailure(
    "You've reached this month's Desktop Commander usage, so tool calls are paused."),
    'OLD_DC_PROVIDER_QUOTA_EXHAUSTED');
  assert.equal(classifyDcControlPlaneFailure(
    '此工具调用被 OpenAI 的安全检查屏蔽。请仔细检查你发送的内容。'),
    'CHATGPT_PLATFORM_SAFETY_BLOCK');
  assert.equal(classifyDcControlPlaneFailure('无法加载插件设置'),
    'CHATGPT_SETTINGS_UI_FAILURE_UNATTRIBUTED');
  assert.equal(classifyDcControlPlaneFailure(Error('Bearer SECRET-TOKEN 10.1.2.3')),
    'UNCLASSIFIED_FAILURE');
  assert(!JSON.stringify(classifyDcControlPlaneFailure('token-sensitive')).includes('sensitive'));
});
