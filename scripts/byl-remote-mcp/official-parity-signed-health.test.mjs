import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {signHealthResponse} from './remote-v2-signed-health.mjs';
import {createParitySignedMonitor,registerParityHealthTools,PARITY_DEVICES} from './official-parity-signed-health.mjs';
const keys=Object.fromEntries(PARITY_DEVICES.map(id=>[id,generateKeyPairSync('ed25519')]));
const publicKeys=Object.fromEntries(PARITY_DEVICES.map(id=>[id,keys[id].publicKey]));
const now=1792000000000,clock=()=>now;
const valid=({deviceId,challenge})=>signHealthResponse(challenge,{privateKey:keys[deviceId].privateKey,clock});
function monitor({transport=valid}={}){
 return createParitySignedMonitor({transport,publicKeys,clock,ttlMs:15000});
}
function tools({principal={kind:'cloudflare-access',canOperate:true},
 allow=true,service=monitor()}={}){
 const registered=new Map();
 const server={registerTool(name,info,handler){registered.set(name,{info,handler})}};
 const fakeZ={enum:values=>({enum:values})};
 registerParityHealthTools({server,z:fakeZ,principal,
  authorizeHealth:async()=>allow,monitor:service});
 return {registered,call:(name,args)=>registered.get(name).handler(args)};
}
test('all four self-hosted devices start unknown, never static READY',()=>{
 assert.deepEqual(monitor().peek().map(x=>x.state),Array(4).fill('unknown'));
});
test('signed list health verifies all four device identities with source timestamps',async()=>{
 const records=await monitor().list({force:true});
 assert.deepEqual(records.map(x=>x.id),PARITY_DEVICES);
 assert(records.every(x=>x.verified===true&&x.state==='reachable'&&x.checkedAt));
});
test('direct device list and ping expose independent explicit read-only tools',async()=>{
 const t=tools();
 assert.deepEqual([...t.registered.keys()],['dc_list_devices_live','dc_ping']);
 const list=JSON.parse((await t.call('dc_list_devices_live',{})).content[0].text);
 assert.equal(list.length,4);
 const ping=JSON.parse((await t.call('dc_ping',{deviceId:'007windows'})).content[0].text);
 assert.equal(ping.id,'007windows');
 assert.equal(ping.state,'reachable');
});
test('forged signed identity cannot claim reachable',async()=>{
 const fake=monitor({transport:async({challenge})=>
  signHealthResponse(challenge,{privateKey:keys['china-mac'].privateKey,clock})});
 const r=await fake.check('us-macmini',{force:true});
 assert.notEqual(r.state,'reachable');assert.equal(r.verified,false);
});
test('transport failure produces unreachable not a static success',async()=>{
 const x=monitor({transport:async()=>{throw Error('NETWORK_DOWN')}});
 const r=await x.check('windows',{force:true});
 assert.equal(r.state,'unreachable');assert.equal(r.verified,false);
});
test('no signed health or missing public key fails startup',()=>{
 assert.throws(()=>createParitySignedMonitor({transport:valid,publicKeys:{},clock}),
  {message:'PARITY_SIGNED_HEALTH_REQUIRED'});
});
test('operator denied health never probes devices',async()=>{
 let count=0;
 const s={list:async()=>{count++;return []},check:async()=>{count++;return {}}};
 const t=tools({allow:false,service:s});
 assert.equal((await t.call('dc_list_devices_live',{})).isError,true);
 assert.equal((await t.call('dc_ping',{deviceId:'us-macmini'})).isError,true);
 assert.equal(count,0);
});
test('arbitrary device cannot be pinged even with operator allowance',async()=>{
 const t=tools();
 assert.equal((await t.call('dc_ping',{deviceId:'external-device'})).isError,true);
});
test('missing OAuth principal blocks health registration',()=>{
 const server={registerTool(){}},z={enum:()=>({})};
 assert.throws(()=>registerParityHealthTools({server,z,principal:null,authorizeHealth:async()=>true,monitor:monitor()}),
  {message:'PARITY_HEALTH_REGISTRATION_DENIED'});
});
