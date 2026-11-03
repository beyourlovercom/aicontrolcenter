/**
 * S5 TEST-ONLY end-to-end integration of pinned UNMERGED S2/S3/S4 source files.
 * All HTTP goes to 127.0.0.1 random ephemeral port, never to installed Agents.
 * All Gateway authentications and Ed25519 issuer/device private keys are synthetic.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,generateKeyPairSync,sign} from 'node:crypto';
import {createServer} from 'node:http';
import {ENROLLED_DEVICES,ENROLLMENT_SCHEMA,enrollmentSigningBytes,
  verifyTrustEnrollmentCandidate} from './remote-v3-trust-enrollment.mjs';
import {createSignedHealthWireDev,SIGNED_HEALTH_OPERATION}
  from './remote-v2-health-wire-dev.mjs';
import {createAgentSignedHealthHandler,SIGNED_HEALTH_ACTION}
  from './remote-v4-agent-signed-health-handler.mjs';
import {createHealthChallenge} from './remote-v2-signed-health.mjs';

const START=1792400000000;
const TEST_AUTH='S5-LOCAL-SYNTHETIC-ONLY';
const pem=k=>k.export({format:'pem',type:'spki'}).toString();
const fp=k=>createHash('sha256').update(k.export({format:'der',type:'spki'})).digest('hex');
const registry=Object.fromEntries(ENROLLED_DEVICES.map(id=>[id,{id}]));

function simulatedTrust() {
  const issuer=generateKeyPairSync('ed25519');
  const signers=Object.fromEntries(ENROLLED_DEVICES.map(id=>[id,generateKeyPairSync('ed25519')]));
  const body={
    schema:ENROLLMENT_SCHEMA,registryId:'aicc-dc-four-device-v1',
    issuerId:'owner-s5-synthetic-001',epoch:1,
    previousManifestSha256:'0'.repeat(64),
    issuedAt:new Date(START-1000).toISOString(),
    expiresAt:new Date(START+1000*60*10).toISOString(),
    devices:ENROLLED_DEVICES.map(id=>({
      deviceId:id,publicKeyPem:pem(signers[id].publicKey),
      spkiSha256:fp(signers[id].publicKey),
      externalWitnessReceiptId:'synthetic-s5-witness-'+id+'-v001'
    }))
  };
  const envelope={body,signatureBase64:sign(null,enrollmentSigningBytes(body),issuer.privateKey).toString('base64')};
  const issuerTrust={publicKeyPem:pem(issuer.publicKey),
    approvedSpkiSha256:fp(issuer.publicKey)};
  const candidate=verifyTrustEnrollmentCandidate({envelope,issuerTrust,now:START});
  assert.equal(candidate.canActivate,false);
  assert.equal(candidate.eligibleForRuntime,false);
  assert.equal(candidate.externalIssuerEnrollment,'NOT_INDEPENDENTLY_VERIFIED');
  return {candidate,signers,body,envelope,issuerTrust};
}

async function harness(t,options={}) {
  let now=START;
  const clock=()=>now;
  const advance=ms=>{now+=ms;};
  const trust=simulatedTrust();
  let total=0;
  const byDevice=Object.fromEntries(ENROLLED_DEVICES.map(id=>[id,0]));
  const localStates={...Object.fromEntries(ENROLLED_DEVICES.map(id=>[id,'ready'])),
    ...(options.localStates||{})};
  const agentHandlers=Object.fromEntries(ENROLLED_DEVICES.map(id=>[id,
    createAgentSignedHealthHandler({
      deviceId:id,
      signingPrivateKey:options.forgedDevice===id
        ?generateKeyPairSync('ed25519').privateKey
        :trust.signers[id].privateKey,
      authenticateGateway:async({authContext})=>authContext===TEST_AUTH,
      measureLocalState:async()=>localStates[id],
      clock,timeoutMs:2500
    })
  ]));
  const server=createServer(async(req,res)=>{
    total++;
    const m=/^\/s5\/(007windows|china-mac|us-macmini|windows)$/.exec(req.url||'');
    if(req.method!=='POST'||!m){
      res.writeHead(404);res.end();return;
    }
    const id=m[1];
    byDevice[id]++;
    if(options.offlineDevice===id){
      res.writeHead(503);res.end();return;
    }
    try{
      const chunks=[];
      for await(const part of req){
        chunks.push(part);
        if(Buffer.concat(chunks).length>4096)throw Error('OVER_BUDGET');
      }
      const input=JSON.parse(Buffer.concat(chunks).toString('utf8'));
      const signed=await agentHandlers[id].handle(input);
      res.writeHead(200,{'content-type':'application/json'});
      res.end(JSON.stringify(signed));
    }catch{
      res.writeHead(403,{'content-type':'application/json'});
      res.end(JSON.stringify({reason:'refused'}));
    }
  });
  await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',error=>error?reject(error):resolve()));
  t.after(()=>new Promise(resolve=>{
    server.closeAllConnections();
    server.close(()=>resolve());
  }));
  const address=server.address();
  assert.equal(address.address,'127.0.0.1');
  const base='http://127.0.0.1:'+address.port;
  const send=async({deviceId,operation,challenge},{signal}={})=>{
    if(!Object.hasOwn(registry,deviceId))throw Error('NOT_REGISTERED');
    const response=await fetch(base+'/s5/'+deviceId,{
      method:'POST',redirect:'error',signal,
      headers:{'content-type':'application/json'},
      body:JSON.stringify({
        operation,challenge,
        authContext:options.badGatewayAuth===true?'INVALID':TEST_AUTH
      })
    });
    if(response.status!==200)throw Error('DEV_ONLY_TRANSPORT_REFUSED');
    return response.json();
  };
  const client=(trustPins=trust.candidate.candidatePins)=>
    createSignedHealthWireDev({registry,trustPins,clock,send,ttlMs:15000,timeoutMs:2500});
  return {trust,client,base,clock,advance,total:()=>total,byDevice,localStates};
}

test('S3 signed candidate is NOT independently enrolled or eligible for runtime promotion',()=>{
  const trust=simulatedTrust();
  assert.equal(trust.candidate.signatureVerified,true);
  assert.equal(trust.candidate.canActivate,false);
  assert.equal(trust.candidate.eligibleForRuntime,false);
  assert.equal(trust.candidate.deviceWitnessReceipts,'NOT_INDEPENDENTLY_VERIFIED');
  assert.equal(trust.candidate.durableEpochRecord,'NOT_INDEPENDENTLY_VERIFIED');
  assert.deepEqual(Object.keys(trust.candidate.candidatePins),ENROLLED_DEVICES);
});

test('S1 + pinned S2 + S4 end-to-end: 4 synthetic devices signed reachable over real loopback HTTP',async t=>{
  const h=await harness(t),cli=h.client();
  assert.equal(h.total(),0);
  assert(cli.peek().every(x=>x.registered&&x.state==='unknown'&&!x.verified));
  const rows=await cli.refresh();
  assert.equal(h.total(),4);
  assert.deepEqual(rows.map(x=>x.id),ENROLLED_DEVICES);
  assert(rows.every(x=>x.state==='reachable'&&x.verified===true&&x.probe==='SIGNED_RESPONSE_VERIFIED'));
  assert(!JSON.stringify(rows).includes('READY'));
});
test('007windows simulated agent unreachable -> unreachable, three others remain signed reachable',async t=>{
  const h=await harness(t,{offlineDevice:'007windows'});
  const r=await h.client().refresh();
  assert.equal(r.find(x=>x.id==='007windows').state,'unreachable');
  assert.equal(r.find(x=>x.id==='007windows').verified,false);
  assert(r.filter(x=>x.id!=='007windows').every(x=>x.state==='reachable'&&x.verified));
});
test('missing independently enrolled 007 public pin -> unknown, zero requests to 007',async t=>{
  const h=await harness(t);
  const pins={...h.trust.candidate.candidatePins};
  delete pins['007windows'];
  const r=await h.client(pins).refresh();
  assert.equal(h.byDevice['007windows'],0);
  assert.equal(r[0].reason,'TRUST_KEY_NOT_ENROLLED');
  assert.equal(r[0].state,'unknown');
  assert(r.slice(1).every(x=>x.state==='reachable'&&x.verified));
});
test('forged China Agent signature is unknown AUTH_FAILED, not reachable',async t=>{
  const h=await harness(t,{forgedDevice:'china-mac'});
  const r=await h.client().refresh();
  assert.equal(r.find(x=>x.id==='china-mac').state,'unknown');
  assert.equal(r.find(x=>x.id==='china-mac').reason,'AUTH_FAILED');
  assert(r.filter(x=>x.id!=='china-mac').every(x=>x.verified));
});
test('degraded Windows measurement produces signed degraded, not healthy',async t=>{
  const h=await harness(t,{localStates:{windows:'degraded'}});
  const r=await h.client().refresh();
  const w=r.find(x=>x.id==='windows');
  assert.equal(w.state,'degraded');
  assert.equal(w.verified,true);
  assert.equal(w.reason,'AGENT_DEGRADED');
});
test('all invalid Gateway authentications refuse signatures; no false ready statuses',async t=>{
  const h=await harness(t,{badGatewayAuth:true});
  const r=await h.client().refresh();
  assert(r.every(x=>x.verified===false&&x.state!=='reachable'));
  assert.equal(h.total(),4);
});
test('unknown health readings refuse signatures rather than defaulting READY',async t=>{
  const h=await harness(t,{localStates:{windows:'unknown'}});
  const r=await h.client().refresh();
  assert.notEqual(r.find(x=>x.id==='windows').state,'reachable');
  assert.equal(r.find(x=>x.id==='windows').verified,false);
});
test('S1 TTL discards signed online state and requires fresh explicit refresh',async t=>{
  const h=await harness(t);
  const client=h.client();
  await client.refresh();
  assert.equal(h.total(),4);
  h.advance(15001);
  const after=client.peek();
  assert(after.every(x=>x.state==='unknown'&&!x.verified&&x.reason==='STALE'));
  assert.equal(h.total(),4);
  const fresh=await client.refresh({force:true});
  assert.equal(h.total(),8);
  assert(fresh.every(x=>x.state==='reachable'&&x.verified));
});
test('S4 rejects same nonce replay and challenge for the wrong device',async t=>{
  const h=await harness(t);
  const c=createHealthChallenge('us-macmini',{clock:h.clock});
  const call=body=>fetch(h.base+'/s5/us-macmini',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify(body)});
  const message={operation:SIGNED_HEALTH_ACTION,challenge:c,authContext:TEST_AUTH};
  const first=await call(message);assert.equal(first.status,200);
  const repeat=await call(message);assert.equal(repeat.status,403);
  const other=await call({...message,challenge:createHealthChallenge('windows',{clock:h.clock})});
  assert.equal(other.status,403);
  assert.equal(SIGNED_HEALTH_OPERATION,SIGNED_HEALTH_ACTION);
});
test('tampered S3 witness evidence or issuer signature blocks even test candidate creation',()=>{
  const t=simulatedTrust();
  const corrupted=structuredClone(t.envelope);
  corrupted.body.devices[0].externalWitnessReceiptId='corrupted-synthetic';
  assert.throws(()=>verifyTrustEnrollmentCandidate({
    envelope:corrupted,issuerTrust:t.issuerTrust,now:START}),/ISSUER_SIGNATURE_INVALID/);
});
