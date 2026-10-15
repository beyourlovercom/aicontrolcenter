/**
 * Production-entrypoint integration hook CANDIDATE. NOT connected or deployed.
 *
 * This is invoked inside the existing getServer(principal) AFTER legacy
 * remote_* tools have been registered and the principal has been verified
 * by Cloudflare Access. It does not open listeners, read secrets, alter env,
 * or perform network calls until an authorized named tool is actually used.
 */
import {registerOfficialParityV1} from './official-parity-sdk-registration.mjs';
import {createParityAgentDelegate} from './official-parity-agent-delegate.mjs';

export const PARITY_CORE_FLAG='BYL_MCP_PARITY_CORE_READ_ENABLED';
const DISABLED=Object.freeze({enabled:false,names:Object.freeze([]),reason:'NOT_ENABLED'});
const NOT_AUTHORIZED=Object.freeze({enabled:false,names:Object.freeze([]),reason:'NOT_AUTHORIZED'});
export function registerOAuthParityCore({
 server,z,principal,canExposeRemoteCall,authorizeRemoteCall,agentCall,
 auditOperation,env={},enabledFlag=PARITY_CORE_FLAG
}={}){
 // Never let the tool caller supply env or enabledFlag: these parameters
 // are for trusted server composition only. No mutation and no health tools.
 if(env?.[PARITY_CORE_FLAG]!=='1')return DISABLED;
 if(enabledFlag!==PARITY_CORE_FLAG)
  throw Error('PARITY_FLAG_NOT_CANONICAL');
 if(!env||typeof env!=='object'||Array.isArray(env))
  throw Error('PARITY_FLAG_CONFIG_DENIED');
 // Keep legacy read/list MCP operations available to nonoperators, even
 // when this feature flag is ON for approved Owner sessions. An unauthorized
 // principal is never a reason to fail a legitimate older MCP session.
 if(principal?.kind!=='cloudflare-access'||principal.canOperate!==true)
  return NOT_AUTHORIZED;
 if(typeof canExposeRemoteCall!=='function')
  throw Error('PARITY_OPERATOR_VISIBILITY_REQUIRED');
 let mayExpose=false;
 try{mayExpose=canExposeRemoteCall(principal)===true;}catch{mayExpose=false;}
 if(!mayExpose)return NOT_AUTHORIZED;
 if(typeof agentCall!=='function')throw Error('PARITY_AGENT_TRANSPORT_REQUIRED');
 const delegate=createParityAgentDelegate({agentCall});
 const names=registerOfficialParityV1({
  server,z,principal,canExposeRemoteCall,authorizeRemoteCall,delegate,
  auditOperation,enabled:true,mode:'core'
 });
 return Object.freeze({enabled:true,names,reason:null});
}
