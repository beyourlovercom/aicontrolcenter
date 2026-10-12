// Agent-side isolated authenticated health handler, no HTTP listener or runtime wiring.
// Existing Gateway auth and fixed peer ACL MUST succeed before invoking this handler.
import {signHealthResponse} from './remote-v2-signed-health.mjs';
export function createAgentHealthHandler({deviceId,privateKey,clock=Date.now,authenticatedPeer}={}) {
  if(!['us-macmini','china-mac','windows'].includes(deviceId) ||
     privateKey?.type!=='private' || privateKey?.asymmetricKeyType!=='ed25519' ||
     typeof authenticatedPeer!=='function') throw Error('AGENT_HEALTH_CONFIG_INVALID');
  return ({challenge,peerContext}={})=>{
    if(authenticatedPeer(peerContext)!==true) return {ok:false,code:'PEER_DENIED'};
    if(!challenge || challenge.deviceId!==deviceId) return {ok:false,code:'DEVICE_MISMATCH'};
    try {
      return signHealthResponse(challenge,{privateKey,clock,status:'ready'});
    } catch {
      return {ok:false,code:'INVALID_CHALLENGE'};
    }
  };
}
