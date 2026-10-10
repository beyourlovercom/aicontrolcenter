import {Server} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js';
import {StdioServerTransport} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js';
import {handleGuiRequest} from './gui-remote-handler.mjs';
export function createGuiMcpServer({lookup}={}){
 const server=new Server({name:'byl-gui-dev-inspect',version:'0.1.0'},{capabilities:{tools:{}}});
 server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'gui_dev_inspect',description:'Isolated offline fixture window only. Read-only; no click, typing, or production access.',inputSchema:{type:'object',additionalProperties:false,required:['action','expectedHost','expectedTitle','windowPid'],properties:{action:{type:'string',enum:['inspect']},expectedHost:{type:'string',enum:['dev.beyourlover.com']},expectedTitle:{type:'string'},windowPid:{type:'integer',minimum:1}}}},{name:'gui_fixture_action',description:'Offline fixture only; exact local file identity; no Production or real website writes.',inputSchema:{type:'object',additionalProperties:false,required:['action','expectedHost','expectedTitle','windowPid','target'],properties:{action:{type:'string',enum:['click','type']},expectedHost:{type:'string',enum:['dev.beyourlover.com']},expectedTitle:{type:'string'},windowPid:{type:'integer',minimum:1},target:{type:'string'},value:{type:'string'}}}}]}));
 server.setRequestHandler(CallToolRequestSchema,async({params})=>{
  if(!['gui_dev_inspect','gui_fixture_action'].includes(params.name))return {isError:true,content:[{type:'text',text:'TOOL_NOT_FOUND'}]};
  if((params.name==='gui_dev_inspect' && params.arguments?.action!=='inspect') || (params.name==='gui_fixture_action' && !['click','type'].includes(params.arguments?.action)))return {isError:true,content:[{type:'text',text:'TOOL_ACTION_MISMATCH'}]};
  const result=handleGuiRequest(params.arguments,{lookup});
  return {isError:!result.ok,content:[{type:'text',text:JSON.stringify(result)}]};
 });
 return server;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const server=createGuiMcpServer();
 await server.connect(new StdioServerTransport());
}
