import {createServer} from 'node:http';
import {readFileSync} from 'node:fs';
import {homedir} from 'node:os';
import {join} from 'node:path';
import {listDevices,resolveDevice} from './device-router.mjs';

const HOST=process.env.BYL_GATEWAY_HOST||'127.0.0.1';
const PORT=Number(process.env.BYL_GATEWAY_PORT||'8790');
const TOKEN_FILE=process.env.BYL_GATEWAY_TOKEN_FILE||join(homedir(),'.byl-remote-mcp/gateway.token');
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
function authorized(req){return (req.headers.authorization||'')===`Bearer ${TOKEN}`;}
async function readJsonBody(req){
  let size=0;const parts=[];
  for await(const chunk of req){
    size+=chunk.length;
    if(size>MAX_BODY)throw Object.assign(new Error('too large'),{code:'BODY_TOO_LARGE'});
    parts.push(chunk);
  }
  const raw=Buffer.concat(parts).toString('utf8');
  try{return raw?JSON.parse(raw):{};}catch{throw Object.assign(new Error('bad json'),{code:'JSON_INVALID'});}
}
async function proxyJson(res,method,upstream,targetPath,body){
  const r=await fetch(new URL(targetPath,upstream),{
    method,
    headers:{'content-type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const text=await r.text();
  res.writeHead(r.status,{
    'content-type':r.headers.get('content-type')||'application/json',
    'cache-control':'no-store'
  });
  res.end(text);
}
function failDevice(res,resolution){
  return json(res,resolution.status,{
    errorCode:resolution.errorCode,
    ...(resolution.device?{device:resolution.device}: {})
  });
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
    if(req.method==='GET'&&path==='/v1/devices'){
      return json(res,200,{devices:listDevices()});
    }

    if(req.method==='GET'&&path==='/v1/status'){
      const resolution=resolveDevice(url.searchParams.get('deviceId'));
      if(!resolution.ok)return failDevice(res,resolution);
      return proxyJson(res,'GET',resolution.device.upstream,'/v1/status');
    }
    if(req.method==='POST'&&path==='/v1/executions'){
      const input=await readJsonBody(req);
      const resolution=resolveDevice(input.deviceId);
      if(!resolution.ok)return failDevice(res,resolution);
      const {deviceId,...upstreamInput}=input;
      return proxyJson(res,'POST',resolution.device.upstream,'/v1/executions',upstreamInput);
    }

    const m=path.match(/^\/v1\/executions\/([^/]+)$/);
    if(req.method==='GET'&&m){
      const resolution=resolveDevice(url.searchParams.get('deviceId'));
      if(!resolution.ok)return failDevice(res,resolution);
      return proxyJson(
        res,'GET',resolution.device.upstream,
        `/v1/executions/${encodeURIComponent(decodeURIComponent(m[1]))}`
      );
    }
    return json(res,404,{errorCode:'GATEWAY_NOT_FOUND'});
  }catch(error){
    if(error?.code==='BODY_TOO_LARGE')return json(res,413,{errorCode:'GATEWAY_BODY_TOO_LARGE'});
    if(error?.code==='JSON_INVALID')return json(res,400,{errorCode:'GATEWAY_JSON_INVALID'});
    console.error('[gateway]',error);
    return json(res,502,{errorCode:'GATEWAY_UPSTREAM_ERROR'});
  }
}).listen(PORT,HOST,()=>{
  console.log(`BYL Remote MCP Gateway listening on http://${HOST}:${PORT}`);
});
