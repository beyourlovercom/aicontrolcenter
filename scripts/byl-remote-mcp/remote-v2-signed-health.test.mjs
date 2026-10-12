import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {
 HEALTH_PROTOCOL,createHealthChallenge,signHealthResponse,
 verifyHealthResponse,createSignedDeviceProbe
} from './remote-v2-signed-health.mjs';
import {createLiveHealthMonitor} from './remote-v2-live-health.mjs';

const us=generateKeyPairSync('ed25519');
const cn=generateKeyPairSync('ed25519');
const windows=generateKeyPairSync('ed25519');
const registry={
 'us-macmini':{id:'us-macmini'},
 'china-mac':{id:'china-mac'},
 windows:{id:'windows'}
};
const publicKeys={
 'us-macmini':us.publicKey,
 'china-mac':cn.publicKey,
 windows:windows.publicKey
};
const privateKeys={
 'us-macmini':us.privateKey,
 'china-mac':cn.privateKey,
 windows:windows.privateKey
};
const timestamp=1791800000000;
const clock=()=>timestamp;
const transport=async({deviceId,challenge})=>
 signHealthResponse(challenge,{privateKey:privateKeys[deviceId],clock});
const probe=createSignedDeviceProbe({transport,publicKeys,clock});

test('isolated signed health challenge uses device-bound protocol and random nonce',()=>{
 const a=createHealthChallenge('china-mac',{clock});
 const b=createHealthChallenge('china-mac',{clock});
 assert.equal(a.protocol,HEALTH_PROTOCOL);
 assert.equal(a.nonce.length,48);
 assert.notEqual(a.nonce,b.nonce);
 assert(Object.isFrozen(a));
});
test('signed remote health success for all 3 devices',async()=>{
 const monitor=createLiveHealthMonitor({registry,probeDevice:probe,clock});
 assert.deepEqual((await monitor.list()).map(x=>x.state),['reachable','reachable','reachable']);
});
test('must trust pinned public key for this exact device',async()=>{
 const challenge=createHealthChallenge('china-mac',{clock});
 const forged=signHealthResponse(challenge,{privateKey:us.privateKey,clock});
 assert.deepEqual(verifyHealthResponse(challenge,forged,{publicKey:cn.publicKey,clock}),
 {ok:false,code:'AUTH_FAILED'});
});
test('signed response cannot be replayed against fresh challenge',()=>{
 const old=createHealthChallenge('windows',{clock});
 const replay=signHealthResponse(old,{privateKey:windows.privateKey,clock});
 const fresh=createHealthChallenge('windows',{clock});
 assert.equal(verifyHealthResponse(fresh,replay,{publicKey:windows.publicKey,clock}).ok,false);
});
test('device substitution rejected even with valid sender signature',()=>{
 const c=createHealthChallenge('china-mac',{clock});
 const signed=signHealthResponse(c,{privateKey:cn.privateKey,clock});
 const changed={...signed,deviceId:'windows'};
 assert.equal(verifyHealthResponse(c,changed,{publicKey:cn.publicKey,clock}).ok,false);
});
test('signed payload mutation rejected',()=>{
 const c=createHealthChallenge('us-macmini',{clock});
 const signed=signHealthResponse(c,{privateKey:us.privateKey,clock});
 const forged={...signed,status:'degraded'};
 assert.equal(verifyHealthResponse(c,forged,{publicKey:us.publicKey,clock}).code,'AUTH_FAILED');
});
test('signed degraded agent is not reported healthy',()=>{
 const c=createHealthChallenge('china-mac',{clock});
 const s=signHealthResponse(c,{privateKey:cn.privateKey,clock,status:'degraded'});
 assert.deepEqual(verifyHealthResponse(c,s,{publicKey:cn.publicKey,clock}),
 {ok:false,authenticated:true,deviceId:'china-mac',code:'AGENT_DEGRADED'});
});
test('expired signed responses and clock skew fail closed',()=>{
 const c=createHealthChallenge('windows',{clock});
 const s=signHealthResponse(c,{privateKey:windows.privateKey,clock});
 assert.equal(verifyHealthResponse(c,s,{publicKey:windows.publicKey,clock:()=>timestamp+11000}).code,
 'CHALLENGE_EXPIRED');
});
test('signature garbage fails without leaking payload',()=>{
 const c=createHealthChallenge('windows',{clock});
 const s=signHealthResponse(c,{privateKey:windows.privateKey,clock});
 const x=verifyHealthResponse(c,{...s,signature:'totally_invalid_token'},{publicKey:windows.publicKey,clock});
 assert.equal(x.code,'MALFORMED_RESPONSE');
 assert(!JSON.stringify(x).includes('token'));
});
test('extra untrusted fields rejected',()=>{
 const c=createHealthChallenge('china-mac',{clock});
 const s=signHealthResponse(c,{privateKey:cn.privateKey,clock});
 assert.equal(verifyHealthResponse(c,{...s,publicKey:'attacker',secret:'abc'},{publicKey:cn.publicKey,clock}).code,
 'MALFORMED_RESPONSE');
});
test('unknown device cannot trigger arbitrary transport target',async()=>{
 let sent=0;
 const checked=createSignedDeviceProbe({
  transport:async()=>{sent++;return null},
  publicKeys,clock
 });
 assert.deepEqual(await checked({deviceId:'unregistered-site'}),
 {ok:false,code:'AUTH_FAILED'});
 assert.equal(sent,0);
});
test('transport network failure sanitized',async()=>{
 const checked=createSignedDeviceProbe({
  transport:async()=>{throw Error('private host, secret agent token')},
  publicKeys,clock
 });
 assert.deepEqual(await checked({deviceId:'windows'}),{ok:false,code:'UNREACHABLE'});
});
test('Ed25519 public key type is mandatory',()=>{
 const c=createHealthChallenge('windows',{clock});
 assert.throws(()=>signHealthResponse(c,{privateKey:windows.publicKey,clock}),/ED25519_PRIVATE_KEY_REQUIRED/);
});

test('monitor surfaces cryptographically signed degraded service accurately',async()=>{
 const signed=createSignedDeviceProbe({clock,publicKeys,
   transport:async({deviceId,challenge})=>signHealthResponse(challenge,{
     privateKey:privateKeys[deviceId],status:deviceId==='china-mac'?'degraded':'ready',clock
   })});
 const health=createLiveHealthMonitor({registry,clock,probeDevice:signed});
 assert.deepEqual((await health.list()).map(x=>[x.state,x.verified]),[
   ['reachable',true],['degraded',true],['reachable',true]
 ]);
});
test('a bad signature is not mistaken for offline or ready',async()=>{
 const signed=createSignedDeviceProbe({clock,publicKeys,
   transport:async({challenge})=>signHealthResponse(challenge,{privateKey:us.privateKey,clock})
 });
 const health=createLiveHealthMonitor({registry,clock,probeDevice:signed});
 const result=await health.check('china-mac');
 assert.equal(result.state,'unknown');
 assert.equal(result.reason,'AUTH_FAILED');
 assert.equal(result.verified,false);
});
test('probe transport failures are exposed as unreachable with no raw error',async()=>{
 const signed=createSignedDeviceProbe({clock,publicKeys,
   transport:async()=>{throw Error('secret internal hostname or bearer')}});
 const health=createLiveHealthMonitor({registry,clock,probeDevice:signed});
 const result=await health.check('windows');
 assert.equal(result.state,'unreachable');
 assert.equal(result.reason,'UNREACHABLE');
 assert(!JSON.stringify(result).includes('secret'));
});
