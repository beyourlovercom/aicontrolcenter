import {createServer} from 'node:http';
import {timingSafeEqual} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {inspectBoundDevWindow} from './gui-bound-dev.mjs';
import {navigateDevHome} from './gui-dev-navigate.mjs';
export function createGuiCanaryServer({token,inspect=inspectBoundDevWindow,navigate=navigateDevHome,allowNavigation=false}={}){
 if(typeof token!=='string'||! /^[0-9a-f]{64}$/.test(token))throw Error('STRONG_TOKEN_REQUIRED');
 const secret=Buffer.from(token,'utf8');
 const server=createServer(async(req,res)=>{
  const reply=(status,body)=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify(body));};
  if(req.method==='GET' && req.url==='/healthz')return reply(200,{ok:true,service:'beyourlover-gui-canary',mode:'isolated'});
  const supplied=Buffer.from((req.headers.authorization||'').replace(/^Bearer /,''),'utf8');
  if(supplied.length!==secret.length||!timingSafeEqual(supplied,secret))return reply(401,{ok:false,errorCode:'UNAUTHORIZED'});
  if(req.method==='GET' && req.url==='/v1/gui/tools')return reply(200,{tools:['inspect_dev_cart',...(allowNavigation?['navigate_dev_home']:[])]});
  if(req.method!=='POST'||!['/v1/gui/inspect','/v1/gui/navigate-home'].includes(req.url))return reply(404,{ok:false,errorCode:'NOT_FOUND'});
  if(req.url==='/v1/gui/navigate-home'&&!allowNavigation)return reply(403,{ok:false,errorCode:'NAVIGATION_DISABLED'});
  let chunks=[],size=0;
  try{for await(const c of req){size+=c.length;if(size>1024)return reply(413,{ok:false,errorCode:'BODY_TOO_LARGE'});chunks.push(c)}}catch{return reply(400,{ok:false,errorCode:'BODY_READ_FAILED'})}
  let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'))}catch{return reply(400,{ok:false,errorCode:'INVALID_JSON'})}
  if(!body||Object.keys(body).length!==1||!Number.isSafeInteger(body.windowPid)||body.windowPid<=0)return reply(400,{ok:false,errorCode:'INVALID_PID'});
  const result=req.url.endsWith('/inspect')?inspect(body):navigate(body);
  return reply(result.ok?200:403,result);
 });
 return server;
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 const token=readFileSync(process.env.BEYOURLOVER_GUI_TOKEN_FILE||'/dev/null','utf8').trim();
 const server=createGuiCanaryServer({token,allowNavigation:process.env.BEYOURLOVER_GUI_ENABLE_NAVIGATION==='1'});
 server.listen(Number(process.env.BEYOURLOVER_GUI_PORT||8793),'127.0.0.1',()=>console.log('GUI_CANARY_LOOPBACK_READY'));
}
