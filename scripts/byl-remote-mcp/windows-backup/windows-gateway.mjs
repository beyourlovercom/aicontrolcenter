import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,dirname,sep} from 'node:path';
import {spawnSync} from 'node:child_process';
import {timingSafeEqual,createHash} from 'node:crypto';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {createMcpExpressApp} from '@modelcontextprotocol/sdk/server/express.js';
import * as z from 'zod/v4';
import {createRemoteJWKSet,jwtVerify} from 'jose';
const host='127.0.0.1', port=8892;
const root=resolve(process.env.BYL_WIN_BACKUP_ROOT||'C:\\Users\\Administrator\\AI');
const tokenPath=process.env.BYL_WIN_BACKUP_TOKEN_FILE;
if(!tokenPath)throw Error('TOKEN_FILE_REQUIRED');
const token=readFileSync(tokenPath,'utf8').trim();
if(token.length<40)throw Error('TOKEN_TOO_SHORT');
const accessIssuer=process.env.BYL_WIN_ACCESS_ISSUER||'';
const accessAud=process.env.BYL_WIN_ACCESS_AUDIENCE||'';
const accessOwner=(process.env.BYL_WIN_ACCESS_OWNER||'').toLowerCase();
const hasAccess=Boolean(accessIssuer&&accessAud&&accessOwner);
if([accessIssuer,accessAud,accessOwner].some(Boolean)&&!hasAccess)throw Error('INCOMPLETE_ACCESS_CONFIG');
if(hasAccess&&!/^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/.test(accessIssuer))throw Error('ISSUER_INVALID');
const jwks=hasAccess?createRemoteJWKSet(new URL(accessIssuer+'/cdn-cgi/access/certs')):null;
function inRoot(path){
 const p=resolve(String(path||''));
 if(p.toLowerCase()!==root.toLowerCase()&&!p.toLowerCase().startsWith((root+sep).toLowerCase()))throw Error('OUTSIDE_PROJECT_ROOT');
 return p;
}
function result(text){return {content:[{type:'text',text:String(text)}]}}
function serverFor(){
 const server=new McpServer({name:'byl-windows-backup',version:'1.0.0'});
 server.registerTool('hostname',{description:'Identify this Windows backup device.'},async()=>result('YST-241030SSD'));
 server.registerTool('read_file',{description:'Read UTF-8 project file.',inputSchema:{path:z.string()}},async({path})=>result(readFileSync(inRoot(path),'utf8').slice(0,250000)));
 server.registerTool('write_file',{description:'Write UTF-8 file inside dedicated project root.',inputSchema:{path:z.string(),content:z.string()}},async({path,content})=>{
  if(content.length>250000)throw Error('FILE_TOO_LARGE'); const p=inRoot(path);mkdirSync(dirname(p),{recursive:true});writeFileSync(p,content,{encoding:'utf8'});return result('FILE_WRITTEN');
 });
 server.registerTool('edit_block',{description:'Replace exactly one match inside project file.',inputSchema:{path:z.string(),old_string:z.string(),new_string:z.string()}},async({path,old_string,new_string})=>{
  if(!old_string)throw Error('EMPTY_MATCH');const p=inRoot(path);const before=readFileSync(p,'utf8');const count=before.split(old_string).length-1;if(count!==1)throw Error('EXPECTED_EXACTLY_ONE_MATCH');writeFileSync(p,before.replace(old_string,new_string));return result('FILE_EDITED');
 });
 server.registerTool('list_directory',{description:'List project directory.',inputSchema:{path:z.string()}},async({path})=>result(readdirSync(inRoot(path)).slice(0,200).join('\n')));
 server.registerTool('start_process',{description:'Run command in Windows PowerShell using owner-authorized local backup gateway.',inputSchema:{command:z.string().min(1).max(4000),timeout_ms:z.number().int().min(1000).max(30000).optional()}},async({command,timeout_ms})=>{
  const p=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',command],{cwd:root,encoding:'utf8',timeout:timeout_ms||10000,maxBuffer:300000,windowsHide:true});
  return result(JSON.stringify({exit_code:p.status,stdout:String(p.stdout||'').slice(0,120000),stderr:String(p.stderr||'').slice(0,12000),error:p.error?.code||null}));
 });
 return server;
}
const app=createMcpExpressApp({host,allowedHosts:['localhost','127.0.0.1']});
async function auth(req,res,next){
 const bearer=req.headers.authorization?.startsWith('Bearer ')?req.headers.authorization.slice(7):'';
 const a=Buffer.from(bearer),b=Buffer.from(token);
 if(a.length===b.length&&timingSafeEqual(a,b)){req.actor='local-bearer';return next()}
 if(hasAccess){
  const assertion=req.headers['cf-access-jwt-assertion'];
  if(typeof assertion==='string'){
   try{
    const {payload}=await jwtVerify(assertion,jwks,{algorithms:['RS256'],issuer:accessIssuer,audience:accessAud});
    if(payload.email?.toLowerCase()===accessOwner){req.actor=createHash('sha256').update(accessOwner).digest('hex').slice(0,12);return next()}
   }catch{}
  }
 }
 return res.status(401).json({jsonrpc:'2.0',error:{code:-32001,message:'Unauthorized'},id:null});
}
app.post('/mcp',auth,async(req,res)=>{
 const server=serverFor(),transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
 try{await server.connect(transport);await transport.handleRequest(req,res,req.body)}
 catch(e){if(!res.headersSent)res.status(500).json({error:'INTERNAL_ERROR'})}
 finally{res.on('close',()=>{transport.close().catch(()=>{});server.close().catch(()=>{})})}
});
app.get('/mcp',auth,(_req,res)=>res.status(405).end());
app.get('/healthz',(_req,res)=>res.json({ok:true,service:'byl-windows-backup',mode:'local-only'}));
app.listen(port,host,()=>console.log('WINDOWS_BACKUP_READY http://'+host+':'+port+'/mcp'));
