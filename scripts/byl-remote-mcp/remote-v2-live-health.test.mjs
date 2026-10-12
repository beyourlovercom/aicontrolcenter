import test from 'node:test';
import assert from 'node:assert/strict';
import {createLiveHealthMonitor} from './remote-v2-live-health.mjs';

const registry=Object.freeze({
  'us-macmini':Object.freeze({id:'us-macmini'}),
  'china-mac':Object.freeze({id:'china-mac'}),
  'windows':Object.freeze({id:'windows'})
});
const success=async({deviceId})=>({ok:true,authenticated:true,deviceId});

test('newly registered devices are unknown rather than static READY',()=>{
  const monitor=createLiveHealthMonitor({registry,probeDevice:success});
  assert.deepEqual(monitor.peek().map(x=>x.state),['unknown','unknown','unknown']);
  assert(monitor.peek().every(x=>x.registered && x.verified===false));
});

test('only signed, identity-bound probe results qualify as reachable',async()=>{
  const x=createLiveHealthMonitor({registry,probeDevice:success});
  const statuses=await x.list();
  assert.equal(statuses.length,3);
  assert(statuses.every(v=>v.state==='reachable' && v.verified));
  assert.deepEqual(statuses.map(v=>v.id),Object.keys(registry));
});
test('unsigned success never becomes reachable',async()=>{
  const x=createLiveHealthMonitor({registry,probeDevice:async({deviceId})=>({ok:true,deviceId})});
  const status=await x.check('china-mac');
  assert.equal(status.state,'unknown');
  assert.equal(status.reason,'MALFORMED_RESPONSE');
});
test('identity mismatch never becomes reachable',async()=>{
  const x=createLiveHealthMonitor({registry,probeDevice:async()=>({ok:true,authenticated:true,deviceId:'us-macmini'})});
  const record=await x.check('china-mac');
  assert.equal(record.verified,false);
  assert.equal(record.state,'unknown');
});
test('Tailscale stopped or transport failure produces unreachable, not fake READY',async()=>{
  const x=createLiveHealthMonitor({registry,probeDevice:async({deviceId})=>deviceId==='china-mac'?
    {ok:false,code:'UNREACHABLE'}:{ok:true,authenticated:true,deviceId}});
  const states=(await x.list()).map(v=>v.state);
  assert.deepEqual(states,['reachable','unreachable','reachable']);
});
test('signed health request rejects arbitrary unregistered device',async()=>{
  const x=createLiveHealthMonitor({registry,probeDevice:success});
  await assert.rejects(x.check('attacker-server'),/UNREGISTERED_DEVICE/);
});
test('fresh responses cached and returned with explicit cache marker',async()=>{
  let calls=0,now=1000;
  const x=createLiveHealthMonitor({registry,clock:()=>now,ttlMs:100,probeDevice:async i=>{calls++;return success(i)}});
  assert.equal((await x.check('windows')).cache,'refreshed');
  assert.equal((await x.check('windows')).cache,'fresh');
  assert.equal(calls,1);
  now=1100;
  assert.equal((await x.check('windows')).cache,'refreshed');
  assert.equal(calls,2);
});
test('stale records never claim to be verified online',async()=>{
  let now=1000;
  const x=createLiveHealthMonitor({registry,clock:()=>now,ttlMs:50,probeDevice:success});
  await x.check('china-mac');
  now=1100;
  const peek=x.peek().find(v=>v.id==='china-mac');
  assert.equal(peek.state,'unknown');
  assert.equal(peek.verified,false);
  assert.equal(peek.reason,'STALE');
});
test('force bypasses cache after previous healthy check',async()=>{
  let calls=0;
  const x=createLiveHealthMonitor({registry,probeDevice:async i=>{calls++;return success(i)}});
  await x.check('windows');
  await x.check('windows',{force:true});
  assert.equal(calls,2);
});
test('concurrent requests for same device coalesce into one probe',async()=>{
  let calls=0,complete;
  const x=createLiveHealthMonitor({registry,probeDevice:()=>{
    calls++;return new Promise(resolve=>{complete=resolve});
  }});
  const first=x.check('china-mac');
  const second=x.check('china-mac');
  await Promise.resolve();
  complete({ok:true,authenticated:true,deviceId:'china-mac'});
  assert.equal((await first).state,'reachable');
  assert.equal((await second).state,'reachable');
  assert.equal(calls,1);
});
test('timed-out probe terminates bounded wait, not hanging forever',async()=>{
  const x=createLiveHealthMonitor({registry,timeoutMs:10,probeDevice:async()=>new Promise(()=>{})});
  const started=Date.now();
  const result=await x.check('china-mac');
  assert.equal(result.state,'unreachable');
  assert.equal(result.reason,'TIMEOUT');
  assert(Date.now()-started<1000);
});
test('internal errors are sanitized, no secret leaks',async()=>{
  const x=createLiveHealthMonitor({registry,probeDevice:async()=>{throw Error('secret API token value')}});
  const result=await x.check('windows');
  assert.equal(result.reason,'PROBE_ERROR');
  assert(!JSON.stringify(result).includes('secret'));
});
test('maximum probe concurrency is enforced',async()=>{
  let active=0,peak=0;
  const x=createLiveHealthMonitor({registry,maxConcurrency:1,probeDevice:async input=>{
    active++;peak=Math.max(peak,active);
    await new Promise(resolve=>setTimeout(resolve,3));
    active--;return success(input);
  }});
  await x.list();
  assert.equal(peak,1);
});
test('invalid configuration refused with no probes',()=>{
  assert.throws(()=>createLiveHealthMonitor({registry,probeDevice:success,ttlMs:-1}),/TTL_INVALID/);
  assert.throws(()=>createLiveHealthMonitor({registry,probeDevice:success,timeoutMs:0}),/TIMEOUT_INVALID/);
  assert.throws(()=>createLiveHealthMonitor({registry,probeDevice:success,maxConcurrency:0}),/CONCURRENCY_INVALID/);
  assert.throws(()=>createLiveHealthMonitor({registry,probeDevice:null}),/SIGNED_PROBE_REQUIRED/);
});
