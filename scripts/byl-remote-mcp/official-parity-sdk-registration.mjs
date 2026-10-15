/**
 * A4 staged registration: five read-only DC operations first, two signed-health
 * tools only after an independent, operator-verified signed Agent transport.
 *
 * Library only. This does not modify the live OAuth runtime.
 * Calls must be made by the trusted per-request OAuth server, not a client
 * tool argument; existing remote_* handlers and Operator Policy survive.
 */
import {registerParityReadTools} from './official-parity-read-tools.mjs';
import {registerParityHealthTools} from './official-parity-signed-health.mjs';
import {registerParitySessionTools} from './official-parity-session-tools.mjs';

const MODES=new Set(['core','signed-health']);
export function registerOfficialParityV1({
 server,z,principal,canExposeRemoteCall,authorizeRemoteCall,delegate,
 auditOperation,authorizeHealth,monitor,enabled=false,mode='core',
 signedAgentEvidenceVerified=false
}={}){
 if(enabled!==true)throw Error('PARITY_NOT_ACTIVATED');
 if(!MODES.has(mode))throw Error('PARITY_MODE_DENIED');
 if(principal?.kind!=='cloudflare-access'||principal.canOperate!==true)
  throw Error('PARITY_PRINCIPAL_NOT_VERIFIED');
 // Existing OAuth remote_call visibility is the upper bound of any new
 // direct-tool visibility. Both checks operate on the same server principal.
 if(typeof canExposeRemoteCall!=='function')
  throw Error('PARITY_OPERATOR_VISIBILITY_REQUIRED');
 let mayExpose=false;
 try{mayExpose=canExposeRemoteCall(principal)===true;}catch{mayExpose=false;}
 if(!mayExpose)throw Error('PARITY_OPERATOR_VISIBILITY_DENIED');
 // Preflight all requested dependencies before any registration occurs.
 if(typeof server?.registerTool!=='function'||typeof z?.enum!=='function'||
    typeof z?.string!=='function'||typeof z?.number!=='function'||
    typeof authorizeRemoteCall!=='function'||typeof delegate!=='function')
  throw Error('PARITY_REGISTRATION_INCOMPLETE');
 if(typeof auditOperation!=='function')
  throw Error('PARITY_AUDIT_SINK_REQUIRED');
 // Audit sink is server-owned, synchronous, and must acknowledge each allow.
 // Never log filenames, arguments, credentials or raw response contents.
 const audit=(decision,deviceId,name)=>{
  const result=auditOperation({
   decision,principalHash:principal.subjectHash||'unknown',
   deviceId:deviceId??null,operation:name
  });
  if(result!==true)throw Error('PARITY_AUDIT_UNAVAILABLE');
 };
 const auditedAuthorize=(p,deviceId,name,args)=>{
  let approved;
  try{approved=authorizeRemoteCall(p,deviceId,name,args);}
  catch(e){try{audit('deny',deviceId,name);}catch{}throw e;}
  audit('allow',deviceId,name);
  return approved;
 };
 const auditedHealthAuthorize=async({principal:p,deviceId,action})=>{
  let approved=false;
  try{approved=(await authorizeHealth({principal:p,deviceId,action}))===true;}catch{}
  try{audit(approved?'allow':'deny',deviceId,'health_'+action);}
  catch{return false;}
  return approved;
 };
 if(mode==='signed-health'&&(
    signedAgentEvidenceVerified!==true||
    typeof authorizeHealth!=='function'||typeof monitor?.list!=='function'||
    typeof monitor?.check!=='function'))
  throw Error('PARITY_SIGNED_HEALTH_NOT_VERIFIED');
 // Explicit per-operation Operator Policy required: never substitute
 // unvalidated remote_call or generic command execution.
 const base={server,z,principal,authorizeRemoteCall:auditedAuthorize,delegate};
 const read=registerParityReadTools(base);
 const session=registerParitySessionTools(base);
 const health=mode==='signed-health'
   ? registerParityHealthTools({server,z,principal,authorizeHealth:auditedHealthAuthorize,monitor})
   : [];
 return Object.freeze([...read,...session,...health]);
}
