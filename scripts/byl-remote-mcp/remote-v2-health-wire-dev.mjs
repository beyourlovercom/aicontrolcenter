/**
 * DC S2 — opt-in signed health wire binding, DEV CODE ONLY.
 * Reuses PR #90's fail-closed availability state model and existing Ed25519
 * verification. No network, daemon, OAuth, shell, filesystem or key enrollment.
 *
 * The service owner must independently approve and attest the trust pins.
 * A matching self-supplied fingerprint is necessary but NOT proof of trust.
 * 'send' is an externally authorized, fixed-target transport; this module
 * NEVER accepts an arbitrary URL/path, never retries, never auto-probes.
 */
import {createHash,createPublicKey} from 'node:crypto';
import {createDeviceAvailabilityAdapter} from './remote-v2-verified-availability.mjs';

export const SIGNED_HEALTH_OPERATION='AICC_SIGNED_HEALTH_CHALLENGE_V1';
const ID=/^[a-z0-9-]{2,40}$/;
const SHA=/^[a-f0-9]{64}$/;
const own=(o,k)=>Object.hasOwn(o,k);
const plain=o=>o!==null&&typeof o==='object'&&!Array.isArray(o)&&
  Object.getPrototypeOf(o)===Object.prototype;
const exact=(o,keys)=>plain(o)&&
  JSON.stringify(Object.keys(o).sort())===JSON.stringify([...keys].sort());
const deny=code=>{throw Object.assign(new Error(code),{code});};

/** Returns a *locally checked* pin; only the independent owner can approve it. */
function pinnedKey(row) {
  if(!exact(row,['publicKeyPem','spkiSha256'])||
      typeof row.publicKeyPem!=='string'||row.publicKeyPem.length>2048||
      typeof row.spkiSha256!=='string'||!SHA.test(row.spkiSha256))
    deny('TRUST_PIN_FORMAT_INVALID');
  let key;
  try{key=createPublicKey(row.publicKeyPem);}
  catch{deny('TRUST_PUBLIC_KEY_INVALID');}
  if(key.type!=='public'||key.asymmetricKeyType!=='ed25519')
    deny('ED25519_PUBLIC_KEY_REQUIRED');
  const actual=createHash('sha256').update(key.export({format:'der',type:'spki'})).digest('hex');
  if(actual!==row.spkiSha256)deny('TRUST_PIN_MISMATCH');
  return key;
}

/**
 * registry: fixed device IDs only; no endpoints/addresses supplied by callers.
 * trustPins: only keys independently provisioned by a trusted owner/admin.
 * send: owner-managed transport accepting the *fixed* health operation only.
 * The returned object cannot install, export, restart or invoke arbitrary tools.
 */
export function createSignedHealthWireDev({
  registry,trustPins={},send,clock=Date.now,ttlMs=15000,
  timeoutMs=2500,maxConcurrency=3,maxResponseBytes=4096
}={}) {
  if(!plain(registry)||Object.keys(registry).length===0||
     Object.keys(registry).length>25||Object.keys(registry).some(x=>!ID.test(x)))
    deny('DEVICE_REGISTRY_INVALID');
  if(!plain(trustPins)||Object.keys(trustPins).some(x=>!own(registry,x)))
    deny('UNREGISTERED_TRUST_PIN');
  if(typeof send!=='function')deny('FIXED_TARGET_TRANSPORT_REQUIRED');
  if(!Number.isSafeInteger(maxResponseBytes)||maxResponseBytes<512||
      maxResponseBytes>16384)deny('RESPONSE_CAP_INVALID');
  const publicKeys={},fingerprints=new Set();
  for(const [id,row] of Object.entries(trustPins)){
    const key=pinnedKey(row);
    if(fingerprints.has(row.spkiSha256))deny('DUPLICATE_DEVICE_TRUST_KEY');
    fingerprints.add(row.spkiSha256);
    publicKeys[id]=key;
  }
  const adapter=createDeviceAvailabilityAdapter({
    registry,publicKeys,clock,ttlMs,timeoutMs,maxConcurrency,
    transport:async({deviceId,challenge,signal})=>{
      // 'deviceId' always comes from the fixed enrolled device registry.
      if(!own(publicKeys,deviceId)||!own(registry,deviceId))
        deny('DEVICE_TRUST_NOT_ENROLLED');
      const operation=Object.freeze({
        deviceId,operation:SIGNED_HEALTH_OPERATION,
        challenge:Object.freeze({...challenge})
      });
      const response=await send(operation,{signal});
      if(!plain(response))return null;
      let encoded;
      try{encoded=JSON.stringify(response);}
      catch{return null;}
      if(typeof encoded!=='string'||
         Buffer.byteLength(encoded,'utf8')>maxResponseBytes)
        return null;
      return response;
    }
  });
  return Object.freeze({
    peek:()=>adapter.peek(),
    // Only an explicit call performs any transport operation.
    refresh:options=>adapter.refresh(options)
  });
}
