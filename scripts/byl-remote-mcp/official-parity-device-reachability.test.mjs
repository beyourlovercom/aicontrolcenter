import test from 'node:test';
import assert from 'node:assert/strict';
import {createDeviceReachabilityView} from './official-parity-device-reachability.mjs';

test('never infers READY; distinguishes reachable and unreachable from real read-only transport',async()=>{
 const events=[];let now=1000000;
 const r=createDeviceReachabilityView({clock:()=>now,agentGet:async(id,path)=>{
  events.push([id,path]);
  if(id==='windows')throw Error('sensitive upstream transport detail');
  return {tools:[{name:'read_file'}]};
 }});
 assert.deepEqual(r.peek().map(x=>x.state),['unknown','unknown','unknown','unknown']);
 const values=await r.list();
 assert.deepEqual(values.map(x=>x.state),['reachable','reachable','unreachable','reachable']);
 assert(values.every(x=>x.verified===false&&x.registered===true&&!('target' in x)));
 assert.equal(values[2].reason,'AGENT_PROBE_FAILED');
 assert.equal(JSON.stringify(values).includes('sensitive upstream'),false);
 assert.equal(events.length,4);
 assert(events.every(x=>x[1]==='/v1/tools'));
 await r.list();
 assert.equal(events.length,4);
});
test('TTL expiry re-probes safely; recovery changes unreachable to reachable',async()=>{
 let tick=1000,working=false,calls=0;
 const r=createDeviceReachabilityView({clock:()=>tick,ttlMs:1000,agentGet:async()=>{
  calls++;if(!working)throw Error('offline');return {tools:[{name:'read_file'}]};
 }});
 assert((await r.list()).every(x=>x.state==='unreachable'));
 working=true;tick+=999;
 assert((await r.list()).every(x=>x.state==='unreachable'));
 assert.equal(calls,4);
 tick+=2;
 assert((await r.list()).every(x=>x.state==='reachable'));
 assert.equal(calls,8);
});
test('concurrent list calls coalesce inflight probes and keep registration fixed',async()=>{
 const waits=[];let calls=0;
 const r=createDeviceReachabilityView({agentGet:()=>{
  calls++;return new Promise(resolve=>waits.push(resolve));
 }});
 const a=r.list(),b=r.list();
 assert.equal(calls,4);
 for(const resolve of waits)resolve({tools:[{name:'get_file_info'}]});
 const [x,y]=await Promise.all([a,b]);
 assert.deepEqual(x,y);assert.equal(x.length,4);assert.equal(calls,4);
});
test('malformed responses fail closed; no secrets or bogus capability reachability',async()=>{
 const variants=[null,{}, {tools:[]},{tools:[{name:'BAD-CODE'}]}, {tools:[{name:'read_file'},{name:'read_file'}]}];
 for(const response of variants){
  const r=createDeviceReachabilityView({agentGet:async()=>response});
  assert((await r.list()).every(x=>x.state==='unreachable'));
 }
 assert.throws(()=>createDeviceReachabilityView({agentGet:()=>0,ttlMs:0}),/DEVICE_REACHABILITY_DEPENDENCY_INVALID/);
});
