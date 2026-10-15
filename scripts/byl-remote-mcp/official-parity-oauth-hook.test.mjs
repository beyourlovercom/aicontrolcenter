import test from 'node:test';
import assert from 'node:assert/strict';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {z} from 'zod';
import {PARITY_CORE_FLAG,registerOAuthParityCore} from './official-parity-oauth-hook.mjs';
function make({enabled=false,principal={kind:'cloudflare-access',canOperate:true},
 expose=true,permit=true}={}){
 const server=new McpServer({name:'oauth-source-fixture',version:'1'});
 const old=['remote_list_devices','remote_list_tools','remote_call','remote_process_selftest'];
 for(const name of old)server.registerTool(name,{inputSchema:{}},
  async()=>({content:[{type:'text',text:'LEGACY'}]}));
 const seen=[];
 const agentCall=async(...args)=>{seen.push(args);return {ok:true,result:{isFile:true,source:'read-only-fixture'}};};
 const config={server,z,principal,agentCall,
   canExposeRemoteCall:()=>expose,
   authorizeRemoteCall:(_p,_d,name,args)=>{
    if(!permit)throw Error('OPERATOR_DENIED');
    return {name,arguments:args};
   },env:{[PARITY_CORE_FLAG]:enabled?'1':'0'}};
 return {server,old,seen,config};
}
async function clientOf(server){
 const [a,b]=InMemoryTransport.createLinkedPair();
 const client=new Client({name:'oauth-parity-smoke',version:'1.0'},{capabilities:{}});
 await server.connect(b);await client.connect(a);
 return {client,close:async()=>{await client.close();await server.close();}};
}
test('missing feature flag causes NO new tool registrations',async()=>{
 const f=make();
 const x=registerOAuthParityCore(f.config);
 assert.deepEqual(x,{enabled:false,names:[],reason:'NOT_ENABLED'});
 const c=await clientOf(f.server);
 try{
  const names=(await c.client.listTools()).tools.map(x=>x.name);
  assert.deepEqual(names.sort(),f.old.sort());
 }finally{await c.close();}
});
test('read-only feature flag registers exactly five discoverable tools through SDK',async()=>{
 const f=make({enabled:true});
 const result=registerOAuthParityCore(f.config);
 assert.equal(result.enabled,true);assert.equal(result.names.length,5);
 const c=await clientOf(f.server);
 try{
  const list=(await c.client.listTools()).tools.map(v=>v.name);
  assert.equal(list.length,9);
  assert.equal(list.filter(x=>x.startsWith('dc_')).length,5);
  assert.equal(list.includes('dc_ping'),false);
  const response=await c.client.callTool({name:'dc_get_file_info',arguments:{
   deviceId:'007windows',path:'C:\\Windows\\win.ini'
  }});
  assert.notEqual(response.isError,true);
  assert.deepEqual(JSON.parse(response.content[0].text),
   {isFile:true,source:'read-only-fixture'});
  assert.deepEqual(f.seen,[['007windows','get_file_info',{path:'C:\\Windows\\win.ini'}]]);
  assert.equal((await c.client.callTool({name:'remote_list_devices',arguments:{}})).content[0].text,'LEGACY');
 }finally{await c.close();}
});
test('previous Operator policy hidden = no new named tools registered',()=>{
 const f=make({enabled:true,expose:false});
 assert.throws(()=>registerOAuthParityCore(f.config),{message:'PARITY_OPERATOR_VISIBILITY_DENIED'});
});
test('unauthorized OAuth principal cannot gain tool visibility',()=>{
 const f=make({enabled:true,principal:{kind:'internal',canOperate:true}});
 assert.throws(()=>registerOAuthParityCore(f.config),{message:'PARITY_PRINCIPAL_NOT_VERIFIED'});
});
test('operator invocation denial leaves the transport untouched',async()=>{
 const f=make({enabled:true,permit:false});
 registerOAuthParityCore(f.config);
 const c=await clientOf(f.server);
 try{
  const response=await c.client.callTool({name:'dc_read_file',arguments:{
   deviceId:'us-macmini',path:'/etc/hosts',length:3
  }});
  assert.equal(response.isError,true);
  assert.equal(f.seen.length,0);
 }finally{await c.close();}
});
test('fake feature variable, no transport or missing config fail closed',()=>{
 const f=make({enabled:true});
 assert.throws(()=>registerOAuthParityCore({...f.config,enabledFlag:'UNTRUSTED_FLAG'}),
 {message:'PARITY_FLAG_NOT_CANONICAL'});
 assert.throws(()=>registerOAuthParityCore({...f.config,agentCall:undefined}),
 {message:'PARITY_AGENT_TRANSPORT_REQUIRED'});
 const off=registerOAuthParityCore({...f.config,env:{}});
 assert.equal(off.enabled,false);
});
