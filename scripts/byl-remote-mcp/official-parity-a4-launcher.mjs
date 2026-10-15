/**
 * A4.1 private-config bootstrap and controlled OAuth listener.
 *
 * PUBLIC SOURCE — no passwords, private endpoints, key material or machine
 * paths. The live service owner supplies a trusted manifest through an
 * already-authorized private launchd environment, never through ChatGPT.
 *
 * Not executed by imports; only explicit launchA4OAuthService() binds a port.
 * Never touches Agent processes, Cloudflare, orders or device state.
 */
import {readFileSync,statSync,appendFileSync} from 'node:fs';
import {isAbsolute,join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StreamableHTTPServerTransport} from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {createMcpExpressApp} from '@modelcontextprotocol/sdk/server/express.js';
import * as z from 'zod';
import {createCredentialFreeOAuthHttpRuntime} from './official-parity-a4-http-runtime.mjs';
import {createCredentialFreeSignedAgentClient} from './official-parity-a4-signed-agent-client.mjs';

const LABEL='com.byl.remote-mcp-oauth-compat';
const ALLOWED=['us-macmini','china-mac','windows','007windows'];
function fail(code){throw Error(code);}
function privateFile(path,{regular=true}={}){
 if(typeof path!=='string'||!isAbsolute(path)||path.length>1024)
  fail('A4_PRIVATE_FILE_REQUIRED');
 let st;
 try{st=statSync(path);}catch{fail('A4_PRIVATE_FILE_NOT_ACCESSIBLE');}
 if((regular&&!st.isFile())||(!regular&&!st.isDirectory()))
  fail('A4_PRIVATE_FILE_INVALID');
 // Private config must never be readable or writable by group/others.
 if((st.mode&0o077)!==0)
  fail('A4_PRIVATE_PERMISSIONS_DENIED');
 // Check ownership for files loaded with production signing material.
 if(typeof process.getuid==='function'&&st.uid!==process.getuid())
  fail('A4_PRIVATE_OWNER_DENIED');
 return path;
}
function readPrivate(path,{json=false}={}){
 const s=readFileSync(privateFile(path),'utf8');
 if(s.length<1||s.length>16384)fail('A4_PRIVATE_CONTENT_INVALID');
 if(!json)return s.trim();
 let obj;try{obj=JSON.parse(s);}catch{fail('A4_PRIVATE_CONTENT_INVALID');}
 if(!obj||typeof obj!=='object'||Array.isArray(obj))fail('A4_PRIVATE_CONTENT_INVALID');
 return obj;
}
const isNonblankString=x=>typeof x==='string'&&x.length>0;
export function parseA4LaunchManifest(value){
 const v=value;
 if(!v||typeof v!=='object'||Array.isArray(v))
  fail('A4_MANIFEST_INVALID');
 const fields=['runtimeDir','bearerPath','signingKeyPath','targets','allowedHosts','auditPath'];
 if(Object.keys(v).length!==fields.length||fields.some(k=>!Object.hasOwn(v,k)))
  fail('A4_MANIFEST_INVALID');
 if(![v.runtimeDir,v.bearerPath,v.signingKeyPath,v.auditPath].every(isNonblankString)||
    !v.targets||typeof v.targets!=='object'||Array.isArray(v.targets)||
    Object.keys(v.targets).length!==4||ALLOWED.some(id=>!Object.hasOwn(v.targets,id))||
    !Array.isArray(v.allowedHosts)||v.allowedHosts.length<2)
  fail('A4_MANIFEST_INVALID');
 return Object.freeze({...v,targets:Object.freeze({...v.targets}),
  allowedHosts:Object.freeze([...v.allowedHosts])});
}
function makeAuditor(path){
 privateFile(path);
 return (entry)=>{
  if(!entry||!['allow','deny'].includes(entry.decision)||
    !ALLOWED.includes(entry.deviceId)||
    typeof entry.operation!=='string'||!/^[a-z_]{1,64}$/.test(entry.operation))
   return false;
  const record={at:new Date().toISOString(),decision:entry.decision,
   principalHash:typeof entry.principalHash==='string'?
    entry.principalHash.slice(0,24):'unknown',
   deviceId:entry.deviceId,operation:entry.operation};
  try{
   appendFileSync(path,JSON.stringify(record)+'\n',{encoding:'utf8',mode:0o600,flag:'a'});
   return true;
  }catch{return false;}
 };
}
/**
 * The running OAuth service already uses an approved private auth/policy
 * package. Import its three side-effect-free modules; never import the old
 * mcp-endpoint.mjs, because the old entrypoint calls listen() on import.
 *
 * Returns only sanitized launch metadata; caller retains the private listener
 * as an internal object, never serializes configuration or secrets.
 */
export async function launchA4OAuthService({
 env=process.env,manifestFile=env?.BYL_MCP_A4_PRIVATE_MANIFEST_FILE,
 listen=true,importPrivate,readManifest,logger=console
}={}){
 if(env?.BYL_MCP_A4_SERVICE_LAUNCH_ENABLED!=='1'||env.BYL_MCP_STAGING!=='0'||
    env.BYL_MCP_PRODUCTION_OAUTH_ENABLED!=='1')
  fail('A4_LAUNCH_NOT_APPROVED');
 if(typeof importPrivate!=='function')importPrivate=async p=>import(pathToFileURL(p).href);
 if(typeof readManifest!=='function')readManifest=path=>readPrivate(path,{json:true});
 const v=parseA4LaunchManifest(readManifest(privateFile(manifestFile)));
 const dir=privateFile(v.runtimeDir,{regular:false});
 const imported=await Promise.all([
  'access-auth.mjs','endpoint-routing.mjs','operator-policy.mjs'
 ].map(f=>importPrivate(join(dir,f))));
 const [auth,routing,policy]=imported;
 if(typeof auth.getAccessConfig!=='function'||
    typeof auth.resolveAccessPrincipal!=='function'||
    typeof routing.endpointRouting!=='function'||
    typeof policy.canExposeRemoteCall!=='function'||
    typeof policy.authorizeRemoteCall!=='function')
  fail('A4_PRIVATE_POLICY_UNAVAILABLE');
 const token=readPrivate(v.bearerPath);
 const signingKey=readPrivate(v.signingKeyPath);
 const auditor=makeAuditor(v.auditPath);
 const agent=createCredentialFreeSignedAgentClient({
  targets:v.targets,signingKey,fetchImpl:fetch
 });
 const runtime=createCredentialFreeOAuthHttpRuntime({
  env,endpointRouting:routing.endpointRouting,
  getAccessConfig:auth.getAccessConfig,
  resolveAccessPrincipal:auth.resolveAccessPrincipal,
  bearerToken:token,allowedHosts:v.allowedHosts,
  createMcpExpressApp,StreamableHTTPServerTransport,McpServer,z,
  agentGet:agent.agentGet,agentCall:agent.agentCall,
  canExposeRemoteCall:policy.canExposeRemoteCall,
  authorizeRemoteCall:policy.authorizeRemoteCall,
  auditLegacyOperation:auditor,auditOperation:auditor,
  logger:{error:()=>logger.error?.('A4_OAUTH_RUNTIME_REQUEST_FAILED')}
 });
 // When not explicitly approved to bind, this is only an inert constructor.
 if(!listen)return Object.freeze({status:'PREPARED_NOT_LISTENING',port:runtime.port,
  host:runtime.host,route:runtime.paths[0],serviceLabel:LABEL});
 const listener=runtime.app.listen(runtime.port,runtime.host);
 listener.on('error',()=>{logger.error?.('A4_OAUTH_LISTEN_FAILED');});
 return Object.freeze({status:'SERVICE_LAUNCH_ATTEMPTED',port:runtime.port,
  host:runtime.host,route:runtime.paths[0],serviceLabel:LABEL,listener});
}
