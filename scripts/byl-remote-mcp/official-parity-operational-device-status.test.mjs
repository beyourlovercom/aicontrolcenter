import test from 'node:test';
import assert from 'node:assert/strict';
import {createOperationalDeviceStatusReader,registeredOnlyDeviceList}
  from './official-parity-operational-device-status.mjs';

const T=1792400000000;
const fixed=()=>T;
const IDS=['us-macmini','china-mac','windows','007windows'];
test('default registration-only is honest and makes ZERO probes',()=>{
 const rows=registeredOnlyDeviceList();
 assert.deepEqual(rows.map(x=>x.id),IDS);
 assert(rows.every(x=>x.state==='REGISTERED'&&x.controlPlane==='UNKNOWN'));
 assert(rows.every(x=>x.signedHealth==='NOT_VERIFIED'&&x.toolCount===null));
 assert(!JSON.stringify(rows).includes('READY'));
});
test('real existing fixed /v1/tools getter proves tool operability only; 007 unreachable',async()=>{
 const seen=[],api=createOperationalDeviceStatusReader({
  clock:fixed,agentGet:async(id,path)=>{
   seen.push([id,path]);
   if(id==='007windows')throw Error('PARITY_AGENT_UNREACHABLE');
   return {tools:[{name:'get_file_info'},{name:'list_processes'}]};
  }
 });
 assert.equal(seen.length,0);
 const result=await api.list();
 assert.deepEqual(seen.map(x=>x[0]).sort(),[...IDS].sort());
 assert(seen.every(x=>x[1]==='/v1/tools'));
 assert.deepEqual(result.map(x=>x.id),IDS);
 assert(result.slice(0,3).every(x=>x.state==='OPERABLE'&&x.toolCount===2));
 assert.equal(result[3].state,'UNREACHABLE');
 assert.equal(result[3].reason,'AGENT_TOOL_TRANSPORT_UNREACHABLE');
 assert(result.every(x=>x.signedHealth==='NOT_VERIFIED'&&x.registered));
 assert.equal((await api.list()).length,4);
 assert.equal(seen.length,4,'bounded TTL prevents repeated network calls');
});
test('transport auth/response errors never become false online',async()=>{
 for(const reply of [true,{ok:true},{tools:'not array'},
  {tools:[{name:'bad tool'}]}, {isError:true}]) {
  const api=createOperationalDeviceStatusReader({clock:fixed,agentGet:async()=>reply});
  assert((await api.list()).every(x=>x.state==='UNKNOWN'));
 }
 const api=createOperationalDeviceStatusReader({
  clock:fixed,agentGet:async()=>{throw Error('PRIVATE_ACCOUNT_OR_SECRET_123');}
 });
 const rows=await api.list();
 assert(rows.every(x=>x.reason==='TOOL_PROBE_NOT_VERIFIED'));
 assert(!JSON.stringify(rows).includes('SECRET_123'));
});
test('probe TTL invalidates stale result without cached static READY',async()=>{
 let now=T,n=0;
 const reader=createOperationalDeviceStatusReader({
  clock:()=>now,ttlMs:1000,
  agentGet:async()=>{n++;return {tools:[{name:'safe_tool'}]};}
 });
 assert(reader.peek().every(x=>x.state==='UNKNOWN'));
 await reader.list();assert.equal(n,4);
 now+=999;
 assert(reader.peek().every(x=>x.state==='OPERABLE'));
 await reader.list();assert.equal(n,4);
 now+=2;
 assert(reader.peek().every(x=>x.state==='UNKNOWN'));
 await reader.list();assert.equal(n,8);
});
test('every list call is at most TWO network operations concurrently',async()=>{
 let current=0,max=0;
 const reader=createOperationalDeviceStatusReader({clock:fixed,
  agentGet:async()=>{
   current++;max=Math.max(max,current);
   await new Promise(resolve=>setTimeout(resolve,2));
   current--;
   return {tools:[{name:'get_file_info'}]};
  }});
 const [a,b]=await Promise.all([reader.list(),reader.list()]);
 assert.equal(max,2);assert(a.every(x=>x.state==='OPERABLE'));assert(b.every(x=>x.state==='OPERABLE'));
});
test('unresponsive probe times out as UNKNOWN, never signed proof or static ready',async()=>{
 const reader=createOperationalDeviceStatusReader({
  clock:fixed,timeoutMs:100,
  agentGet:()=>new Promise(()=>{})
 });
 const result=await reader.list();
 assert(result.every(x=>x.state==='UNKNOWN'&&x.reason==='PROBE_TIMEOUT'));
 assert(result.every(x=>x.signedHealth==='NOT_VERIFIED'));
});
test('prevents arbitrary probe paths, target changes, invalid constructor configuration',async()=>{
 assert.throws(()=>createOperationalDeviceStatusReader({agentGet:()=>{},ttlMs:-1}),/DEVICE_STATUS_LIMIT_INVALID/);
 assert.throws(()=>createOperationalDeviceStatusReader(),/DEVICE_STATUS_DEPENDENCIES_REQUIRED/);
 const reader=createOperationalDeviceStatusReader({agentGet:async()=>({tools:[]}),clock:fixed});
 assert.deepEqual(Object.keys(reader).sort(),['list','peek','staticIds']);
 assert.deepEqual(reader.staticIds,IDS);
 assert.equal(Object.isFrozen(reader),true);
});
