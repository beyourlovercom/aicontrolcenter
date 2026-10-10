import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {discover} from './gui-target.mjs';
const expectedPid=Number(process.env.BYL_GUI_UAT_PID);
if(!Number.isSafeInteger(expectedPid)||expectedPid<=0)throw Error('EXPLICIT_PID_REQUIRED');
const windows=discover().filter(w=>w.pid===expectedPid && w.title.startsWith('BYL GUI TEST READY'));
if(windows.length!==1){console.log(JSON.stringify({ok:false,reason:'FIXTURE_COUNT_NOT_ONE',count:windows.length}));process.exit(2)}
const c=new Client({name:'byl-gui-stdio-e2e',version:'1.0'},{capabilities:{}});
const t=new StdioClientTransport({command:process.execPath,args:[new URL('./gui-mcp-server.mjs',import.meta.url).pathname]});
try {
 await c.connect(t);
 const tools=await c.listTools();
 const response=await c.callTool({name:'gui_dev_inspect',arguments:{action:'inspect',expectedHost:'dev.beyourlover.com',expectedTitle:'BYL GUI TEST READY',windowPid:windows[0].pid}});
 const actionBase={expectedHost:'dev.beyourlover.com',windowPid:windows[0].pid};
 const click=await c.callTool({name:'gui_fixture_action',arguments:{...actionBase,action:'click',expectedTitle:'BYL GUI TEST READY',target:'Click test only'}});
 const typed=await c.callTool({name:'gui_fixture_action',arguments:{...actionBase,action:'type',expectedTitle:'BYL GUI CLICK PASS',target:'GUI text test',value:'UATPASS'}});
 console.log(JSON.stringify({toolNames:tools.tools.map(t=>t.name),response,click,typed}));
 if(response.isError || click.isError || typed.isError)process.exitCode=1;
}finally{await c.close()}
