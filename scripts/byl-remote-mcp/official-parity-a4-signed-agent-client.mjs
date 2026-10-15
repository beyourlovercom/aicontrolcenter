/**
 * Credential-free gateway Agent transport (A4.1 source candidate).
 * No environment access, network call or secret load at import/constructor.
 *
 * Runtime owner injects 4 fixed targets and an Ed25519 private-key object from
 * private storage. No target, key, raw upstream error or response is logged.
 * Caller STILL must enforce trusted OAuth Operator Policy per operation.
 */
import {createHash,createPrivateKey,sign} from 'node:crypto';
import {CANONICAL_DEVICE_IDS} from './official-parity-oauth-runtime-surface.mjs';

function allowedTarget(raw){
 if(typeof raw!=='string'||raw.length>128)throw Error('PARITY_TARGET_INVALID');
 let url;
 try{url=new URL(raw);}catch{throw Error('PARITY_TARGET_INVALID');}
 if(url.protocol!=='http:'||url.username||url.password||url.search||
    url.hash||url.pathname!=='/'||url.port!=='8791')
  throw Error('PARITY_TARGET_INVALID');
 const parts=url.hostname.split('.').map(Number);
 if(parts.length!==4||parts.some(p=>!Number.isInteger(p)||p<0||p>255))
  throw Error('PARITY_TARGET_INVALID');
 const [a,b]=parts;
 const privateIP=a===10||(a===172&&b>=16&&b<=31)||
   (a===192&&b===168)||(a===100&&b>=64&&b<=127)||
   (a===127&&b===0);
 if(!privateIP)throw Error('PARITY_TARGET_INVALID');
 return url;
}
export function createCredentialFreeSignedAgentClient({
 targets,signingKey,fetchImpl,clock=Date.now,signalTimeout=ms=>AbortSignal.timeout(ms),
 maxResponseChars=65536
}={}){
 if(!targets||typeof targets!=='object'||Array.isArray(targets)||
    Object.keys(targets).length!==4||
    CANONICAL_DEVICE_IDS.some(id=>!Object.hasOwn(targets,id)))
  throw Error('PARITY_TARGET_REGISTRY_INVALID');
 const urls=Object.freeze(Object.fromEntries(
  CANONICAL_DEVICE_IDS.map(id=>[id,allowedTarget(targets[id])])
 ));
 if(typeof fetchImpl!=='function'||typeof clock!=='function'||
    typeof signalTimeout!=='function'||!Number.isInteger(maxResponseChars)||
    maxResponseChars<1||maxResponseChars>65536)
  throw Error('PARITY_TRANSPORT_DEPENDENCY_INVALID');
 let key;
 try{
  key=signingKey?.type==='private'&&signingKey?.asymmetricKeyType==='ed25519'
   ? signingKey:createPrivateKey(signingKey);
 }catch{throw Error('PARITY_PRIVATE_KEY_REQUIRED');}
 if(key.asymmetricKeyType!=='ed25519')
  throw Error('PARITY_SIGNING_KEY_TYPE_INVALID');
 async function request(deviceId,path,body,method,timeoutMs){
  if(!Object.hasOwn(urls,deviceId))throw Error('DEVICE_UNKNOWN');
  const stamp=String(clock());
  if(!/^[0-9]{13}$/.test(stamp))throw Error('PARITY_CLOCK_INVALID');
  const bytes=Buffer.from(body);
  const digest=createHash('sha256').update(bytes).digest('hex');
  const canonical=method+'\n'+path+'\n'+stamp+'\n'+digest;
  const signature=sign(null,Buffer.from(canonical),key).toString('base64');
  const headers={
   'content-type':'application/json',
   'x-byl-timestamp':stamp,'x-byl-signature':signature
  };
  let reply;
  try{
   reply=await fetchImpl(new URL(path,urls[deviceId]),{
    method,headers,body:method==='POST'?bytes:undefined,
    signal:signalTimeout(timeoutMs)
   });
  }catch{throw Error('PARITY_AGENT_UNREACHABLE');}
  if(!reply?.ok)throw Error('PARITY_AGENT_REQUEST_FAILED');
  const length=Number(reply.headers?.get?.('content-length'));
  if(Number.isFinite(length)&&length>maxResponseChars)
   throw Error('PARITY_AGENT_RESPONSE_INVALID');
  let response;
  try{response=await reply.text();}
  catch{throw Error('PARITY_AGENT_RESPONSE_INVALID');}
  if(typeof response!=='string'||response.length>maxResponseChars)
   throw Error('PARITY_AGENT_RESPONSE_INVALID');
  try{return JSON.parse(response);}
  catch{throw Error('PARITY_AGENT_RESPONSE_INVALID');}
 }
 return Object.freeze({
  async agentGet(deviceId,path){
   if(path!=='/v1/tools')throw Error('PARITY_AGENT_PATH_DENIED');
   return request(deviceId,path,'','GET',10000);
  },
  async agentCall(deviceId,name,args={}){
   if(typeof name!=='string'||!/^[a-z][a-z0-9_]{0,63}$/.test(name)||
      !args||typeof args!=='object'||Array.isArray(args))
    throw Error('PARITY_AGENT_ARGUMENTS_DENIED');
   const body=JSON.stringify({name,arguments:args});
   if(body.length>65536)throw Error('PARITY_AGENT_ARGUMENTS_DENIED');
   return request(deviceId,'/v1/call',body,'POST',30000);
  }
 });
}
