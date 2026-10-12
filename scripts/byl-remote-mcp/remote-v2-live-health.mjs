/**
 * V2.1 signed-agent live health contract (pure component, NOT production-integrated).
 *
 * Registry presence means configured, never READY.
 * Caller must inject a signed, authenticated and device-bound health probe;
 * this module performs no direct HTTP requests and cannot probe arbitrary URLs.
 */
const SAFE_ERROR_CODES=new Set(['TIMEOUT','UNREACHABLE','AUTH_FAILED','MALFORMED_RESPONSE','PROBE_ERROR','CHALLENGE_EXPIRED','AGENT_DEGRADED']);
const publicReason=code=>SAFE_ERROR_CODES.has(code)?code:'PROBE_ERROR';

export function createLiveHealthMonitor({
  registry,probeDevice,clock=()=>Date.now(),ttlMs=15000,
  timeoutMs=2500,maxConcurrency=3
}={}){
  if(!registry||typeof registry!=='object'||Array.isArray(registry))
    throw Error('REGISTRY_REQUIRED');
  const devices=Object.keys(registry);
  if(!devices.length||devices.length>25||devices.some(id=>!/^[a-z0-9-]{2,40}$/.test(id)))
    throw Error('REGISTRY_INVALID');
  if(typeof probeDevice!=='function')throw Error('SIGNED_PROBE_REQUIRED');
  if(!Number.isInteger(ttlMs)||ttlMs<1||ttlMs>60000)throw Error('TTL_INVALID');
  if(!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>30000)throw Error('TIMEOUT_INVALID');
  if(!Number.isInteger(maxConcurrency)||maxConcurrency<1||maxConcurrency>8)
    throw Error('CONCURRENCY_INVALID');

  const cached=new Map();
  const pending=new Map();

  async function check(deviceId,{force=false}={}){
    if(!Object.hasOwn(registry,deviceId))throw Error('UNREGISTERED_DEVICE');
    const current=clock();
    const last=cached.get(deviceId);
    if(!force&&last&&current-last.checkedAtMs<ttlMs)
      return {...last.publicRecord,cache:'fresh'};
    if(pending.has(deviceId))return pending.get(deviceId);
    const work=(async()=>{
      const started=clock();
      const signal=new AbortController();
      let timer;
      let record;
      try{
        const timed=new Promise((_,reject)=>{
          timer=setTimeout(()=>{signal.abort();reject(Object.assign(Error('TIMEOUT'),{code:'TIMEOUT'}));},timeoutMs);
        });
        const received=await Promise.race([
          Promise.resolve().then(()=>probeDevice({
            deviceId,
            target:registry[deviceId], // caller verifies signed response and identity
            signal:signal.signal
          })),
          timed
        ]);
        if(received?.ok===true && received?.authenticated===true &&
           received?.deviceId===deviceId){
          record={state:'reachable',verified:true,reason:null};
        }else if(received?.ok===false && received?.authenticated===true &&
                 received?.deviceId===deviceId && received?.code==='AGENT_DEGRADED'){
          record={state:'degraded',verified:true,reason:'AGENT_DEGRADED'};
        }else if(received?.ok===false && ['UNREACHABLE','TIMEOUT'].includes(received?.code)){
          record={state:'unreachable',verified:false,reason:received.code};
        }else if(received?.ok===false && ['AUTH_FAILED','CHALLENGE_EXPIRED'].includes(received?.code)){
          record={state:'unknown',verified:false,reason:received.code};
        }else{
          record={state:'unknown',verified:false,reason:'MALFORMED_RESPONSE'};
        }
      }catch(error){
        const reason=publicReason(error?.code);
        record={state:'unreachable',verified:false,reason};
      }finally{
        clearTimeout(timer);
        signal.abort();
      }
      const checkedAtMs=clock();
      const publicRecord=Object.freeze({
        id:deviceId,registered:true,
        ...record,checkedAt:new Date(checkedAtMs).toISOString(),
        latencyMs:Math.max(0,Math.round(checkedAtMs-started))
      });
      cached.set(deviceId,{checkedAtMs,publicRecord});
      return {...publicRecord,cache:'refreshed'};
    })().finally(()=>pending.delete(deviceId));
    pending.set(deviceId,work);
    return work;
  }

  async function list({force=false}={}){
    const result=new Array(devices.length);
    let cursor=0;
    const workers=Array.from({length:Math.min(maxConcurrency,devices.length)},async()=>{
      while(cursor<devices.length){
        const i=cursor++;
        result[i]=await check(devices[i],{force});
      }
    });
    await Promise.all(workers);
    return result;
  }

  function peek(){
    return devices.map(id=>{
      const c=cached.get(id);
      if(!c)return {id,registered:true,state:'unknown',verified:false,reason:'NOT_CHECKED'};
      const age=Math.max(0,clock()-c.checkedAtMs);
      if(age>=ttlMs)return {...c.publicRecord,state:'unknown',verified:false,reason:'STALE',cache:'stale'};
      return {...c.publicRecord,cache:'fresh'};
    });
  }
  return Object.freeze({check,list,peek});
}
