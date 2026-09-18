import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';

const HOST=process.env.BYL_GATEWAY_HOST||'127.0.0.1';
const PORT=Number(process.env.BYL_GATEWAY_PORT||'8790');
const TOKEN_FILE=process.env.BYL_GATEWAY_TOKEN_FILE||join(homedir(),'.byl-remote-mcp/gateway.token');
const UPSTREAM=process.env.BYL_GATEWAY_US_RUNNER||'http://100.94.52.109:8787';
const MAX_BODY=Number(process.env.BYL_GATEWAY_MAX_BODY||'1048576');
const PREFIX=process.env.BYL_GATEWAY_PREFIX||'/__byl_remote_mcp';
let TOKEN='';

try{TOKEN=readFileSync(TOKEN_FILE,'utf8').trim();}catch(error){
  console.error('FATAL: unable to read gateway token file:',error.message);process.exit(1);
}
if(HOST!=='127.0.0.1'){console.error('FATAL: gateway must bind to 127.0.0.1');process.exit(1);}
if(TOKEN.length<32){console.error('FATAL: gateway token must be at least 32 chars');process.exit(1);}

function json(res,status,body){
  res.writeHead(status,{'content-type':'application/json','cache-control':'no-store'});
  res.end(JSON.stringify(body));
}
function authorized(req){
  return (req.headers.authorization||'')===`Bearer ${TOKEN}`;
}
async function readBody(req){
  let size=0;const parts=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>MAX_BODY)throw Object.assign(new Error('too large'),{code:'BODY_TOO_LARGE'});
    parts.push(chunk);
  }
  return Buffer.concat(parts);
}
async function proxy(req,res,targetPath){
  const body=req.method==='GET'?undefined:await readBody(req);
  const upstream=await fetch(new URL(targetPath,UPSTREAM),{
    method:req.method,
    headers:{'content-type':'application/json'},
    body
  });
  const text=await upstream.text();
  res.writeHead(upstream.status,{
    'content-type':upstream.headers.get('content-type')||'application/json',
    'cache-control':'no-store'
  });
  res.end(text);
}
createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    const path=url.pathname.startsWith(PREFIX)
      ? (url.pathname.slice(PREFIX.length)||'/')
      : url.pathname;

    if(req.method==='GET'&&path==='/healthz'){
      return json(res,200,{ok:true,service:'byl-remote-mcp-gateway',version:1});
    }
    if(!authorized(req))return json(res,401,{errorCode:'GATEWAY_UNAUTHORIZED'});
    if(req.method==='GET'&&path==='/v1/status')return proxy(req,res,'/v1/status');
    if(req.method==='POST'&&path==='/v1/executions')return proxy(req,res,'/v1/executions');

    const m=path.match(/^\/v1\/executions\/([^/]+)$/);
    if(req.method==='GET'&&m){
      return proxy(req,res,`/v1/executions/${encodeURIComponent(decodeURIComponent(m[1]))}`);
    }
    return json(res,404,{errorCode:'GATEWAY_NOT_FOUND'});
  }catch(error){
    if(error?.code==='BODY_TOO_LARGE')return json(res,413,{errorCode:'GATEWAY_BODY_TOO_LARGE'});
    console.error('[gateway]',error);
    return json(res,502,{errorCode:'GATEWAY_UPSTREAM_ERROR'});
  }
}).listen(PORT,HOST,()=>{
  console.log(`BYL Remote MCP Gateway listening on http://${HOST}:${PORT} upstream=${UPSTREAM}`);
});
