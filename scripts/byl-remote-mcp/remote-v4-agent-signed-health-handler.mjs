/**
 * S4 isolated Agent-side signed-health handler: NOT installed or deployable.
 * Designed for an owner-approved Agent release, using existing Ed25519 protocol.
 * No server socket, private key loading, filesystem, process or network access.
 *
 * Caller MUST inject a real Gateway-authentication verifier and an actual
 * service-owned local-readiness measurement; this component cannot attest that
 * either dependency is genuine merely because a function was provided.
 */
import {signHealthResponse,HEALTH_PROTOCOL} from './remote-v2-signed-health.mjs';
export const SIGNED_HEALTH_ACTION='AICC_SIGNED_HEALTH_CHALLENGE_V1';
const DEVICE=/^[a-z0-9-]{2,40}$/;
const NONCE=/^[0-9a-f]{48}$/;
const MAX_CHALLENGE_BYTES=2048;
const MAX_AGE_MS=10000;
const MAX_FUTURE_MS=1500;
const deny=code=>{throw Object.assign(Error(code),{code});};
const exact=(o,properties)=>o!==null&&typeof o==='object'&&
  !Array.isArray(o)&&Object.getPrototypeOf(o)===Object.prototype&&
  JSON.stringify(Object.keys(o).sort())===JSON.stringify([...properties].sort());

export function createAgentSignedHealthHandler({
  deviceId,signingPrivateKey,authenticateGateway,measureLocalState,
  clock=Date.now,maxReplayEntries=1024,timeoutMs=2500
}={}) {
  if(typeof deviceId!=='string'||!DEVICE.test(deviceId))
    deny('DEVICE_ID_INVALID');
  if(signingPrivateKey?.type!=='private'||
     signingPrivateKey.asymmetricKeyType!=='ed25519')
    deny('ED25519_SIGNING_KEY_REQUIRED');
  if(typeof authenticateGateway!=='function')deny('GATEWAY_AUTH_VERIFIER_REQUIRED');
  if(typeof measureLocalState!=='function')deny('LOCAL_HEALTH_MEASUREMENT_REQUIRED');
  if(typeof clock!=='function')deny('CLOCK_REQUIRED');
  if(!Number.isSafeInteger(maxReplayEntries)||maxReplayEntries<1||
     maxReplayEntries>10000)deny('REPLAY_BUDGET_INVALID');
  if(!Number.isSafeInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)
    deny('TIMEOUT_INVALID');

  // This volatile single-process nonce cache is NOT a cross-restart ledger.
  // A separately approved service/runtime must guarantee one active instance
  // or provide an atomic, authenticated, shared replay store.
  const seen=new Map();
  function cleanup(now) {
    for(const [nonce,at] of seen)
      if(now-at>MAX_AGE_MS+MAX_FUTURE_MS)seen.delete(nonce);
  }
  function validate(req,now) {
    if(!exact(req,['operation','challenge','authContext'])||
       req.operation!==SIGNED_HEALTH_ACTION)
      deny('OPERATION_INVALID');
    const c=req.challenge;
    if(!exact(c,['protocol','deviceId','nonce','issuedAtMs'])||
       c.protocol!==HEALTH_PROTOCOL||c.deviceId!==deviceId||
       typeof c.nonce!=='string'||!NONCE.test(c.nonce)||
       !Number.isSafeInteger(c.issuedAtMs)||c.issuedAtMs<=0)
      deny('CHALLENGE_INVALID');
    if(Buffer.byteLength(JSON.stringify({
      operation:req.operation,challenge:c}),'utf8')>MAX_CHALLENGE_BYTES)
      deny('CHALLENGE_SIZE_EXCEEDED');
    if(c.issuedAtMs>now+MAX_FUTURE_MS||now-c.issuedAtMs>MAX_AGE_MS)
      deny('CHALLENGE_EXPIRED');
    return c;
  }
  async function handle(request,{signal}={}) {
    if(signal?.aborted)deny('REQUEST_ABORTED');
    let timer;
    const controller=new AbortController();
    const onAbort=()=>controller.abort();
    signal?.addEventListener?.('abort',onAbort,{once:true});
    try {
      const work=async()=>{
        const now=clock();
        if(!Number.isSafeInteger(now)||now<=0)deny('CLOCK_INVALID');
        const challenge=validate(request,now);
        // Only the approved service's gateway verifier can accept identity.
        // Mere "authContext" presence, selftest hostname or HTTP 200 is not auth.
        const permitted=await authenticateGateway({
          authContext:request.authContext,
          deviceId,operation:SIGNED_HEALTH_ACTION,signal:controller.signal
        });
        if(permitted!==true)deny('GATEWAY_AUTH_DENIED');
        const at=clock();
        if(at-challenge.issuedAtMs>MAX_AGE_MS||
           challenge.issuedAtMs>at+MAX_FUTURE_MS)
          deny('CHALLENGE_EXPIRED');
        cleanup(at);
        if(seen.has(challenge.nonce))deny('REPLAY_DENIED');
        if(seen.size>=maxReplayEntries)deny('REPLAY_CACHE_FULL');
        // Record before any await, closing parallel/reentrant replay race.
        seen.set(challenge.nonce,at);
        // Owner-authorized service must supply a genuine local measurement.
        // No static READY fallback and no "success by default".
        const status=await measureLocalState({deviceId,signal:controller.signal});
        if(!['ready','degraded'].includes(status))deny('LOCAL_HEALTH_UNPROVEN');
        if(controller.signal.aborted)deny('REQUEST_ABORTED');
        if(clock()-challenge.issuedAtMs>MAX_AGE_MS)
          deny('CHALLENGE_EXPIRED');
        return signHealthResponse(challenge,{
          privateKey:signingPrivateKey,status,clock
        });
      };
      const limited=new Promise((_,reject)=>{
        timer=setTimeout(()=>{
          controller.abort();
          reject(Object.assign(Error('HANDLER_TIMEOUT'),{code:'HANDLER_TIMEOUT'}));
        },timeoutMs);
      });
      return await Promise.race([work().catch(e=>{
        // Never send raw identity claims, tokens, call stacks or probe errors.
        const code=typeof e?.code==='string'&&[
          'GATEWAY_AUTH_DENIED','CHALLENGE_INVALID','OPERATION_INVALID',
          'CHALLENGE_EXPIRED','CHALLENGE_SIZE_EXCEEDED','REPLAY_DENIED',
          'REPLAY_CACHE_FULL','LOCAL_HEALTH_UNPROVEN','REQUEST_ABORTED'
        ].includes(e.code)?e.code:'SIGNED_HEALTH_REFUSED';
        deny(code);
      }),limited]);
    }finally{
      clearTimeout(timer);
      controller.abort();
      signal?.removeEventListener?.('abort',onAbort);
    }
  }
  return Object.freeze({handle});
}
