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
  listAuthorizedRemoteToolNames:(_p,_deviceId)=>['get_file_info'],
  authorizeRemoteCall:(p,id,name,args)=>{
   if(!operatorAllowed)throw Error('OPERATOR_DENIED');
   return {name,arguments:args};
  },
  auditLegacyOperation:record=>{audit.push(record);return auditAllowed;},
  auditOperation:record=>{audit.push(record);return auditAllowed;},
  env:{BYL_MCP_PARITY_CORE_READ_ENABLED:enabled?'1':'0',
   BYL_MCP_OPERATOR_DISCOVERY_FILTER_ENABLED:'1'}
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
  assert.deepEqual(JSON.parse(list.content[0].text),{tools:[]});
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
  for(const [deviceId,command] of [
   ['windows','[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; [System.Net.Dns]::GetHostName()'],
   ['007windows','[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; [System.Net.Dns]::GetHostName()'],
   ['us-macmini','hostname'],
   ['china-mac','hostname']
  ]){
   const ok=await s.client.callTool({name:'remote_process_selftest',arguments:{deviceId}});
   assert.notEqual(ok.isError,true);
   assert.deepEqual(f.seen.at(-1),['call',deviceId,'start_process',{command,timeout_ms:8000}]);
  }
  const error=await s.client.callTool({name:'remote_process_selftest',arguments:{deviceId:'unknown'}});
  assert.equal(error.isError,true);assert.equal(f.seen.length,4);
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
 for(const name of ['agentGet','agentCall','canExposeRemoteCall','authorizeRemoteCall','listAuthorizedRemoteToolNames','auditLegacyOperation']){
  const f=source();f.input[name]=null;
  assert.throws(()=>createCredentialFreeOAuthToolSurface(f.input),
   {message:'PARITY_RUNTIME_DEPENDENCIES_REQUIRED'});
 }
});

test('legacy MCP discovery is per-device: denied get_config hidden, authorized 007 preserved',async()=>{
 const f=source();
 f.input.agentGet=async()=>({tools:[
  {name:'get_config'},{name:'read_file'},{name:'start_process'}
 ]});
 f.input.listAuthorizedRemoteToolNames=(_p,id)=>id==='007windows'
  ? ['get_config','read_file','start_process']
  : ['read_file','start_process'];
 f.input.authorizeRemoteCall=(_p,id,name,args)=>{
  if(name==='get_config'&&id!=='007windows')throw Error('OPERATOR_TOOL_DENIED');
  return {name,arguments:args};
 };
 const surface=createCredentialFreeOAuthToolSurface(f.input);
 const s=await session(surface.server);
 try{
  const windows=await s.client.callTool({name:'remote_list_tools',arguments:{deviceId:'windows'}});
  assert.deepEqual(JSON.parse(windows.content[0].text).tools.map(t=>t.name),
   ['read_file','start_process']);
  const seven=await s.client.callTool({name:'remote_list_tools',arguments:{deviceId:'007windows'}});
  assert.deepEqual(JSON.parse(seven.content[0].text).tools.map(t=>t.name),
   ['get_config','read_file','start_process']);
  const denied=await s.client.callTool({name:'remote_call',arguments:{
   deviceId:'windows',name:'get_config',arguments:{}
  }});
  assert.equal(denied.isError,true);
  assert.equal(f.seen.some(x=>x[0]==='call'),false);
  assert(f.audit.some(x=>x.operation==='get_config'&&x.decision==='deny'));
 }finally{await s.close();}
});
test('missing trusted discovery resolver denies construction, rather than leaking upstream',()=>{
 const f=source();delete f.input.listAuthorizedRemoteToolNames;
 assert.throws(()=>createCredentialFreeOAuthToolSurface(f.input),
  {message:'PARITY_RUNTIME_DEPENDENCIES_REQUIRED'});
});
test('default-OFF rollout requires no new private policy export and keeps legacy Agent inventory',async()=>{
 const f=source();f.input.env.BYL_MCP_OPERATOR_DISCOVERY_FILTER_ENABLED='0';
 delete f.input.listAuthorizedRemoteToolNames;
 const surface=createCredentialFreeOAuthToolSurface(f.input);
 const s=await session(surface.server);
 try{
  const out=await s.client.callTool({name:'remote_list_tools',arguments:{deviceId:'windows'}});
  assert.deepEqual(JSON.parse(out.content[0].text),{tools:[{name:'get_file_info'}]});
 }finally{await s.close();}
});

test('feature ON does not restrict historic internal Bearer agent inventory',async()=>{
 const f=source({principal:{kind:'internal',canOperate:true}});
 f.input.agentGet=async()=>({tools:[{name:'get_config'},{name:'start_process'}]});
 f.input.listAuthorizedRemoteToolNames=()=>['read_file'];
 const surface=createCredentialFreeOAuthToolSurface(f.input);
 const s=await session(surface.server);
 try{
  const out=await s.client.callTool({name:'remote_list_tools',arguments:{deviceId:'windows'}});
  assert.deepEqual(JSON.parse(out.content[0].text),{
   tools:[{name:'get_config'},{name:'start_process'}]
  });
 }finally{await s.close();}
});


test('S2 flag OFF retains legacy static READY and needs no live adapter',async()=>{
 const f=source();f.input.env.BYL_MCP_DEVICE_LIVE_STATUS_ENABLED='0';
 const surface=createCredentialFreeOAuthToolSurface(f.input),s=await session(surface.server);
 try{
  const out=await s.client.callTool({name:'remote_list_devices',arguments:{}});
  assert.deepEqual(JSON.parse(out.content[0].text),CANONICAL_DEVICE_IDS.map(id=>({id,state:'READY'})));
  assert.equal(f.seen.length,0);
 }finally{await s.close();}
});
test('S2 flag ON uses trusted reachability with no false READY and no payload expansion',async()=>{
 const f=source(),proof=CANONICAL_DEVICE_IDS.map(id=>({
  id,registered:true,state:id==='china-mac'?'unreachable':'reachable',
  verified:false,reason:id==='china-mac'?'AGENT_PROBE_FAILED':'AGENT_TOOLS_RESPONDED',
  checkedAt:'2026-11-03T08:00:00.000Z',probe:'SIGNED_REQUEST_NOT_HEALTH_ATTESTED'
 }));
 let calls=0;
 f.input.env.BYL_MCP_DEVICE_LIVE_STATUS_ENABLED='1';
 f.input.getDeviceStatuses=async()=>{calls++;return proof;};
 const surface=createCredentialFreeOAuthToolSurface(f.input),s=await session(surface.server);
 try{
  const out=await s.client.callTool({name:'remote_list_devices',arguments:{}});
  assert.deepEqual(JSON.parse(out.content[0].text),proof);
  assert.equal(calls,1);
  assert.equal(f.seen.length,0);
 }finally{await s.close();}
});
test('S2 ON denies missing trusted status binding or invalid flag before any MCP surface',()=>{
 const f=source();f.input.env.BYL_MCP_DEVICE_LIVE_STATUS_ENABLED='1';
 assert.throws(()=>createCredentialFreeOAuthToolSurface(f.input),
  {message:'PARITY_RUNTIME_DEPENDENCIES_REQUIRED'});
 f.input.getDeviceStatuses=async()=>[];
 f.input.env.BYL_MCP_DEVICE_LIVE_STATUS_ENABLED='invalid';
 assert.throws(()=>createCredentialFreeOAuthToolSurface(f.input),
  {message:'DEVICE_LIVE_STATUS_FLAG_INVALID'});
});
test('S2 nonoperator sees unknown with no transport calls; internal Bearer retains legacy registry',async()=>{
 for(const principal of [{kind:'cloudflare-access',canOperate:false},{kind:'internal',canOperate:true}]){
  const f=source({principal,legacyVisible:principal.kind==='internal'});
  f.input.env.BYL_MCP_DEVICE_LIVE_STATUS_ENABLED='1';
  let queried=0;
  f.input.getDeviceStatuses=async()=>{queried++;return [];};
  const surface=createCredentialFreeOAuthToolSurface(f.input),s=await session(surface.server);
  try{
   const out=await s.client.callTool({name:'remote_list_devices',arguments:{}});
   const entries=JSON.parse(out.content[0].text);
   assert.equal(entries.length,4);
   assert(entries.every(item=>item.state===(principal.kind==='internal'?'READY':'unknown')));
   assert.equal(queried,0);
  }finally{await s.close();}
 }
});
