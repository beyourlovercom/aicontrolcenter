import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync} from 'node:crypto';
import {createServer} from 'node:http';
import {signHealthResponse} from './remote-v2-signed-health.mjs';
import {SIGNED_HEALTH_OPERATION,createSignedHealthWireDev}
  from './remote-v2-health-wire-dev.mjs';

const ids=['us-macmini','china-mac','windows','007windows'];
const registry=Object.fromEntries(ids.map(id=>[id,{id}]));
const pairs=Object.fromEntries(ids.map(id=>[id,generateKeyPairSync('ed25519')]));
const pins=Object.fromEntries(ids.map(id=>{
 const pub=pairs[id].publicKey;
 return [id,{publicKeyPem:pub.export({format:'pem',type:'spki'}).toString(),
 spkiSha256:createHash('sha256').update(pub.export({format:'der',type:'spki'})).digest('hex')}];
}));
const clock=()=>1792000000000;
const signer=async(request)=>{
 const {deviceId,operation,challenge}=request;
 assert.equal(operation,SIGNED_HEALTH_OPERATION);
 assert(ids.includes(deviceId));
 assert(Object.isFrozen(request));
 assert(Object.isFrozen(challenge));
 return signHealthResponse(challenge,{privateKey:pairs[deviceId].privateKey,clock});
};

test('four registered devices must NOT appear online before explicit signed refresh',()=>{
 let sends=0;
 const client=createSignedHealthWireDev({registry,trustPins:pins,clock,
  send:async req=>{sends++;return signer(req);}});
 assert.equal(sends,0);
 const rows=client.peek();
 assert.equal(rows.length,4);
 assert(rows.every(r=>r.registered&&r.state==='unknown'&&!r.verified&&r.reason==='NOT_CHECKED'));
 assert(!JSON.stringify(rows).includes('READY'));
});
test('all four test devices are genuinely signed in approved fixed operation',async()=>{
 let sends=0;
 const client=createSignedHealthWireDev({registry,trustPins:pins,clock,
  send:async req=>{sends++;return signer(req);}});
 const x=await client.refresh();
 assert.equal(sends,4);
 assert(x.every(r=>r.state==='reachable'&&r.verified&&r.probe==='SIGNED_RESPONSE_VERIFIED'));
 assert.deepEqual(x.map(r=>r.id),ids);
});
test('absence of owner-enrolled key fails closed and makes zero transport calls',async()=>{
 let sends=0;
 const client=createSignedHealthWireDev({registry,clock,send:()=>{sends++;}});
 assert((await client.refresh()).every(r=>r.state==='unknown'&&r.reason==='TRUST_KEY_NOT_ENROLLED'));
 assert.equal(sends,0);
});
test('single enrolled device never probes the other three',async()=>{
 let called=[];
 const client=createSignedHealthWireDev({registry,trustPins:{'us-macmini':pins['us-macmini']},clock,
  send:async req=>{called.push(req.deviceId);return signer(req);}});
 const result=await client.refresh();
 assert.deepEqual(called,['us-macmini']);
 assert.equal(result[0].state,'reachable');
 assert(result.slice(1).every(r=>r.state==='unknown'&&r.reason==='TRUST_KEY_NOT_ENROLLED'));
});
test('a mismatched fingerprint is rejected BEFORE any transport access',()=>{
 const mismatch={...pins,windows:{...pins.windows,spkiSha256:'0'.repeat(64)}};
 assert.throws(()=>createSignedHealthWireDev({registry,trustPins:mismatch,clock,send:signer}),/TRUST_PIN_MISMATCH/);
});
test('same public key enrolled for two devices is forbidden',()=>{
 const duplicate={...pins,windows:pins['china-mac']};
 assert.throws(()=>createSignedHealthWireDev({registry,trustPins:duplicate,clock,send:signer}),/DUPLICATE_DEVICE_TRUST_KEY/);
});
test('no unregistered device key/URL or unapproved transport',()=>{
 assert.throws(()=>createSignedHealthWireDev({
  registry,trustPins:{'attacker-domain':pins.windows},send:signer}),/UNREGISTERED_TRUST_PIN/);
 assert.throws(()=>createSignedHealthWireDev({registry,trustPins:pins}),/FIXED_TARGET_TRANSPORT_REQUIRED/);
 assert.throws(()=>createSignedHealthWireDev({registry:{},trustPins:pins,send:signer}),/DEVICE_REGISTRY_INVALID/);
});
test('attacker response signed with wrong key never marks China Mac online',async()=>{
 const x=createSignedHealthWireDev({registry,trustPins:pins,clock,
  send:async req=>signHealthResponse(req.challenge,{
   privateKey:pairs['us-macmini'].privateKey,clock})});
 const records=await x.refresh();
 assert.equal(records[1].state,'unknown');
 assert.equal(records[1].reason,'AUTH_FAILED');
 assert.equal(records[1].verified,false);
});
test('unsigned or oversized return cannot be accepted as signed proof',async()=>{
 const malformed=createSignedHealthWireDev({registry,trustPins:pins,clock,
  send:async()=>({junk:'x'.repeat(10000)})});
 assert((await malformed.refresh()).every(r=>r.state==='unknown'&&r.reason==='MALFORMED_RESPONSE'));
 const unsigned=createSignedHealthWireDev({registry,trustPins:pins,clock,
  send:async()=>({status:'ready'})});
 assert((await unsigned.refresh()).every(r=>r.state==='unknown'));
});
test('actual send failure is unreachable, without returning secrets',async()=>{
 const x=createSignedHealthWireDev({registry,trustPins:pins,clock,
  send:async()=>{throw Error('secret PRIVATE_KEY=/home/dev');}});
 const result=await x.refresh();
 assert(result.every(r=>r.state==='unreachable'&&r.reason==='UNREACHABLE'));
 assert(!JSON.stringify(result).includes('PRIVATE_KEY'));
});
test('signed degraded device is degraded, not reachable',async()=>{
 const x=createSignedHealthWireDev({registry,trustPins:pins,clock,
  send:async req=>signHealthResponse(req.challenge,{
    privateKey:pairs[req.deviceId].privateKey,clock,
    status:req.deviceId==='007windows'?'degraded':'ready'})});
 const r=await x.refresh();
 assert.equal(r[3].state,'degraded');
 assert.equal(r[3].reason,'AGENT_DEGRADED');
 assert.equal(r[3].verified,true);
});
test('time-based cache removes old verified online states',async()=>{
 let now=1792000000000;
 const x=createSignedHealthWireDev({registry,trustPins:pins,clock:()=>now,ttlMs:100,
 send:async req=>signHealthResponse(req.challenge,{
  privateKey:pairs[req.deviceId].privateKey,clock:()=>now})});
 await x.refresh();
 now+=101;
 assert(x.peek().every(r=>r.state==='unknown'&&!r.verified&&r.reason==='STALE'));
});
test('real 127.0.0.1 HTTP request/response with synthetic Ed25519 fixture only',async()=>{
 let accesses=0;
 const server=createServer(async(req,res)=>{
  accesses++;
  try{
   assert.equal(req.method,'POST');
   assert.equal(req.url,'/v1/signed-health-dev');
   const body=[];
   for await(const part of req)body.push(part);
   const json=JSON.parse(Buffer.concat(body).toString('utf8'));
   const proof=await signer(json);
   res.writeHead(200,{'content-type':'application/json'});
   res.end(JSON.stringify(proof));
  }catch(error){res.writeHead(400);res.end(JSON.stringify({error:'invalid'}));}
 });
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
 try{
  const address=server.address();
  assert.equal(address.address,'127.0.0.1');
  const endpoint='http://127.0.0.1:'+address.port+'/v1/signed-health-dev';
  const x=createSignedHealthWireDev({registry,trustPins:pins,clock,
   send:async(operation,{signal})=>{
    const reply=await fetch(endpoint,{
     method:'POST',redirect:'error',
     headers:{'content-type':'application/json'},
     body:JSON.stringify(operation),signal});
    if(!reply.ok)throw Error('TRANSPORT_UNAVAILABLE');
    return reply.json();
   }});
  assert.equal(accesses,0);
  const records=await x.refresh();
  assert.equal(accesses,4);
  assert(records.every(r=>r.state==='reachable'&&r.verified));
 }finally{await new Promise(resolve=>server.close(resolve));}
});
