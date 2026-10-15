import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,createHash,verify} from 'node:crypto';
import {createCredentialFreeSignedAgentClient} from './official-parity-a4-signed-agent-client.mjs';

const {privateKey,publicKey}=generateKeyPairSync('ed25519');
const clock=()=>1760500000000;
const targets={
 'us-macmini':'http://127.0.0.1:8791',
 'china-mac':'http://100.64.21.44:8791',
 'windows':'http://10.1.2.3:8791',
 '007windows':'http://192.168.1.8:8791'
};
function fixture({reply={ok:true,result:{safe:true}},status=true}={}){
 const calls=[];
 const fetchImpl=async(url,options)=>{
  calls.push({url:url.toString(),options});
  return {ok:status,headers:{get:()=>null},text:async()=>JSON.stringify(reply)};
 };
 return {calls,config:{targets,signingKey:privateKey,clock,fetchImpl,signalTimeout:ms=>({timeout:ms})}};
}
test('client construction performs zero requests and stores no configuration in return object',()=>{
 const f=fixture(),client=createCredentialFreeSignedAgentClient(f.config);
 assert.equal(f.calls.length,0);
 assert.deepEqual(Object.keys(client),['agentGet','agentCall']);
 assert.equal(JSON.stringify(client).includes('100.64.21.44'),false);
});
test('pinned GET tool-list request exactly matches production signed canonical envelope',async()=>{
 const f=fixture();const api=createCredentialFreeSignedAgentClient(f.config);
 await api.agentGet('us-macmini','/v1/tools');
 const x=f.calls[0],digest=createHash('sha256').update('').digest('hex');
 const canon='GET\n/v1/tools\n'+clock()+'\n'+digest;
 assert.equal(x.url,'http://127.0.0.1:8791/v1/tools');
 assert.equal(x.options.method,'GET');
 assert.equal(x.options.body,undefined);
 assert.equal(x.options.signal.timeout,10000);
 assert.equal(verify(null,Buffer.from(canon),publicKey,
  Buffer.from(x.options.headers['x-byl-signature'],'base64')),true);
});
test('signed POST matches exact request body and retained fixed 4th Windows device',async()=>{
 const f=fixture();const api=createCredentialFreeSignedAgentClient(f.config);
 const result=await api.agentCall('007windows','get_file_info',{path:'C:\\Windows\\win.ini'});
 const x=f.calls[0],body=x.options.body;
 const json=JSON.parse(body.toString('utf8'));
 assert.deepEqual(json,{name:'get_file_info',arguments:{path:'C:\\Windows\\win.ini'}});
 const digest=createHash('sha256').update(body).digest('hex');
 const canon='POST\n/v1/call\n'+clock()+'\n'+digest;
 assert.equal(verify(null,Buffer.from(canon),publicKey,
  Buffer.from(x.options.headers['x-byl-signature'],'base64')),true);
 assert.equal(x.options.signal.timeout,30000);
 assert.deepEqual(result,{ok:true,result:{safe:true}});
});
test('unknown device, URL injection and arbitrary agentGet path fail before fetching',async()=>{
 const f=fixture(),api=createCredentialFreeSignedAgentClient(f.config);
 await assert.rejects(api.agentGet('outsider','/v1/tools'),{message:'DEVICE_UNKNOWN'});
 await assert.rejects(api.agentGet('us-macmini','https://example.com'),{message:'PARITY_AGENT_PATH_DENIED'});
 await assert.rejects(api.agentCall('007windows','../../exec',{}),{message:'PARITY_AGENT_ARGUMENTS_DENIED'});
 await assert.rejects(api.agentCall('windows','write_file',null),{message:'PARITY_AGENT_ARGUMENTS_DENIED'});
 assert.equal(f.calls.length,0);
});
test('constructor rejects public hosts, malicious URL forms, wrong ports and incomplete device registry',()=>{
 const invalid=['https://10.0.0.3:8791','http://8.8.8.8:8791',
  'http://example.com:8791','http://10.0.0.3:80',
  'http://token@10.0.0.3:8791','http://10.0.0.3:8791/secret',
  'http://10.0.0.3:8791/?q=1'];
 for(const bad of invalid){
  const f=fixture();f.config.targets={...targets,'007windows':bad};
  assert.throws(()=>createCredentialFreeSignedAgentClient(f.config),{message:'PARITY_TARGET_INVALID'});
 }
 const f=fixture();delete f.config.targets;assert.throws(()=>createCredentialFreeSignedAgentClient(f.config),
  {message:'PARITY_TARGET_REGISTRY_INVALID'});
});
test('upstream body and private endpoint are never included in errors',async()=>{
 const secret='synthetic-private-payload-should-not-leak';
 const f=fixture({status:false,reply:{details:secret}});
 const api=createCredentialFreeSignedAgentClient(f.config);
 await assert.rejects(api.agentGet('windows','/v1/tools'),e=>{
  assert.equal(e.message,'PARITY_AGENT_REQUEST_FAILED');
  assert.equal(e.message.includes(secret),false);return true;
 });
});
test('oversized HTTP response is rejected and never returned',async()=>{
 const f=fixture();
 f.config.fetchImpl=async()=>({ok:true,headers:{get:()=>null},text:async()=>('x'.repeat(70000))});
 const api=createCredentialFreeSignedAgentClient(f.config);
 await assert.rejects(api.agentGet('windows','/v1/tools'),{message:'PARITY_AGENT_RESPONSE_INVALID'});
});
test('unexpected clock and wrong signature key fail closed',async()=>{
 const f=fixture();f.config.clock=()=>-5;
 const api=createCredentialFreeSignedAgentClient(f.config);
 await assert.rejects(api.agentGet('us-macmini','/v1/tools'),{message:'PARITY_CLOCK_INVALID'});
 const bad=fixture();bad.config.signingKey='not a PEM key';
 assert.throws(()=>createCredentialFreeSignedAgentClient(bad.config),
  {message:'PARITY_PRIVATE_KEY_REQUIRED'});
});
test('transport failures never leak raw fetch errors',async()=>{
 const f=fixture();f.config.fetchImpl=async()=>{throw Error('secret-route:100.64.0.20');};
 const api=createCredentialFreeSignedAgentClient(f.config);
 await assert.rejects(api.agentGet('china-mac','/v1/tools'),{message:'PARITY_AGENT_UNREACHABLE'});
});


test('external PKCS8 Ed25519 PEM is supported without persisting it in GitHub or output',async()=>{
 const f=fixture();
 const pem=privateKey.export({type:'pkcs8',format:'pem'});
 f.config.signingKey=pem;
 const transport=createCredentialFreeSignedAgentClient(f.config);
 const value=await transport.agentGet('us-macmini','/v1/tools');
 assert.deepEqual(value,{ok:true,result:{safe:true}});
 assert.equal(JSON.stringify(transport).includes('PRIVATE KEY'),false);
});
