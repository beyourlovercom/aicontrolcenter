import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync} from 'node:crypto';
import {createServer} from 'node:http';
import {createHealthChallenge,verifyHealthResponse}
  from './remote-v2-signed-health.mjs';
import {createAgentSignedHealthHandler,SIGNED_HEALTH_ACTION}
  from './remote-v4-agent-signed-health-handler.mjs';

const keys=generateKeyPairSync('ed25519');
const wrong=generateKeyPairSync('ed25519');
let now=1792400000000;
const clock=()=>now;
const deviceId='us-macmini';
const nonce=()=>createHealthChallenge(deviceId,{clock});
const req=(challenge=nonce(),authContext='verified-gateway')=>({
  operation:SIGNED_HEALTH_ACTION,challenge,authContext
});
const factory=(overrides={})=>createAgentSignedHealthHandler({
  deviceId,signingPrivateKey:keys.privateKey,clock,
  authenticateGateway:async({authContext})=>authContext==='verified-gateway',
  measureLocalState:async()=> 'ready',...overrides
});
test('real Ed25519 proof from authenticated, fresh fixed-device challenge',async()=>{
 const h=factory(),c=nonce(),result=await h.handle(req(c));
 assert.deepEqual(verifyHealthResponse(c,result,{
  publicKey:keys.publicKey,clock}),{ok:true,authenticated:true,deviceId});
 assert(!JSON.stringify(result).includes('PRIVATE KEY'));
 assert.deepEqual(Object.keys(h),['handle']);
 assert(Object.isFrozen(h));
});
test('unsigned caller denied before local health callback or signature',async()=>{
 let measured=0;
 const h=factory({measureLocalState:()=>{measured++;return 'ready'}});
 await assert.rejects(h.handle(req(nonce(),'untrusted')),/GATEWAY_AUTH_DENIED/);
 assert.equal(measured,0);
});
test('missing gateway authorizer or real local source or Ed25519 private signing key refused',()=>{
 assert.throws(()=>createAgentSignedHealthHandler({deviceId,signingPrivateKey:keys.privateKey,
   measureLocalState:()=> 'ready'}),/GATEWAY_AUTH_VERIFIER_REQUIRED/);
 assert.throws(()=>createAgentSignedHealthHandler({deviceId,signingPrivateKey:keys.privateKey,
   authenticateGateway:()=>true}),/LOCAL_HEALTH_MEASUREMENT_REQUIRED/);
 assert.throws(()=>factory({signingPrivateKey:keys.publicKey}),/ED25519_SIGNING_KEY_REQUIRED/);
});
test('exact single device bound; target substitution and untrusted operation fail closed',async()=>{
 const h=factory();
 const c=nonce();
 await assert.rejects(h.handle({...req(c),operation:'start_process'}),/OPERATION_INVALID/);
 await assert.rejects(h.handle(req({...c,deviceId:'windows'})),/CHALLENGE_INVALID/);
 await assert.rejects(h.handle({...req(c),extraAdmin:true}),/OPERATION_INVALID/);
});
test('old/future challenges cannot be signed, independently of transport',async()=>{
 const h=factory();
 const expired={...nonce(),issuedAtMs:now-10001};
 const future={...nonce(),issuedAtMs:now+1501};
 await assert.rejects(h.handle(req(expired)),/CHALLENGE_EXPIRED/);
 await assert.rejects(h.handle(req(future)),/CHALLENGE_EXPIRED/);
});
test('signed response is rejected under wrong pinned device key',async()=>{
 const h=factory(),c=nonce(),signed=await h.handle(req(c));
 const x=verifyHealthResponse(c,signed,{publicKey:wrong.publicKey,clock});
 assert.equal(x.ok,false);
 assert.equal(x.code,'AUTH_FAILED');
});
test('same nonce cannot be replayed; subsequent fresh nonce is accepted',async()=>{
 const h=factory(),c=nonce();
 await h.handle(req(c));
 await assert.rejects(h.handle(req(c)),/REPLAY_DENIED/);
 const other=await h.handle(req(nonce()));
 assert.equal(other.status,'ready');
});
test('parallel nonce race is accepted exactly once',async()=>{
 const h=factory({measureLocalState:async()=>{await new Promise(r=>setTimeout(r,4));return 'ready';}});
 const c=nonce(),out=await Promise.allSettled([h.handle(req(c)),h.handle(req(c))]);
 assert.equal(out.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(out.filter(x=>x.status==='rejected').length,1);
 assert.match(out.find(x=>x.status==='rejected').reason.message,/REPLAY_DENIED/);
});
test('degraded local state can be signed but not counted healthy',async()=>{
 const h=factory({measureLocalState:async()=> 'degraded'}),c=nonce();
 const signed=await h.handle(req(c));
 assert.equal(signed.status,'degraded');
 const result=verifyHealthResponse(c,signed,{publicKey:keys.publicKey,clock});
 assert.deepEqual(result,{ok:false,authenticated:true,deviceId,code:'AGENT_DEGRADED'});
});
test('no healthy fallback for unproven/erroring local measurement',async()=>{
 const h=factory({measureLocalState:async()=> 'unknown'});
 await assert.rejects(h.handle(req()),/LOCAL_HEALTH_UNPROVEN/);
 const broken=factory({measureLocalState:async()=>{throw Error('secret agent disk path token');}});
 const err=await broken.handle(req()).catch(x=>x);
 assert.equal(err.message,'SIGNED_HEALTH_REFUSED');
 assert(!err.message.includes('secret'));
});
test('bounded nonce ledger stops issuance when full rather than evicting unexpired',async()=>{
 const h=factory({maxReplayEntries:1});
 await h.handle(req());
 await assert.rejects(h.handle(req()),/REPLAY_CACHE_FULL/);
});
test('caller cannot exploit malformed oversized challenge or fake timestamp',async()=>{
 const h=factory();
 await assert.rejects(h.handle(req({...nonce(),issuedAtMs:'now'})),/CHALLENGE_INVALID/);
 await assert.rejects(h.handle(req({...nonce(),nonce:'a'.repeat(10000)})),/CHALLENGE_INVALID/);
 await assert.rejects(h.handle(req({...nonce(),protocol:'OTHER-V1'})),/CHALLENGE_INVALID/);
});
test('bounded slow authenticator fails closed and never measures local state',async()=>{
 let measured=0;
 const h=factory({
  timeoutMs:10,
  authenticateGateway:()=>new Promise(()=>{}),
  measureLocalState:()=>{measured++;return 'ready';}
 });
 const before=Date.now();
 await assert.rejects(h.handle(req()),/HANDLER_TIMEOUT/);
 assert(Date.now()-before<1000);
 assert.equal(measured,0);
});
test('an explicit AbortSignal denies a pre-cancelled request',async()=>{
 const h=factory(),controller=new AbortController();controller.abort();
 await assert.rejects(h.handle(req(),{signal:controller.signal}),/REQUEST_ABORTED/);
});
test('existing fixed / synthetic loopback HTTP POST must authenticate and sign; not a real Agent endpoint',async()=>{
 const h=factory(),server=createServer(async(request,response)=>{
  try{
   assert.equal(request.url,'/v1/signed-health-dev');
   assert.equal(request.method,'POST');
   const chunks=[];
   for await(const part of request)chunks.push(part);
   const object=JSON.parse(Buffer.concat(chunks).toString('utf8'));
   const signed=await h.handle(object);
   response.writeHead(200,{'content-type':'application/json'});
   response.end(JSON.stringify(signed));
  }catch(e){response.writeHead(403,{'content-type':'application/json'});response.end(JSON.stringify({error:'refused'}));}
 });
 await new Promise((resolve,reject)=>server.listen(0,'127.0.0.1',e=>e?reject(e):resolve()));
 try{
  const port=server.address().port,uri='http://127.0.0.1:'+port+'/v1/signed-health-dev';
  const c=nonce();
  const ok=await fetch(uri,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(req(c))});
  assert.equal(ok.status,200);
  const payload=await ok.json();
  assert.equal(verifyHealthResponse(c,payload,{publicKey:keys.publicKey,clock}).ok,true);
  const rejected=await fetch(uri,{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify(req(nonce(),'untrusted'))});
  assert.equal(rejected.status,403);
  assert.deepEqual(await rejected.json(),{error:'refused'});
 }finally{await new Promise(r=>server.close(r));}
});
