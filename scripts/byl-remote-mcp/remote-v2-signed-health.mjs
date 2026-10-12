/**
 * Remote DC V2.1 — device-bound signed health proof (isolated library).
 * No network, process, Cloudflare, Tailscale or filesystem side effects.
 * Integrators supply fixed-target transport; public keys must be pinned,
 * never accepted from a response.
 */
import {randomBytes,sign,verify,createPublicKey} from 'node:crypto';

export const HEALTH_PROTOCOL='BYL-DC-HEALTH-V1';
const ID=/^[a-z0-9-]{2,40}$/;
const NONCE=/^[a-f0-9]{48}$/;
const SIG=/^[A-Za-z0-9+/]{86}==$/;
const MAX_LIFETIME_MS=10000;
const MAX_FUTURE_MS=1500;
const keys=(v,expected)=>v&&typeof v==='object'&&!Array.isArray(v)&&
  Object.keys(v).sort().join(',')===expected.slice().sort().join(',');
const isInt=v=>Number.isSafeInteger(v)&&v>0;

function canonical({protocol,deviceId,nonce,checkedAtMs,status}){
  return Buffer.from([protocol,deviceId,nonce,String(checkedAtMs),status].join('\n'),'utf8');
}
export function createHealthChallenge(deviceId,{clock=Date.now,nonceSource=()=>randomBytes(24).toString('hex')}={}){
  if(!ID.test(deviceId))throw Error('DEVICE_ID_INVALID');
  const nonce=nonceSource(),issuedAtMs=clock();
  if(!NONCE.test(nonce)||!isInt(issuedAtMs))throw Error('CHALLENGE_INVALID');
  return Object.freeze({protocol:HEALTH_PROTOCOL,deviceId,nonce,issuedAtMs});
}
function validChallenge(challenge){
  return keys(challenge,['protocol','deviceId','nonce','issuedAtMs'])&&
    challenge.protocol===HEALTH_PROTOCOL&&ID.test(challenge.deviceId)&&
    NONCE.test(challenge.nonce)&&isInt(challenge.issuedAtMs);
}
/**
 * Agent-side signing helper; requires a private Ed25519 key in memory.
 * Never serialize private keys in the response; only ready or degraded.
 */
export function signHealthResponse(challenge,{privateKey,clock=Date.now,status='ready'}={}){
  if(!validChallenge(challenge))throw Error('CHALLENGE_INVALID');
  if(!['ready','degraded'].includes(status))throw Error('STATUS_INVALID');
  if(privateKey?.asymmetricKeyType!=='ed25519'||privateKey?.type!=='private')
    throw Error('ED25519_PRIVATE_KEY_REQUIRED');
  const checkedAtMs=clock();
  if(!isInt(checkedAtMs))throw Error('CLOCK_INVALID');
  const payload={protocol:HEALTH_PROTOCOL,deviceId:challenge.deviceId,
    nonce:challenge.nonce,checkedAtMs,status};
  const signature=sign(null,canonical(payload),privateKey).toString('base64');
  return Object.freeze({...payload,signature});
}

/** Verification failures are represented only by bounded safe error codes. */
export function verifyHealthResponse(challenge,response,{publicKey,clock=Date.now}={}){
  if(!validChallenge(challenge))throw Error('CHALLENGE_INVALID');
  if(!keys(response,['protocol','deviceId','nonce','checkedAtMs','status','signature'])||
    response.protocol!==HEALTH_PROTOCOL||response.deviceId!==challenge.deviceId||
    response.nonce!==challenge.nonce||!isInt(response.checkedAtMs)||
    !['ready','degraded'].includes(response.status)||
    typeof response.signature!=='string'||!SIG.test(response.signature))
    return {ok:false,code:'MALFORMED_RESPONSE'};
  const now=clock();
  if(!isInt(now)||now<challenge.issuedAtMs-MAX_FUTURE_MS||
    now-challenge.issuedAtMs>MAX_LIFETIME_MS||
    response.checkedAtMs<challenge.issuedAtMs-MAX_FUTURE_MS||
    response.checkedAtMs>now+MAX_FUTURE_MS||
    response.checkedAtMs-challenge.issuedAtMs>MAX_LIFETIME_MS)
    return {ok:false,code:'CHALLENGE_EXPIRED'};
  try{
    const parsed=publicKey?.type==='public'?publicKey:createPublicKey(publicKey);
    if(parsed.type!=='public'||parsed.asymmetricKeyType!=='ed25519')return {ok:false,code:'AUTH_FAILED'};
    const valid=verify(null,canonical(response),parsed,Buffer.from(response.signature,'base64'));
    if(!valid)return {ok:false,code:'AUTH_FAILED'};
  }catch{return {ok:false,code:'AUTH_FAILED'};}
  if(response.status==='degraded')
    return {ok:false,authenticated:true,deviceId:challenge.deviceId,code:'AGENT_DEGRADED'};
  return {ok:true,authenticated:true,deviceId:challenge.deviceId};
}

/**
 * Plug into createLiveHealthMonitor({probeDevice}); transport must target
 * a fixed registry device ID, not arbitrary URLs. Never log its headers.
 */
export function createSignedDeviceProbe({transport,publicKeys,clock=Date.now,nonceSource}={}){
  if(typeof transport!=='function'||!publicKeys||typeof publicKeys!=='object')
    throw Error('SIGNED_PROBE_CONFIG_REQUIRED');
  return async({deviceId,signal})=>{
    if(!Object.hasOwn(publicKeys,deviceId))return {ok:false,code:'AUTH_FAILED'};
    const challenge=createHealthChallenge(deviceId,{clock,nonceSource});
    let response;
    try{
      response=await transport({deviceId,challenge,signal});
    }catch(error){
      if(signal?.aborted)return {ok:false,code:'TIMEOUT'};
      return {ok:false,code:'UNREACHABLE'};
    }
    return verifyHealthResponse(challenge,response,{publicKey:publicKeys[deviceId],clock});
  };
}
