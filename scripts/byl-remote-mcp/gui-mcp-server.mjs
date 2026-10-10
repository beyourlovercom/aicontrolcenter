import {Server} from '@modelcontextprotocol/sdk/server/index.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {ListToolsRequestSchema,CallToolRequestSchema} from '@modelcontextprotocol/sdk/types.js';
import {handleGuiRequest} from './gui-remote-handler.mjs';
import {inspectDevCart} from './gui-dev-inspector.mjs';
import {inspectBoundDevWindow} from './gui-bound-dev.mjs';
import {navigateDevHome} from './gui-dev-navigate.mjs';
export function createGuiMcpServer({lookup}={}){
 const server=new Server({name:'byl-gui-dev-inspect',version:'0.1.0'},{capabilities:{tools:{}}});
 server.setRequestHandler(ListToolsRequestSchema,async()=>({tools:[{name:'gui_dev_navigate_home',description:'Navigate only from anonymous isolated Dev cart to Dev homepage with verified browser URL readback.',inputSchema:{type:'object',additionalProperties:false,required:['windowPid'],properties:{windowPid:{type:'integer',minimum:1}}}},{name:'gui_dev_bound_inspect',description:'Isolated Chrome profile and Dev cart origin verified from native process and AX URL; no actions.',inputSchema:{type:'object',additionalProperties:false,required:['windowPid'],properties:{windowPid:{type:'integer',minimum:1}}}},{name:'gui_dev_cart_inspect',description:'Read-only Dev cart Accessibility identity verification. No GUI actions.',inputSchema:{type:'object',additionalProperties:false,required:['windowPid'],properties:{windowPid:{type:'integer',minimum:1}}}},{name:'gui_dev_inspect',description:'Isolated offline fixture window only. Read-only; no click, typing, or production access.',inputSchema:{type:'object',additionalProperties:false,required:['action','expectedHost','expectedTitle','windowPid'],properties:{action:{type:'string',enum:['inspect']},expectedHost:{type:'string',enum:['dev.beyourlover.com']},expectedTitle:{type:'string'},windowPid:{type:'integer',minimum:1}}}},{name:'gui_fixture_action',description:'Offline fixture only; exact local file identity; no Production or real website writes.',inputSchema:{type:'object',additionalProperties:false,required:['action','expectedHost','expectedTitle','windowPid','target'],properties:{action:{type:'string',enum:['click','type']},expectedHost:{type:'string',enum:['dev.beyourlover.com']},expectedTitle:{type:'string'},windowPid:{type:'integer',minimum:1},target:{type:'string'},value:{type:'string'}}}}]}));
 server.setRequestHandler(CallToolRequestSchema,async({params})=>{
  if(!['gui_dev_inspect','gui_fixture_action','gui_dev_cart_inspect','gui_dev_bound_inspect','gui_dev_navigate_home'].includes(params.name))return {isError:true,content:[{type:'text',text:'TOOL_NOT_FOUND'}]};
  if((params.name==='gui_dev_inspect' && params.arguments?.action!=='inspect') || (params.name==='gui_fixture_action' && !['click','type'].includes(params.arguments?.action)))return {isError:true,content:[{type:'text',text:'TOOL_ACTION_MISMATCH'}]};
  const result=params.name==='gui_dev_navigate_home'?navigateDevHome(params.arguments||{}):params.name==='gui_dev_bound_inspect'?inspectBoundDevWindow(params.arguments||{}):params.name==='gui_dev_cart_inspect'?inspectDevCart(params.arguments||{}):handleGuiRequest(params.arguments,{lookup});
  return {isError:!result.ok,content:[{type:'text',text:JSON.stringify(result)}]};
 });
 return server;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const server=createGuiMcpServer();
 await server.connect(new StdioServerTransport());
}
