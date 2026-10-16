import test from 'node:test';
import assert from 'node:assert/strict';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {z} from 'zod';
import {createCredentialFreeOAuthToolSurface,CANONICAL_DEVICE_IDS}
 from './official-parity-oauth-runtime-surface.mjs';

function source({enabled=false,principal={kind:'cloudflare-access',canOperate:true},
 legacyVisible=true,operatorAllowed=true,auditAllowed=true}={}){
 const seen=[],audit=[];
 const provider=async(deviceId,path)=>{
  seen.push(['get',deviceId,path]);
  return {tools:[{name:'get_file_info'}]};
 };
 const invoke=async(deviceId,name,args)=>{
  seen.push(['call',deviceId,name,args]);
  if(name==='get_file_info')return {result:{isFile:true,size:92}};
  return {result:{output:'fixture-hostname'}};
 };
 const input={
  McpServer,z,principal,agentGet:provider,agentCall:invoke,
  canExposeRemoteCall:()=>legacyVisible,
  authorizeRemoteCall:(p,id,name,args)=>{
   if(!operatorAllowed)throw Error('OPERATOR_DENIED');
   return {name,arguments:args};
  },
  auditLegacyOperation:record=>{audit.push(record);return auditAllowed;},
  auditOperation:record=>{audit.push(record);return auditAllowed;},
  env:{BYL_MCP_PARITY_CORE_READ_ENABLED:enabled?'1':'0'}
 };
 return {input,seen,audit};
}
async function session(server){
 const [a,b]=InMemoryTransport.createLinkedPair();
 const client=new Client({name:'oauth-contract-client',version:'1.0.0'},{capabilities:{}});
 await server.connect(b);await client.connect(a);
 return {client,close:async()=>{await client.close();await server.close();}};
}
test('no secrets or hostname required; default-off preserves four legacy SDK names',async()=>{
 const f=source();
 const build=createCredentialFreeOAuthToolSurface(f.input);
 assert.equal(build.parity.enabled,false);
 assert.deepEqual(build.devices,CANONICAL_DEVICE_IDS);
 const s=await session(build.server);
 try{
  assert.deepEqual((await s.client.listTools()).tools.map(x=>x.name).sort(),[
   'remote_call','remote_list_devices','remote_list_tools','remote_process_selftest'
  ]);
  const devices=await s.client.callTool({name:'remote_list_devices',arguments:{}});
  assert.deepEqual(JSON.parse(devices.content[0].text).map(x=>x.id),CANONICAL_DEVICE_IDS);
 }finally{await s.close();}
});
test('authorized core toggle exposes nine MCP names and correctly retains existing read functions',async()=>{
 const f=source({enabled:true});
 const surface=createCredentialFreeOAuthToolSurface(f.input);
 const s=await session(surface.server);
 try{
  const names=(await s.client.listTools()).tools.map(x=>x.name);
  assert.equal(names.length,9);assert.equal(names.filter(x=>x.startsWith('dc_')).length,5);
  assert.equal(names.includes('dc_ping'),false);
  const direct=await s.client.callTool({name:'dc_get_file_info',arguments:{
   deviceId:'007windows',path:'C:\\Windows\\win.ini'
  }});
  assert.notEqual(direct.isError,true);
  assert.deepEqual(JSON.parse(direct.content[0].text),{isFile:true,size:92});
  const legacy=await s.client.callTool({name:'remote_list_tools',arguments:{deviceId:'us-macmini'}});
  assert.notEqual(legacy.isError,true);
  assert.equal(JSON.parse(legacy.content[0].text).tools[0].name,'get_file_info');
  assert(f.audit.some(x=>x.operation==='get_file_info'&&x.decision==='allow'));
  assert.equal(JSON.stringify(f.audit).includes('win.ini'),false);
 }finally{await s.close();}
});
test('nonoperator principal with feature on keeps three legacy tools, no new names, no session failure',async()=>{
 const f=source({enabled:true,principal:{kind:'cloudflare-access',canOperate:false},legacyVisible:false});
 const surface=createCredentialFreeOAuthToolSurface(f.input);
 assert.equal(surface.parity.reason,'NOT_AUTHORIZED');
 const s=await session(surface.server);
 try{
  assert.deepEqual((await s.client.listTools()).tools.map(x=>x.name).sort(),[
   'remote_list_devices','remote_list_tools','remote_process_selftest'
  ]);
  const list=await s.client.callTool({name:'remote_list_tools',arguments:{deviceId:'china-mac'}});
  assert.notEqual(list.isError,true);
 }finally{await s.close();}
});
test('internal legacy principal remains usable but receives no direct tools',async()=>{
 const f=source({enabled:true,principal:{kind:'internal',canOperate:true}});
 const surface=createCredentialFreeOAuthToolSurface(f.input);
 assert.equal(surface.parity.enabled,false);
 const s=await session(surface.server);
 try{
  assert.equal((await s.client.listTools()).tools.length,4);
  const out=await s.client.callTool({name:'remote_call',arguments:{
   deviceId:'windows',name:'get_file_info',arguments:{path:'C:\\Windows\\win.ini'}
  }});
  assert.notEqual(out.isError,true);
  assert(f.seen.some(x=>x[0]==='call'&&x[1]==='windows'));
 }finally{await s.close();}
});
test('legacy existing fixed selftest runs hostname only and refuses unregistered devices',async()=>{
 const f=source();
 const surface=createCredentialFreeOAuthToolSurface(f.input);
 const s=await session(surface.server);
 try{
  const ok=await s.client.callTool({name:'remote_process_selftest',arguments:{deviceId:'007windows'}});
  assert.notEqual(ok.isError,true);
  assert.deepEqual(f.seen,[['call','007windows','start_process',{command:'hostname',timeout_ms:8000}]]);
  const error=await s.client.callTool({name:'remote_process_selftest',arguments:{deviceId:'unknown'}});
  assert.equal(error.isError,true);assert.equal(f.seen.length,1);
 }finally{await s.close();}
});
test('legacy operator denial or audit refusal blocks delegated call',async()=>{
 for(const flags of [{operatorAllowed:false},{auditAllowed:false}]){
  const f=source(flags);
  const surface=createCredentialFreeOAuthToolSurface(f.input);
  const s=await session(surface.server);
  try{
   const out=await s.client.callTool({name:'remote_call',arguments:{
    deviceId:'us-macmini',name:'get_file_info',arguments:{path:'/etc/hosts'}
   }});
   assert.equal(out.isError,true);
   assert.equal(f.seen.length,0);
  }finally{await s.close();}
 }
});
test('authorized start_process without timeout receives the compatibility default',async()=>{
 const f=source();
 f.input.authorizeRemoteCall=(_p,_id,name,args)=>({name,arguments:{...args}});
 const surface=createCredentialFreeOAuthToolSurface(f.input);
 const s=await session(surface.server);
 try{
  const out=await s.client.callTool({name:'remote_call',arguments:{
   deviceId:'us-macmini',name:'start_process',arguments:{command:'hostname'}
  }});
  assert.notEqual(out.isError,true);
  assert.deepEqual(f.seen,[['call','us-macmini','start_process',{
   command:'hostname',timeout_ms:3000
  }]]);
 }finally{await s.close();}
});
test('authorized explicit start_process timeout remains unchanged',async()=>{
 const f=source();
 f.input.authorizeRemoteCall=(_p,_id,name,args)=>({name,arguments:{...args}});
 const surface=createCredentialFreeOAuthToolSurface(f.input);
 const s=await session(surface.server);
 try{
  const out=await s.client.callTool({name:'remote_call',arguments:{
   deviceId:'us-macmini',name:'start_process',arguments:{command:'hostname',timeout_ms:8000}
  }});
  assert.notEqual(out.isError,true);
  assert.deepEqual(f.seen,[['call','us-macmini','start_process',{
   command:'hostname',timeout_ms:8000
  }]]);
 }finally{await s.close();}
});
test('internal principal receives no terminal adapter',async()=>{
 const f=source({principal:{kind:'internal',canOperate:true}});
 const surface=createCredentialFreeOAuthToolSurface(f.input);
 const s=await session(surface.server);
 try{
  const out=await s.client.callTool({name:'remote_call',arguments:{
   deviceId:'windows',name:'start_process',arguments:{command:'hostname'}
  }});
  assert.notEqual(out.isError,true);
  assert.deepEqual(f.seen,[['call','windows','start_process',{command:'hostname'}]]);
  assert.equal(f.audit.length,0);
 }finally{await s.close();}
});
test('missing trusted transport/policy/audit fails before constructing a production-compatible surface',()=>{
 for(const name of ['agentGet','agentCall','canExposeRemoteCall','authorizeRemoteCall','auditLegacyOperation']){
  const f=source();f.input[name]=null;
  assert.throws(()=>createCredentialFreeOAuthToolSurface(f.input),
   {message:'PARITY_RUNTIME_DEPENDENCIES_REQUIRED'});
 }
});
