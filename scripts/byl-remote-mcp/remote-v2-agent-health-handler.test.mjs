import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createHealthChallenge,verifyHealthResponse} from './remote-v2-signed-health.mjs';
import {createAgentHealthHandler} from './remote-v2-agent-health-handler.mjs';
const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const clock=()=>1_800_000_000_000;
const nonceSource=()=> 'a'.repeat(48);
const handler=createAgentHealthHandler({deviceId:'china-mac',privateKey,clock,authenticatedPeer:p=>p?.authorized===true});
const challenge=()=>createHealthChallenge('china-mac',{clock,nonceSource});
test('authenticated fixed-device challenge is signed and verified',()=>{
 const c=challenge(),r=handler({challenge:c,peerContext:{authorized:true}});
 assert.equal(verifyHealthResponse(c,r,{publicKey,clock}).ok,true);
});
test('unauthenticated peer denied before signing',()=>assert.deepEqual(handler({challenge:challenge(),peerContext:{authorized:false}}),{ok:false,code:'PEER_DENIED'}));
test('mismatched device rejected',()=>assert.deepEqual(handler({challenge:{...challenge(),deviceId:'windows'},peerContext:{authorized:true}}),{ok:false,code:'DEVICE_MISMATCH'}));
test('malformed challenge fails closed',()=>assert.deepEqual(handler({challenge:{deviceId:'china-mac'},peerContext:{authorized:true}}),{ok:false,code:'INVALID_CHALLENGE'}));
test('missing authorization policy rejected',()=>assert.throws(()=>createAgentHealthHandler({deviceId:'china-mac',privateKey})));
test('other public key cannot verify signed health',()=>{
 const other=generateKeyPairSync('ed25519');const c=challenge();const r=handler({challenge:c,peerContext:{authorized:true}});
 assert.equal(verifyHealthResponse(c,r,{publicKey:other.publicKey,clock}).ok,false);
});
