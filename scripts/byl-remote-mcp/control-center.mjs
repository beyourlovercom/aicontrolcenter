import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,sign} from 'node:crypto';

const ROOT=dirname(fileURLToPath(import.meta.url));
const HOST='127.0.0.1';
const PORT=8793;
const PRIVATE_KEY=readFileSync('/Users/a/.byl-remote-mcp/keys/gateway-ed25519-private.pem','utf8');
const CANARY_LOG='/Users/a/.byl-remote-mcp/cutover-canary.jsonl';
const CONTROL_PASSWORD=process.env.BYL_CONTROL_PASSWORD||'';
const SESSION_KEY=createHash('sha256').update(CONTROL_PASSWORD+readFileSync('/Users/a/.byl-remote-mcp/gateway.token','utf8')).digest('hex');

const DEVICES=Object.freeze({
  'us-macmini':{name:'US Mac mini',subtitle:'美国网关机',upstream:'http://127.0.0.1:8791'},
  'china-mac':{name:'China Mac',subtitle:'中国主力 Mac',upstream:'http://100.102.15.40:8791'},
  'windows':{name:'Windows',subtitle:'YST-241030SSD',upstream:'http://100.87.29.56:8791'}
});

function sha(body){return createHash('sha256').update(body).digest('hex');}
function signedHeaders(method,path,body){
  const ts=String(Date.now());
  const canonical=`${method}\n${path}\n${ts}\n${sha(body)}`;
  return {'content-type':'application/json','x-byl-timestamp':ts,'x-byl-signature':sign(null,Buffer.from(canonical),PRIVATE_KEY).toString('base64')};
}
function requestPeer(req){return (req.socket.remoteAddress||'').replace(/^::ffff:/,'');}
function accessAllowed(req){
  const peer=requestPeer(req);
  const host=String(req.headers.host||'').split(':')[0].toLowerCase();
  if((host==='127.0.0.1'||host==='localhost')&&(peer==='127.0.0.1'||peer==='::1'))return true;
  return Boolean(CONTROL_PASSWORD)&&String(req.headers.cookie||'').split(';').some(v=>v.trim()==='byl_control_session='+SESSION_KEY);
}
function loginPage(error=''){
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="robots" content="noindex,nofollow,noarchive"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BYL Remote MCP</title><style>body{margin:0;background:#0b0d10;color:#f5f7f8;font-family:-apple-system,BlinkMacSystemFont,sans-serif;display:grid;place-items:center;min-height:100vh}.box{width:340px;max-width:calc(100vw - 56px);background:#15181d;border:1px solid #2a2f37;border-radius:16px;padding:28px}h1{font-size:22px;margin:0 0 8px}p{color:#9ca5b1;font-size:13px}input,button{width:100%;box-sizing:border-box;border-radius:9px;padding:12px;margin-top:12px}input{background:#0d1014;border:1px solid #343a43;color:#fff}button{border:0;background:#2ea6ff;color:#fff;font-weight:700}.err{color:#ff8585}</style></head><body><form class="box" method="post" action="/control/login"><h1>BYL Remote MCP</h1><p>请输入控制台密码</p>'+(error?'<div class="err">'+error+'</div>':'')+'<input type="password" name="password" autofocus><button>登录</button></form></body></html>';
}

function sameOrigin(req){
  const origin=req.headers.origin;
  if(!origin)return true;
  return origin==='https://mcp.beyourlover.com'||origin==='http://127.0.0.1:8793'||origin==='http://localhost:8793';
}
function json(res,status,body){
  res.writeHead(status,{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'});
  res.end(JSON.stringify(body));
}
function text(res,status,body,type='text/plain; charset=utf-8'){
  res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'});
  res.end(body);
}
async function readJson(req){
  const parts=[];let size=0;
  for await(const chunk of req){size+=chunk.length;if(size>65536)throw new Error('BODY_TOO_LARGE');parts.push(chunk);}
  return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');
}
async function agentHealth(device){
  const started=Date.now();
  try{
    const r=await fetch(device.upstream+'/healthz',{signal:AbortSignal.timeout(5000)});
    const body=await r.json();
    return {ok:r.ok,status:r.status,latencyMs:Date.now()-started,toolCount:body.toolCount||0};
  }catch(error){
    return {ok:false,status:0,latencyMs:Date.now()-started,error:String(error?.message||error)};
  }
}
async function agentCall(device,path,payload){
  const body=Buffer.from(JSON.stringify(payload||{}));
  const r=await fetch(device.upstream+path,{
    method:'POST',headers:signedHeaders('POST',path,body),body,signal:AbortSignal.timeout(15000)
  });
  const raw=await r.text();
  let parsed;try{parsed=JSON.parse(raw);}catch{parsed={raw};}
  return {ok:r.ok,status:r.status,body:parsed};
}
function extractConfig(result){
  const root=result?.body?.result;
  if(root?.structuredContent?.config)return root.structuredContent.config;
  const textNode=root?.content?.find?.(x=>x?.type==='text')?.text;
  if(textNode){try{return JSON.parse(textNode);}catch{}}
  return {};
}
async function deviceStatus(id,device){
  const health=await agentHealth(device);
  let config={};
  if(health.ok){
    try{config=extractConfig(await agentCall(device,'/v1/call',{name:'get_config',arguments:{}}));}catch{}
  }
  return {
    id,name:device.name,subtitle:device.subtitle,
    online:health.ok,latencyMs:health.latencyMs,toolCount:health.toolCount,
    version:config.version||'—',
    platform:config.systemInfo?.platform||'—',
    lastSeen:health.ok?new Date().toISOString():null
  };
}
function canarySummary(){
  if(!existsSync(CANARY_LOG))return {started:false,checks:0,passed:0,failed:0,last:null};
  const lines=readFileSync(CANARY_LOG,'utf8').trim().split('\n').filter(Boolean);
  const rows=lines.map(line=>{try{return JSON.parse(line);}catch{return null;}}).filter(Boolean);
  const passed=rows.filter(r=>r.ok).length;
  return {
    started:rows.length>0,checks:rows.length,passed,failed:rows.length-passed,
    first:rows[0]?.ts||null,last:rows.at(-1)||null
  };
}
async function fullStatus(req){
  const entries=await Promise.all(Object.entries(DEVICES).map(async([id,d])=>deviceStatus(id,d)));
  let gateway={ok:false,latencyMs:null};
  const started=Date.now();
  try{
    const r=await fetch('http://127.0.0.1:8790/healthz',{signal:AbortSignal.timeout(3000)});
    gateway={ok:r.ok,latencyMs:Date.now()-started};
  }catch{}
  const user=String(req.headers['cf-access-authenticated-user-email']||'Local UAT');
  return {generatedAt:new Date().toISOString(),user,gateway,devices:entries,canary:canarySummary()};
}
async function restartDevice(id){
  const device=DEVICES[id];
  if(!device)return {ok:false,status:404,error:'DEVICE_UNKNOWN'};
  const before=await agentHealth(device);
  if(!before.ok)return {ok:false,status:409,error:'DEVICE_OFFLINE_AUTO_RECOVERY_ACTIVE'};
  const r=await agentCall(device,'/v1/restart',{});
  if(!r.ok)return {ok:false,status:r.status,error:'RESTART_REJECTED'};
  await new Promise(resolve=>setTimeout(resolve,id==='windows'?12000:3000));
  const after=await agentHealth(device);
  return {ok:after.ok,status:after.ok?200:503,before,after};
}
const staticFiles={
  '/control/':{file:'control-center/index.html',type:'text/html; charset=utf-8'},
  '/control/app.js':{file:'control-center/app.js',type:'text/javascript; charset=utf-8'},
  '/control/styles.css':{file:'control-center/styles.css',type:'text/css; charset=utf-8'}
};

createServer(async(req,res)=>{
  try{
    const url=new URL(req.url||'/',`http://${req.headers.host||'localhost'}`);
    if((req.method==='GET'||req.method==='HEAD')&&url.pathname==='/'){
      res.writeHead(302,{location:'/control/','cache-control':'no-store'});return res.end();
    }
    if(req.method==='GET'&&url.pathname==='/robots.txt')return text(res,200,'User-agent: *\nDisallow: /control/\n');
    if(req.method==='GET'&&url.pathname==='/control/login')return text(res,200,loginPage(),'text/html; charset=utf-8');
    if(req.method==='POST'&&url.pathname==='/control/login'){
      const parts=[];for await(const chunk of req)parts.push(chunk);
      const form=new URLSearchParams(Buffer.concat(parts).toString('utf8'));
      if(!CONTROL_PASSWORD||form.get('password')!==CONTROL_PASSWORD)return text(res,401,loginPage('密码错误'),'text/html; charset=utf-8');
      res.writeHead(303,{location:'/control/','set-cookie':'byl_control_session='+SESSION_KEY+'; Path=/control/; HttpOnly; Secure; SameSite=Strict; Max-Age=86400','cache-control':'no-store','x-robots-tag':'noindex, nofollow, noarchive'});return res.end();
    }
    if(!accessAllowed(req))return text(res,401,loginPage(),'text/html; charset=utf-8');
    if(req.method==='GET'&&staticFiles[url.pathname]){
      const asset=staticFiles[url.pathname];
      return text(res,200,readFileSync(join(ROOT,asset.file),'utf8'),asset.type);
    }
    if(req.method==='GET'&&url.pathname==='/control/api/status')return json(res,200,await fullStatus(req));
    if(req.method==='POST'&&url.pathname==='/control/api/check'){
      if(!sameOrigin(req))return json(res,403,{error:'ORIGIN_DENIED'});
      return json(res,200,await fullStatus(req));
    }
    if(req.method==='POST'&&url.pathname==='/control/api/restart'){
      if(!sameOrigin(req))return json(res,403,{error:'ORIGIN_DENIED'});
      const input=await readJson(req);
      const result=await restartDevice(input.deviceId);
      return json(res,result.status||200,result);
    }
    if(req.method==='GET'&&url.pathname==='/control/healthz')return json(res,200,{ok:true,service:'byl-remote-control-center'});
    return json(res,404,{error:'NOT_FOUND'});
  }catch(error){
    console.error('[control-center]',error);
    return json(res,500,{error:'CONTROL_CENTER_ERROR'});
  }
}).listen(PORT,HOST,()=>console.log(`BYL Remote Control Center listening on http://${HOST}:${PORT}`));
