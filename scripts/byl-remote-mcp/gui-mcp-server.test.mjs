import test from 'node:test';import assert from 'node:assert/strict';
import {Client} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {InMemoryTransport} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/inMemory.js';
import {createGuiMcpServer} from './gui-mcp-server.mjs';
test('MCP list and call inspect-only end-to-end',async()=>{
 const [clientTransport,serverTransport]=InMemoryTransport.createLinkedPair();
 const server=createGuiMcpServer({lookup:()=>({ok:true,pid:321,title:'BYL GUI TEST READY - Google Chrome',url:'/tmp/byl-gui-owner-uat-20261010.html'})});
 const client=new Client({name:'uat-client',version:'1.0'},{capabilities:{}});
 await server.connect(serverTransport);await client.connect(clientTransport);
 try{
 const list=await client.listTools();assert.deepEqual(list.tools.map(x=>x.name),['gui_dev_inspect','gui_fixture_action']);
 const args={action:'inspect',expectedHost:'dev.beyourlover.com',expectedTitle:'BYL GUI TEST READY',windowPid:321};
 const ok=await client.callTool({name:'gui_dev_inspect',arguments:args});assert.equal(ok.isError,false);
 const bad=await client.callTool({name:'gui_dev_inspect',arguments:{...args,expectedHost:'www.beyourlover.com'}});assert.equal(bad.isError,true);
 const click=await client.callTool({name:'gui_dev_inspect',arguments:{...args,action:'click',target:'Click test only'}});assert.equal(click.isError,true);assert.match(click.content[0].text,/TOOL_ACTION_MISMATCH/);
 const inspectUnderAction=await client.callTool({name:'gui_fixture_action',arguments:args});assert.equal(inspectUnderAction.isError,true);
 }finally{await client.close();await server.close();}
});
