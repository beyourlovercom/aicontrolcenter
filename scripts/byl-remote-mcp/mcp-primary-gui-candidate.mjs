import {readFileSync} from 'node:fs';
import {guiDevCartHomeCanary,PRIMARY_GUI_TOOL_NAME} from './gui-primary-bridge.mjs';
import {createHash,sign} from 'node:crypto';
import {McpServer} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/server/mcp.js';
import {StreamableHTTPServerTransport} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/server/streamableHttp.js';
import {createMcpExpressApp} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/server/express.js';
import * as z from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/zod/v4/index.js';

const HOST='127.0.0.1';
const PORT=Number(process.env.BYL_PRIMARY_MCP_PORT||8792);
if(!Number.isSafeInteger(PORT)||PORT<1024||PORT>65535)throw Error('INVALID_MCP_PORT');
const TOKEN=readFileSync('/Users/a/.byl-remote-mcp/gateway.token','utf8').trim();
const PRIVATE_KEY=readFileSync('/Users/a/.byl-remote-mcp/keys/gateway-ed25519-private.pem','utf8');
const TARGETS=Object.freeze({
  'us-macmini':'http://127.0.0.1:8791',
  'china-mac':'http://100.102.15.40:8791',
  'windows':'http://100.87.29.56:8791'
});

function sha(body){return createHash('sha256').update(body).digest('hex');}
function headers(method,path,body){
  const ts=String(Date.now());
  const canonical=`${method}\n${path}\n${ts}\n${sha(body)}`;
  return {'content-type':'application/json','x-byl-timestamp':ts,'x-byl-signature':sign(null,Buffer.from(canonical),PRIVATE_KEY).toString('base64')};
}
function target(deviceId){
  const upstream=TARGETS[deviceId];
  if(!upstream)throw new Error('DEVICE_UNKNOWN');
  return upstream;
}
async function agentGet(deviceId,path){
  const body=Buffer.alloc(0);
  const r=await fetch(new URL(path,target(deviceId)),{headers:headers('GET',path,body),signal:AbortSignal.timeout(10000)});
  const text=await r.text();
  if(!r.ok)throw new Error(`AGENT_${r.status}:${text.slice(0,300)}`);
  return JSON.parse(text);
}
async function agentCall(deviceId,name,args){
  const path='/v1/call';
  const body=Buffer.from(JSON.stringify({name,arguments:args||{}}));
  const r=await fetch(new URL(path,target(deviceId)),{method:'POST',headers:headers('POST',path,body),body,signal:AbortSignal.timeout(30000)});
  const text=await r.text();
  if(!r.ok)throw new Error(`AGENT_${r.status}:${text.slice(0,300)}`);
  return JSON.parse(text);
}
function textResult(value){
  return {content:[{type:'text',text:typeof value==='string'?value:JSON.stringify(value,null,2)}]};
}
function getServer(){
  const server=new McpServer({name:'byl-remote-mcp',version:'1.0.0'});
  server.registerTool('remote_list_devices',{
    description:'List BYL remote Desktop Commander devices.'
  },async()=>textResult(Object.keys(TARGETS).map(id=>({id,state:'READY'}))));
  server.registerTool('remote_list_tools',{
    description:'List allowed Desktop Commander tools on a device.',
    inputSchema:{deviceId:z.enum(['us-macmini','china-mac','windows'])}
  },async({deviceId})=>textResult(await agentGet(deviceId,'/v1/tools')));
  server.registerTool('remote_call',{
    description:'Call an allowed Desktop Commander tool on a selected device.',
    inputSchema:{
      deviceId:z.enum(['us-macmini','china-mac','windows']),
      name:z.string().min(1),
      arguments:z.record(z.string(),z.unknown()).optional()
    }
  },async({deviceId,name,arguments:args})=>{
    const out=await agentCall(deviceId,name,args||{});
    return textResult(out.result??out);
  });
  server.registerTool('remote_process_selftest',{
    description:'Run a fixed read-only hostname process self-test on a selected device.',
    inputSchema:{deviceId:z.enum(['us-macmini','china-mac','windows'])}
  },async({deviceId})=>{
    const out=await agentCall(deviceId,'start_process',{command:'hostname',timeout_ms:8000});
    return textResult(out.result??out);
  });
  server.registerTool(PRIMARY_GUI_TOOL_NAME,{
    description:'Single fixed Dev cart homepage navigation on isolated Windows Chrome. No arbitrary URL, PID, action, order, payment or profile parameters.'
  },async()=>{
    const result=await guiDevCartHomeCanary(agentCall);
    return result.ok?textResult(result):{isError:true,...textResult(result)};
  });
  return server;
}

const app=createMcpExpressApp({host:'127.0.0.1',allowedHosts:['127.0.0.1','localhost','erp.beyourlover.com','mcp.beyourlover.com']});
function auth(req,res,next){
  if((req.headers.authorization||'')!==`Bearer ${TOKEN}`){
    return res.status(401).json({jsonrpc:'2.0',error:{code:-32001,message:'Unauthorized'},id:null});
  }
  next();
}
const MCP_PATHS=['/mcp','/__byl_remote_mcp/mcp'];
for(const route of MCP_PATHS) app.post(route,auth,async(req,res)=>{
  const server=getServer();
  const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
  try{
    await server.connect(transport);
    await transport.handleRequest(req,res,req.body);
  }catch(error){
    console.error('[mcp]',error);
    if(!res.headersSent)res.status(500).json({jsonrpc:'2.0',error:{code:-32603,message:'Internal server error'},id:null});
  }finally{
    res.on('close',()=>{transport.close().catch(()=>{});server.close().catch(()=>{});});
  }
});
for(const route of MCP_PATHS) app.get(route,auth,(_req,res)=>res.status(405).json({jsonrpc:'2.0',error:{code:-32000,message:'Method not allowed'},id:null}));
for(const route of MCP_PATHS) app.delete(route,auth,(_req,res)=>res.status(405).json({jsonrpc:'2.0',error:{code:-32000,message:'Method not allowed'},id:null}));
app.get('/healthz',(_req,res)=>res.json({ok:true,service:'byl-remote-mcp-standard-endpoint',version:1}));
app.listen(PORT,HOST,()=>console.log(`BYL standard MCP endpoint listening on http://${HOST}:${PORT}/mcp`));
