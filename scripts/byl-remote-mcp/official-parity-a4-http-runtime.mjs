/**
 * A4.1 credential-free HTTP/OAuth runtime candidate.
 *
 * Only builds an app. NEVER listen(), load a key, change a route,
 * connect to a device, or restart a service on import/construction.
 *
 * Runtime owner injects exact current access verifier, signed fixed-target
 * Agent transport, Operator Policy, secure bearer, and redacted audit sink.
 * Public GitHub must NEVER receive these production values.
 */
import {createHash,timingSafeEqual} from 'node:crypto';
import {createCredentialFreeOAuthToolSurface} from './official-parity-oauth-runtime-surface.mjs';

const EXACT_ROUTE='/oauth/mcp',EXACT_PORT=8797,LOOPBACK='127.0.0.1';
const reject=code=>{throw Error(code);};
function secureBearer(header,tokenDigest){
 if(typeof header!=='string'||!header.startsWith('Bearer ')||header.length>8199)
  return false;
 const candidate=header.slice(7);
 if(!candidate||candidate.length>8192)return false;
 const hashed=createHash('sha256').update(candidate,'utf8').digest();
 return timingSafeEqual(hashed,tokenDigest);
}
function approvedHosts(hosts){
 if(!Array.isArray(hosts)||hosts.length<2||hosts.length>12||
    !hosts.includes('localhost')||!hosts.includes(LOOPBACK)||
    hosts.some(h=>typeof h!=='string'||h.length>180||
     !/^(localhost|127\.0\.0\.1|[a-z0-9-]+(?:\.[a-z0-9-]+)+)$/.test(h)))
  reject('PARITY_HOST_ALLOWLIST_INVALID');
 return Object.freeze([...new Set(hosts)]);
}
function responseError(res,status,code,message){
 return res.status(status).json({jsonrpc:'2.0',error:{code,message},id:null});
}
export function createCredentialFreeOAuthHttpRuntime({
 env,endpointRouting,getAccessConfig,resolveAccessPrincipal,
 bearerToken,allowedHosts,
 createMcpExpressApp,StreamableHTTPServerTransport,McpServer,z,
 agentGet,agentCall,canExposeRemoteCall,authorizeRemoteCall,
 auditLegacyOperation,auditOperation,logger
}={}){
 if(!env||typeof env!=='object'||Array.isArray(env)||
    env.BYL_MCP_STAGING!=='0'||env.BYL_MCP_OAUTH_COMPAT_CANDIDATE!=='1'||
    env.BYL_MCP_PRODUCTION_OAUTH_ENABLED!=='1'||env.BYL_MCP_ACCESS_ENABLED!=='1')
  reject('PARITY_RUNTIME_OAUTH_MODE_REQUIRED');
 if(typeof endpointRouting!=='function'||typeof getAccessConfig!=='function'||
    typeof resolveAccessPrincipal!=='function'||typeof createMcpExpressApp!=='function'||
    typeof StreamableHTTPServerTransport!=='function'||typeof McpServer!=='function'||
    typeof logger?.error!=='function')
  reject('PARITY_RUNTIME_BINDINGS_INCOMPLETE');
 if(typeof bearerToken!=='string'||bearerToken.length<24||bearerToken.length>8192)
  reject('PARITY_RUNTIME_BEARER_INVALID');
 // Source of bearerToken must be external secret storage, NEVER repo/env logs.
 const digest=createHash('sha256').update(bearerToken,'utf8').digest();
 const hosts=approvedHosts(allowedHosts);
 const routing=endpointRouting(env);
 if(routing?.port!==EXACT_PORT||!Array.isArray(routing.paths)||
    routing.paths.length!==1||routing.paths[0]!==EXACT_ROUTE)
  reject('PARITY_RUNTIME_ROUTE_MISMATCH');
 const access=getAccessConfig(env);
 if(access?.enabled!==true)reject('PARITY_RUNTIME_ACCESS_REQUIRED');
 // Fail all external bindings before creating routes or opening any server.
 if(typeof agentGet!=='function'||typeof agentCall!=='function'||
    typeof canExposeRemoteCall!=='function'||
    typeof authorizeRemoteCall!=='function'||typeof auditLegacyOperation!=='function'||
    (env.BYL_MCP_PARITY_CORE_READ_ENABLED==='1'&&typeof auditOperation!=='function')||
    typeof z?.string!=='function')
  reject('PARITY_RUNTIME_POLICY_INCOMPLETE');
 const app=createMcpExpressApp({host:LOOPBACK,allowedHosts:hosts});
 if(typeof app?.post!=='function'||typeof app?.get!=='function'||
    typeof app?.delete!=='function')
  reject('PARITY_RUNTIME_APP_INVALID');
 async function auth(req,res,next){
  if(secureBearer(req?.headers?.authorization,digest)){
   req.bylPrincipal=Object.freeze({kind:'internal',canOperate:true});
   return next();
  }
  let principal;
  try{
   principal=await resolveAccessPrincipal(
    req?.headers?.['cf-access-jwt-assertion'],access
   );
  }catch{}
  if(principal?.kind==='cloudflare-access'&&typeof principal.canOperate==='boolean'){
   req.bylPrincipal=principal;
   return next();
  }
  return responseError(res,401,-32001,'Unauthorized');
 }
 app.post(EXACT_ROUTE,auth,async(req,res)=>{
  let server,transport,closed=false;
  const close=()=>{
   if(closed)return;
   closed=true;
   // Close only this SDK session; NEVER reboot/stop a remote device.
   Promise.resolve(transport?.close?.()).catch(()=>{});
   Promise.resolve(server?.close?.()).catch(()=>{});
  };
  // Register before any awaited MCP I/O. An aborted client must not leak a
  // session even if the request disconnects while handleRequest is running.
  if(typeof res.once==='function')res.once('close',close);
  try{
   ({server}=createCredentialFreeOAuthToolSurface({
    McpServer,z,principal:req.bylPrincipal,
    agentGet,agentCall,canExposeRemoteCall,authorizeRemoteCall,
    auditLegacyOperation,auditOperation,env
   }));
   transport=new StreamableHTTPServerTransport({
    sessionIdGenerator:undefined,enableJsonResponse:true
   });
   await server.connect(transport);
   await transport.handleRequest(req,res,req.body);
  }catch{
   logger.error('PARITY_MCP_HANDLER_FAILURE');
   if(!res.headersSent)responseError(res,500,-32603,'Internal server error');
  }finally{
   if(typeof res.once!=='function'||res.destroyed||res.writableEnded)close();
  }
 });
 for(const method of ['get','delete'])
  app[method](EXACT_ROUTE,auth,(_req,res)=>
   responseError(res,405,-32000,'Method not allowed'));
 app.get('/healthz',(_req,res)=>res.json({
  ok:true,service:'byl-remote-mcp-standard-endpoint',version:1
 }));
 return Object.freeze({
  app,host:LOOPBACK,port:EXACT_PORT,paths:Object.freeze([EXACT_ROUTE]),
  listens:false,requiresSeparateLaunchApproval:true
 });
}
