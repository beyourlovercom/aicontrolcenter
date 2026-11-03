/**
 * Portable, credential-free OAuth MCP registration surface (A4 candidate).
 *
 * Source-reconciles *tool behavior*, not listeners or infrastructure: callers
 * inject the existing trusted principal, signed fixed-target agentGet/agentCall,
 * operator visibility/authorization and redacted audit sinks. No host, port,
 * private key, token, Cloudflare route, env secret or service restart here.
 *
 * NOT connected to a production runtime. This module is suitable for
 * in-memory protocol and independent source review only until Owner release.
 */
import {registerOAuthParityCore} from './official-parity-oauth-hook.mjs';
import {normalizeApprovedRemoteCall} from './official-parity-terminal-compat.mjs';
import {filterDiscoveredAgentTools} from './official-parity-operator-tool-discovery.mjs';

export const CANONICAL_DEVICE_IDS=Object.freeze([
 'us-macmini','china-mac','windows','007windows'
]);
export const CANONICAL_LEGACY_TOOLS=Object.freeze([
 'remote_list_devices','remote_list_tools','remote_call','remote_process_selftest'
]);
const WINDOWS_HOSTNAME_COMMAND='[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; $OutputEncoding = [System.Text.Encoding]::UTF8; [System.Net.Dns]::GetHostName()';
function reply(value){
 const text=typeof value==='string'?value:JSON.stringify(value,null,2);
 return {content:[{type:'text',text}]};
}
export function createCredentialFreeOAuthToolSurface({
 McpServer,z,principal,agentGet,agentCall,
 canExposeRemoteCall,authorizeRemoteCall,listAuthorizedRemoteToolNames,
 auditLegacyOperation,auditOperation,env={}
}={}){
 if(typeof McpServer!=='function'||typeof z?.string!=='function'||
    typeof z?.record!=='function'||typeof z?.unknown!=='function'||
    !principal||typeof principal!=='object'||
    typeof agentGet!=='function'||typeof agentCall!=='function'||
    typeof canExposeRemoteCall!=='function'||typeof authorizeRemoteCall!=='function'||
    (env?.BYL_MCP_OPERATOR_DISCOVERY_FILTER_ENABLED==='1'&&
     typeof listAuthorizedRemoteToolNames!=='function')||
    typeof auditLegacyOperation!=='function')
  throw Error('PARITY_RUNTIME_DEPENDENCIES_REQUIRED');
 if(env?.BYL_MCP_OPERATOR_DISCOVERY_FILTER_ENABLED!==undefined&&
    !['0','1'].includes(env.BYL_MCP_OPERATOR_DISCOVERY_FILTER_ENABLED))
  throw Error('OPERATOR_DISCOVERY_FLAG_INVALID');
 const discoveryFilterEnabled=env?.BYL_MCP_OPERATOR_DISCOVERY_FILTER_ENABLED==='1';
 const devices=new Set(CANONICAL_DEVICE_IDS);
 const safeDevice=id=>{
  if(!devices.has(id))throw Error('DEVICE_UNKNOWN');
  return id;
 };
 // Fail closed when the operator discovery policy is unavailable; no changes
 // to the permissions of the previously configured principal are attempted.
 let legacyOperatorVisible=false;
 try{legacyOperatorVisible=canExposeRemoteCall(principal)===true;}catch{}
 const server=new McpServer({name:'byl-remote-mcp',version:'1.0.0'});
 server.registerTool('remote_list_devices',{
  description:'List BYL remote Desktop Commander devices.'
 },async()=>reply(CANONICAL_DEVICE_IDS.map(id=>({id,state:'READY'}))));
 server.registerTool('remote_list_tools',{
  description:'List allowed Desktop Commander tools on a device.',
  inputSchema:{deviceId:z.string().min(1).max(64)}
 },async({deviceId})=>{
  const id=safeDevice(deviceId);
  // Default-OFF compatibility mode preserves preexisting discovery exactly.
  // Never enable filtering until private policy implements its name resolver.
  // Existing internal Bearer bypasses OAuth Operator authorization by design;
  // preserve its historical Agent inventory when the OAuth filter is enabled.
  if(!discoveryFilterEnabled||principal.kind==='internal')
   return reply(await agentGet(id,'/v1/tools'));
  if(!legacyOperatorVisible||principal.canOperate!==true)return reply({tools:[]});
  const agentReply=await agentGet(id,'/v1/tools');
  return reply(filterDiscoveredAgentTools({agentReply,principal,deviceId:id,
   listAuthorizedRemoteToolNames}));
 });
 if(legacyOperatorVisible)server.registerTool('remote_call',{
  description:'Call an allowed Desktop Commander tool on a selected device.',
  inputSchema:{
   deviceId:z.string().min(1).max(64),
   name:z.string().min(1),
   arguments:z.record(z.string(),z.unknown()).optional()
  }
 },async({deviceId,name,arguments:args})=>{
  const id=safeDevice(deviceId);
  let approved={name,arguments:args||{}};
  if(principal.kind==='cloudflare-access'){
   try{approved=authorizeRemoteCall(principal,id,name,args||{});}
   catch(e){
    try{auditLegacyOperation({decision:'deny',principalHash:principal.subjectHash||'unknown',
     deviceId:id,operation:name});}catch{}
    throw e;
   }
   if(approved?.name!==name||!approved.arguments||
      typeof approved.arguments!=='object'||Array.isArray(approved.arguments))
    throw Error('OPERATOR_DENIED');
   const logged=auditLegacyOperation({decision:'allow',principalHash:principal.subjectHash||'unknown',
    deviceId:id,operation:approved.name});
   if(logged!==true)throw Error('PARITY_LEGACY_AUDIT_UNAVAILABLE');
   approved=normalizeApprovedRemoteCall(approved);
  }
  const result=await agentCall(id,approved.name,approved.arguments);
  return reply(result?.result??result);
 });
 server.registerTool('remote_process_selftest',{
  description:'Run a fixed read-only hostname process self-test on a selected device.',
  inputSchema:{deviceId:z.string().min(1).max(64)}
 },async({deviceId})=>{
  const id=safeDevice(deviceId);
  const command=id==='windows'||id==='007windows'?WINDOWS_HOSTNAME_COMMAND:'hostname';
  const out=await agentCall(id,'start_process',{command,timeout_ms:8000});
  return reply(out?.result??out);
 });
 const parity=registerOAuthParityCore({
  server,z,principal,canExposeRemoteCall,authorizeRemoteCall,agentCall,
  auditOperation,env
 });
 return Object.freeze({server,parity,legacyNames:CANONICAL_LEGACY_TOOLS,
  devices:CANONICAL_DEVICE_IDS});
}
