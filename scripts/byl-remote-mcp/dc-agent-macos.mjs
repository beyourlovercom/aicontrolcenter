import {createServer} from 'node:http';
import {readFileSync,appendFileSync} from 'node:fs';
import {createHash,verify} from 'node:crypto';
import {Client} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/index.js';
import {StdioClientTransport} from '/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@modelcontextprotocol/sdk/dist/esm/client/stdio.js';

const HOST=process.env.BYL_DC_AGENT_HOST;
const PORT=Number(process.env.BYL_DC_AGENT_PORT||'8791');
const ALLOWED_REMOTE=process.env.BYL_DC_AGENT_ALLOWED_REMOTE;
const PUBKEY=readFileSync(process.env.BYL_DC_AGENT_PUBLIC_KEY,'utf8');
const AUDIT=process.env.BYL_DC_AGENT_AUDIT_LOG;
const NODE_BIN='/opt/homebrew/bin/node';
const DC_ENTRY='/Users/a/Library/Application Support/AICC/desktop-commander-runtime/node_modules/@wonderwhy-er/desktop-commander/dist/index.js';
const DENY=new Set(['set_config_value','force_terminate']);
let client=null,transport=null,connecting=null;

function json(res,status,body){res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});res.end(JSON.stringify(body));}
function peer(req){return (req.socket.remoteAddress||'').replace(/^::ffff:/,'');}
function audit(req,event,extra={}){appendFileSync(AUDIT,JSON.stringify({ts:new Date().toISOString(),peer:peer(req),event,...extra})+'\n');}
function sha(body){return createHash('sha256').update(body).digest('hex');}
function signed(req,path,body){
  const ts=req.headers['x-byl-timestamp'],sig=req.headers['x-byl-signature'];
  if(typeof ts!=='string'||typeof sig!=='string'||Math.abs(Date.now()-Number(ts))>60000)return false;
  return verify(null,Buffer.from(`${req.method}\n${path}\n${ts}\n${sha(body)}`),PUBKEY,Buffer.from(sig,'base64'));
}
async function ensureClient(){
  if(client)return client;if(connecting)return connecting;
  connecting=(async()=>{const c=new Client({name:'byl-dc-agent',version:'1.0.0'},{capabilities:{}});const t=new StdioClientTransport({command:NODE_BIN,args:[DC_ENTRY],stderr:'pipe'});await c.connect(t);client=c;transport=t;return c;})().finally(()=>{connecting=null;});
  return connecting;
}
async function readBody(req){const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>1048576)throw Object.assign(new Error('too large'),{code:'BODY_TOO_LARGE'});chunks.push(chunk);}return Buffer.concat(chunks);}
createServer(async(req,res)=>{
  let body=Buffer.alloc(0);
  try{
    if(peer(req)!==ALLOWED_REMOTE){audit(req,'peer_denied');return json(res,403,{errorCode:'DC_AGENT_PEER_DENIED'});}
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if(req.method==='GET'&&url.pathname==='/healthz'){const tools=await (await ensureClient()).listTools();return json(res,200,{ok:true,service:'byl-dc-agent',toolCount:tools.tools.length});}
    if(req.method==='POST')body=await readBody(req);
    if(!signed(req,url.pathname,body)){audit(req,'signature_denied');return json(res,401,{errorCode:'DC_AGENT_SIGNATURE_INVALID'});}
    if(req.method==='GET'&&url.pathname==='/v1/tools'){const tools=await (await ensureClient()).listTools();return json(res,200,{tools:tools.tools.filter(t=>!DENY.has(t.name)).map(t=>({name:t.name,description:t.description||''}))});}
    if(req.method==='POST'&&url.pathname==='/v1/call'){
      let input;try{input=JSON.parse(body.toString('utf8')||'{}');}catch{return json(res,400,{errorCode:'DC_AGENT_JSON_INVALID'});}
      if(typeof input.name!=='string'||!input.name)return json(res,400,{errorCode:'DC_AGENT_TOOL_REQUIRED'});
      if(DENY.has(input.name)){audit(req,'tool_denied',{tool:input.name});return json(res,403,{errorCode:'DC_AGENT_TOOL_DENIED',tool:input.name});}
      audit(req,'tool_call',{tool:input.name});const result=await (await ensureClient()).callTool({name:input.name,arguments:input.arguments||{}});audit(req,'tool_result',{tool:input.name,ok:!result?.isError});return json(res,200,{result});
    }
    return json(res,404,{errorCode:'DC_AGENT_NOT_FOUND'});
  }catch(error){audit(req,'agent_error',{code:error?.code||'DC_AGENT_MCP_ERROR'});client=null;try{await transport?.close();}catch{}transport=null;return json(res,502,{errorCode:'DC_AGENT_MCP_ERROR'});}
}).listen(PORT,HOST,()=>console.log(`BYL DC Agent listening on http://${HOST}:${PORT}`));
