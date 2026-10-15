import test from 'node:test';
import assert from 'node:assert/strict';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {InMemoryTransport} from '@modelcontextprotocol/sdk/inMemory.js';
import {z} from 'zod';
import {registerOfficialParityV1} from './official-parity-sdk-registration.mjs';

async function fixture({allow=true}={}){
 const server=new McpServer({name:'parity-offline-fixture',version:'1.0.0'});
 const legacy=['remote_list_devices','remote_list_tools','remote_call','remote_process_selftest'];
 for(const name of legacy)
  server.registerTool(name,{description:'Existing unmodified remote tool',inputSchema:{}},
   async()=>({content:[{type:'text',text:'LEGACY_UNCHANGED'}]}));
 const calls=[];
 const principal={kind:'cloudflare-access',canOperate:true};
 registerOfficialParityV1({
  server,z,principal,enabled:true,mode:'core',
  authorizeRemoteCall:(_principal,deviceId,name,args)=>{
   if(!allow)throw Error('OPERATOR_DENIED');
   if(!['us-macmini','china-mac','windows','007windows'].includes(deviceId))
    throw Error('OPERATOR_DEVICE_DENIED');
   return {name,arguments:args};
  },
  delegate:async params=>{calls.push(params);return {text:'FIXTURE_READ_ONLY'};}
 });
 const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
 const client=new Client({name:'parity-owner-uat-client',version:'1.0.0'},{capabilities:{}});
 await server.connect(serverTransport);
 await client.connect(clientTransport);
 return {server,client,calls,legacy,close:async()=>{await client.close();await server.close();}};
}

test('real MCP SDK listTools retains four old names, adds only five direct core reads',async()=>{
 const f=await fixture();
 try{
  const found=(await f.client.listTools()).tools.map(x=>x.name);
  for(const name of f.legacy)assert(found.includes(name));
  assert.deepEqual(found.filter(x=>x.startsWith('dc_')).sort(),[
   'dc_get_file_info','dc_list_directory','dc_list_processes','dc_list_sessions','dc_read_file'
  ]);
  assert.equal(found.length,9);
  assert.equal(found.includes('dc_ping'),false);
  assert.equal(found.includes('dc_start_process'),false);
  const old=await f.client.callTool({name:'remote_list_devices',arguments:{}});
  assert.equal(old.content[0].text,'LEGACY_UNCHANGED');
 }finally{await f.close();}
});
test('real SDK accepts bounded four-device read and delegates existing operator policy',async()=>{
 const f=await fixture();
 try{
  const out=await f.client.callTool({name:'dc_read_file',arguments:{
   deviceId:'007windows',path:'C:\\Temp\\parity-canary.txt',offset:0,length:20
  }});
  assert.notEqual(out.isError,true); // MCP success may omit isError
  assert.equal(out.content[0].text,'FIXTURE_READ_ONLY');
  assert.deepEqual(f.calls,[{deviceId:'007windows',name:'read_file',arguments:{
   path:'C:\\Temp\\parity-canary.txt',offset:0,length:20
  }}]);
 }finally{await f.close();}
});
test('real SDK rejects unexpected device and unauthorized operations before delegation',async()=>{
 const f=await fixture({allow:false});
 try{
  const denied=await f.client.callTool({name:'dc_get_file_info',arguments:{
   deviceId:'us-macmini',path:'/tmp/parity-canary'
  }});
  assert.equal(denied.isError,true);
  assert.equal(f.calls.length,0);
  const bad=await f.client.callTool({name:'dc_read_file',arguments:{
   deviceId:'unknown-device',path:'/tmp/parity-canary'
  }});
  assert.equal(bad.isError,true);
  assert.equal(f.calls.length,0);
 }finally{await f.close();}
});
