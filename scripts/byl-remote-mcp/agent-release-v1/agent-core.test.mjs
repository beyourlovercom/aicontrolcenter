import test from 'node:test';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {createHash, generateKeyPairSync, sign} from 'node:crypto';
import {createAgentHandler, candidateReleaseStatus, AGENT_RELEASE_PROTOCOL, MAX_REQUEST_BYTES} from './agent-core.mjs';

const NOW = 1_760_640_000_123;
const sha = bytes => createHash('sha256').update(bytes).digest('hex');

async function harness(overrides = {}) {
  const {publicKey, privateKey} = generateKeyPairSync('ed25519');
  const audit = [];
  const calls = [];
  const list = {tools:[
    {name:'read_file',description:'read-only file'},
    {name:'list_directory',description:'read-only directory'},
    {name:'set_config_value',description:'unsafe'}
  ]};
  const settings = {
    publicKey,
    allowedPeer:'127.0.0.1',
    allowedTools:['read_file','list_directory'],
    clock:() => NOW,
    listTools:async () => list,
    callTool:async ({name,arguments:args}) => {
      calls.push({name,args});
      return {isError:false,content:[{type:'text',text:'synthetic-fixture'}]};
    },
    auditEvent:async rec => {audit.push(rec);},
    ...overrides
  };
  const server = createServer(createAgentHandler(settings));
  await new Promise((res,rej)=>server.once('error',rej).listen(0,'127.0.0.1',res));
  const base = 'http://127.0.0.1:' + server.address().port;
  async function ask(method,route,body,opts={}) {
    const bytes = Buffer.from(body===undefined?'':typeof body==='string'?body:JSON.stringify(body),'utf8');
    const ts = String(opts.ts??NOW);
    const path = route.split('?')[0];
    const canonical = [method,path,ts,sha(bytes)].join('\n');
    const signature = sign(null,Buffer.from(canonical),privateKey).toString('base64');
    const headers = {};
    if (!opts.unsigned) { headers['x-byl-timestamp']=ts; headers['x-byl-signature']=opts.signature || signature; }
    const response = await fetch(base+route,{method,headers,body:method==='POST'?bytes:undefined});
    return {status:response.status,data:await response.json()};
  }
  return {ask,audit,calls,list,base,close:()=>new Promise(r=>server.close(r)), settings};
}

test('valid Gateway Ed25519 signature delegates only allowlisted real tools',async()=>{
  const h=await harness();
  try{
    const list=await h.ask('GET','/v1/tools');
    assert.equal(list.status,200);
    assert.deepEqual(list.data.tools.map(x=>x.name),['read_file','list_directory']);
    const got=await h.ask('POST','/v1/call',{name:'read_file',arguments:{path:'safe-demo'}});
    assert.equal(got.status,200);
    assert.equal(got.data.result.content[0].text,'synthetic-fixture');
    assert.deepEqual(h.calls,[{name:'read_file',args:{path:'safe-demo'}}]);
    assert(h.audit.some(a=>a.event==='tool_call'&&a.tool==='read_file'));
  }finally{await h.close()}
});
test('health preserves legacy envelope but never asserts build attestation',async()=>{
  const h=await harness();
  try{
    const x=await h.ask('GET','/healthz',undefined,{unsigned:true});
    assert.equal(x.status,200);
    assert.equal(x.data.ok,true);
    assert.equal(x.data.service,'byl-dc-agent');
    assert.equal(x.data.protocol,AGENT_RELEASE_PROTOCOL);
    assert.equal(x.data.toolCount,2);
    assert.equal(x.data.buildIdentityAttested,false);
    assert.equal(candidateReleaseStatus().productionAgentCanary,'STOP');
  }finally{await h.close()}
});
test('unsigned and tampered Gateway signatures are denied',async()=>{
  const h=await harness();
  try{
    assert.equal((await h.ask('GET','/v1/tools',undefined,{unsigned:true})).status,401);
    assert.equal((await h.ask('GET','/v1/tools',undefined,{signature:'garbage'})).status,401);
    assert.equal((await h.ask('POST','/v1/call',{name:'read_file'},{ts:NOW-61_000})).status,401);
    assert.equal(h.calls.length,0);
  }finally{await h.close()}
});
test('trust direct peer only, no spoofed forwarded headers',async()=>{
  const h=await harness({allowedPeer:'127.0.0.2'});
  try{
    const v=await h.ask('GET','/healthz',undefined,{unsigned:true});
    assert.equal(v.status,403);
    assert.equal(v.data.errorCode,'DC_AGENT_PEER_DENIED');
  }finally{await h.close()}
});
test('deny configuration mutation, P2 route, restart endpoint and URL queries',async()=>{
  const h=await harness();
  try{
    assert.equal((await h.ask('POST','/v1/call',{name:'set_config_value',arguments:{}})).status,403);
    assert.equal((await h.ask('POST','/v1/call',{name:'p2_list_processes_start',arguments:{}})).status,403);
    assert.equal((await h.ask('POST','/v1/restart',{})).status,403);
    assert.equal((await h.ask('GET','/v1/tools?unexpected=1')).status,400);
    assert.equal(h.calls.length,0);
  }finally{await h.close()}
});
test('reject reused signed tool invocation before repeating side effects',async()=>{
  const h=await harness();
  try{
    const payload={name:'read_file',arguments:{path:'same-request'}};
    assert.equal((await h.ask('POST','/v1/call',payload)).status,200);
    const replay=await h.ask('POST','/v1/call',payload);
    assert.equal(replay.status,409);
    assert.equal(replay.data.errorCode,'DC_AGENT_REPLAY_DENIED');
    assert.equal(h.calls.length,1);
  }finally{await h.close()}
});
test('deny malformed body and non-object arguments',async()=>{
  const h=await harness();
  try{
    assert.equal((await h.ask('POST','/v1/call','not-json')).status,400);
    assert.equal((await h.ask('POST','/v1/call',{name:'read_file',arguments:[]})).status,400);
    assert.equal((await h.ask('POST','/v1/call',{name:'read_file',arguments:null})).status,400);
    assert.equal(h.calls.length,0);
  }finally{await h.close()}
});
test('precall audit denial fails closed with no tool execution',async()=>{
  const h=await harness({auditEvent:async()=>{throw Error('audit offline')}});
  try{
    const x=await h.ask('POST','/v1/call',{name:'read_file',arguments:{}});
    assert.equal(x.status,502);
    assert.equal(x.data.errorCode,'DC_AGENT_BRIDGE_UNAVAILABLE');
    assert.equal(h.calls.length,0);
  }finally{await h.close()}
});

test('post-execution audit failure preserves success and quarantines further tools',async()=>{
  const h=await harness({auditEvent:async rec=>{
    if(rec.event==='tool_result') throw Error('synthetic sink unavailable');
  }});
  try{
    const first=await h.ask('POST','/v1/call',{name:'read_file',arguments:{path:'first'}});
    assert.equal(first.status,200);
    assert.equal(first.data.result.content[0].text,'synthetic-fixture');
    assert.equal(first.data.auditState,'DEGRADED_POST_EXECUTION');
    assert.equal(h.calls.length,1);
    const second=await h.ask('POST','/v1/call',{name:'read_file',arguments:{path:'second'}});
    assert.equal(second.status,503);
    assert.equal(second.data.errorCode,'DC_AGENT_AUDIT_DEGRADED');
    assert.equal(h.calls.length,1);
    const health=await h.ask('GET','/healthz',undefined,{unsigned:true});
    assert.equal(health.status,503);
    assert.equal(health.data.auditHealthy,false);
  }finally{await h.close()}
});
test('oversize delegated result does not expose content',async()=>{
  const h=await harness({callTool:async()=>({content:[{type:'text',text:'X'.repeat(80_000)}]})});
  try{
    const x=await h.ask('POST','/v1/call',{name:'read_file',arguments:{}});
    assert.equal(x.status,502);
    assert.equal(x.data.errorCode,'DC_AGENT_RESPONSE_TOO_LARGE');
    assert.equal(JSON.stringify(x.data).includes('X'.repeat(40)),false);
  }finally{await h.close()}
});
test('bad release policy is rejected even if caller supplies signed transport',()=>{
  const {publicKey}=generateKeyPairSync('ed25519');
  const common={publicKey,allowedPeer:'127.0.0.1',listTools:async()=>({tools:[]}),
    callTool:async()=>({}),auditEvent:async()=>{}};
  assert.throws(()=>createAgentHandler({...common,allowedTools:['read_file','force_terminate']}),/AGENT_TOOL_POLICY_INVALID/);
  assert.throws(()=>createAgentHandler({...common,allowedTools:['p2_list_processes_start']}),/AGENT_TOOL_POLICY_INVALID/);
  assert.throws(()=>createAgentHandler({...common,allowedTools:[]}),/AGENT_TOOL_POLICY_INVALID/);
});
test('boundary config rejects missing audit, invalid gateway public key and oversized allowed set',()=>{
  const {publicKey}=generateKeyPairSync('ed25519');
  assert.throws(()=>createAgentHandler({publicKey,allowedPeer:'127.0.0.1',allowedTools:['read_file'],
    listTools:async()=>({tools:[]}),callTool:async()=>({})}),/AGENT_CONFIG_INVALID/);
  assert.throws(()=>createAgentHandler({publicKey:'no-key',allowedPeer:'127.0.0.1',
    allowedTools:['read_file']}),/AGENT_PUBLIC_KEY_INVALID/);
  assert(MAX_REQUEST_BYTES<2_000_000);
});
