import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const pid=Number(process.env.BYL_GUI_UAT_PID);
if(!Number.isSafeInteger(pid)||pid<=0)throw Error('PID_REQUIRED');
const client=new Client({name:'dev-gui-real-e2e',version:'1.0'},{capabilities:{}});
const transport=new StdioClientTransport({command:process.execPath,args:[new URL('./gui-mcp-server.mjs',import.meta.url).pathname]});
try{
 await client.connect(transport);
 const available=await client.listTools();
 if(!available.tools.some(t=>t.name==='gui_dev_navigate_home'))throw Error('TOOL_NOT_REGISTERED');
 const inspect=await client.callTool({name:'gui_dev_bound_inspect',arguments:{windowPid:pid}});
 const action=inspect.isError?null:await client.callTool({name:'gui_dev_navigate_home',arguments:{windowPid:pid}});
 console.log(JSON.stringify({pid,inspect,action}));
 if(inspect.isError||!action||action.isError)process.exitCode=1;
}finally{await client.close()}
