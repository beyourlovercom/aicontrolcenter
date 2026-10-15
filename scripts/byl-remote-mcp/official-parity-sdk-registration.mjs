/**
 * Composition point for explicit read-only DC Official Parity tools.
 * Does not replace existing remote_* MCP tool registrations and cannot
 * enable mutating tools. Never import/use from live OAuth without its
 * separately authorized source-parity, rollout, and application review.
 */
import {registerParityReadTools} from './official-parity-read-tools.mjs';
import {registerParityHealthTools} from './official-parity-signed-health.mjs';
import {registerParitySessionTools} from './official-parity-session-tools.mjs';

export function registerOfficialParityV1({
 server,z,principal,authorizeRemoteCall,delegate,
 authorizeHealth,monitor,enabled=false
}={}){
 if(enabled!==true)throw Error('PARITY_NOT_ACTIVATED');
 if(principal?.kind!=='cloudflare-access'||principal.canOperate!==true)
  throw Error('PARITY_PRINCIPAL_NOT_VERIFIED');
 // Reject incomplete configuration BEFORE registering any name.
 if(typeof server?.registerTool!=='function'||typeof z?.enum!=='function'||
    typeof z?.string!=='function'||typeof z?.number!=='function'||
    typeof authorizeRemoteCall!=='function'||typeof delegate!=='function'||
    typeof authorizeHealth!=='function'||typeof monitor?.list!=='function'||
    typeof monitor?.check!=='function')
  throw Error('PARITY_REGISTRATION_INCOMPLETE');
 // Same session-scoped server as existing read-only handler registrations.
 // The caller must preserve existing remote_* tools and policy.
 const base={server,z,principal,authorizeRemoteCall,delegate};
 const read=registerParityReadTools(base);
 const session=registerParitySessionTools(base);
 const health=registerParityHealthTools({server,z,principal,authorizeHealth,monitor});
 return Object.freeze([...read,...session,...health]);
}
