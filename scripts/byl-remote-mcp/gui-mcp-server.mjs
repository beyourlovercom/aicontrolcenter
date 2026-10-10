import {Server} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/server/index.js';
import {StdioServerTransport} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/types.js';
import {handleGuiRequest} from './gui-remote-handler.mjs';
export function createGuiMcpServer({lookup}={}){
 const server=new Server({name:'byl-gui-dev-inspect',version:'0.1.0'},{capabilities:{tools:{}}});
 server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'gui_dev_inspect',description:'Isolated offline fixture window only. Read-only; no click, typing, or production access.',inputSchema:{type:'object',additionalProperties:false,required:['action','expectedHost','expectedTitle','windowPid'],properties:{action:{type:'string',enum:['inspect']},expectedHost:{type:'string',enum:['dev.beyourlover.com']},expectedTitle:{type:'string'},windowPid:{type:'integer',minimum:1}}}}]}));
 server.setRequestHandler(CallToolRequestSchema,async({params})=>{
  if(params.name!=='gui_dev_inspect')return {isError:true,content:[{type:'text',text:'TOOL_NOT_FOUND'}]};
  const result=handleGuiRequest(params.arguments,{lookup});
  return {isError:!result.ok,content:[{type:'text',text:JSON.stringify(result)}]};
 });
 return server;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const server=createGuiMcpServer();
 await server.connect(new StdioServerTransport());
}
