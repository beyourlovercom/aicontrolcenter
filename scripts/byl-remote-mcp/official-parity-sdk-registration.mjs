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
 server,z,principal,authorizeRemoteCall,delegate,
 authorizeHealth,monitor,enabled=false,mode='core',
 signedAgentEvidenceVerified=false
}={}){
 if(enabled!==true)throw Error('PARITY_NOT_ACTIVATED');
 if(!MODES.has(mode))throw Error('PARITY_MODE_DENIED');
 if(principal?.kind!=='cloudflare-access'||principal.canOperate!==true)
  throw Error('PARITY_PRINCIPAL_NOT_VERIFIED');
 // Preflight all requested dependencies before any registration occurs.
 if(typeof server?.registerTool!=='function'||typeof z?.enum!=='function'||
    typeof z?.string!=='function'||typeof z?.number!=='function'||
    typeof authorizeRemoteCall!=='function'||typeof delegate!=='function')
  throw Error('PARITY_REGISTRATION_INCOMPLETE');
 if(mode==='signed-health'&&(
    signedAgentEvidenceVerified!==true||
    typeof authorizeHealth!=='function'||typeof monitor?.list!=='function'||
    typeof monitor?.check!=='function'))
  throw Error('PARITY_SIGNED_HEALTH_NOT_VERIFIED');
 // Explicit per-operation Operator Policy required: never substitute
 // unvalidated remote_call or generic command execution.
 const base={server,z,principal,authorizeRemoteCall,delegate};
 const read=registerParityReadTools(base);
 const session=registerParitySessionTools(base);
 const health=mode==='signed-health'
   ? registerParityHealthTools({server,z,principal,authorizeHealth,monitor})
   : [];
 return Object.freeze([...read,...session,...health]);
}
