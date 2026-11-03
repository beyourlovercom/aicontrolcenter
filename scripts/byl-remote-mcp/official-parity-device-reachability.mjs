/**
 * BYL DC S2 — bounded, cached, read-only transport reachability.
 * A successful signed Agent /v1/tools request shows current endpoint
 * reachability. It is NOT an independently signed Agent health attestation.
 * Never infer READY from registration alone or report unverified as verified.
 * No raw Agent payload, URL, credential, traceback or network metadata escapes.
 */
const DEVICES=Object.freeze(['us-macmini','china-mac','windows','007windows']);
const NAME=/^[a-z][a-z0-9_]{0,63}$/;
const deny=code=>{throw Error(code);};

export function createDeviceReachabilityView({
 agentGet,clock=Date.now,ttlMs=15000
}={}){
 if(typeof agentGet!=='function'||typeof clock!=='function'||
    !Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>60000)
  deny('DEVICE_REACHABILITY_DEPENDENCY_INVALID');
 const cache=new Map(),pending=new Map();
 const unknown=id=>Object.freeze({
  id,registered:true,state:'unknown',verified:false,
  reason:'NOT_CHECKED',checkedAt:null,probe:'not_performed'
 });
 async function check(id){
  const now=clock();
  const existing=cache.get(id);
  if(existing && now<existing.expiresAt)return existing.record;
  if(pending.has(id))return pending.get(id);
  const request=(async()=>{
   let ok=false;
   try{
    // Existing server-owned signed fixed-target Agent transport:
    // /v1/tools is allowed; there are no caller-supplied paths or targets.
    const result=await agentGet(id,'/v1/tools');
    const tools=result?.tools;
    ok=Array.isArray(tools)&&tools.length>0&&tools.length<=128&&
       tools.every(t=>t&&typeof t==='object'&&
        typeof t.name==='string'&&NAME.test(t.name))&&
       new Set(tools.map(t=>t.name)).size===tools.length;
   }catch{ok=false;}
   const checked=clock();
   const record=Object.freeze({
    id,registered:true,state:ok?'reachable':'unreachable',
    verified:false,reason:ok?'AGENT_TOOLS_RESPONDED':'AGENT_PROBE_FAILED',
    checkedAt:new Date(checked).toISOString(),
    probe:'SIGNED_REQUEST_NOT_HEALTH_ATTESTED'
   });
   cache.set(id,{expiresAt:checked+ttlMs,record});
   return record;
  })().finally(()=>pending.delete(id));
  pending.set(id,request);
  return request;
 }
 return Object.freeze({
  list:()=>Promise.all(DEVICES.map(check)),
  peek:()=>DEVICES.map(id=>cache.get(id)?.record??unknown(id))
 });
}
