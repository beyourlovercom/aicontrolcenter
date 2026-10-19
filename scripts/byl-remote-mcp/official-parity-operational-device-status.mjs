/**
 * G1 — truthful operational device status, without Apple Developer/Team ID.
 * Read-only control-plane signal from the pre-existing authenticated Agent
 * GET /v1/tools transport. This is NOT an Ed25519 Agent health proof.
 *
 * The service owner must explicitly opt into this observer and separately
 * authorize any live Gateway rollout. No Agent install/restart/secret load.
 */
const DEVICES=Object.freeze(['us-macmini','china-mac','windows','007windows']);
const GOOD=/^[a-z][a-z0-9_]{0,63}$/;
const ALLOWED_STATES=new Set(['OPERABLE','UNREACHABLE','UNKNOWN']);
function fail(message){throw Error(message);}
function frozen(record){return Object.freeze(record);}
export function registeredOnlyDeviceList(){
  return DEVICES.map(id=>frozen({
    id,registered:true,state:'REGISTERED',controlPlane:'UNKNOWN',
    signedHealth:'NOT_VERIFIED',toolCount:null,reason:'NOT_CHECKED',
    observedAtMs:null
  }));
}
export function createOperationalDeviceStatusReader({
  agentGet,clock=Date.now,ttlMs=10000,timeoutMs=3500
}={}){
  if(typeof agentGet!=='function'||typeof clock!=='function')
    fail('DEVICE_STATUS_DEPENDENCIES_REQUIRED');
  if(!Number.isSafeInteger(ttlMs)||ttlMs<1000||ttlMs>60000||
     !Number.isSafeInteger(timeoutMs)||timeoutMs<100||timeoutMs>10000)
    fail('DEVICE_STATUS_LIMIT_INVALID');
  const cache=new Map(),inflight=new Map();
  async function probe(id){
    const now=clock();
    if(!Number.isSafeInteger(now)||now<=0)fail('DEVICE_STATUS_CLOCK_INVALID');
    const remembered=cache.get(id);
    if(remembered&&remembered.expiresAtMs>now)return remembered.value;
    if(inflight.has(id))return inflight.get(id);
    let timer;
    const pending=(async()=>{
      let status='UNKNOWN',reason='UNVERIFIED_RESPONSE',count=null;
      try{
        const reply=await Promise.race([
          Promise.resolve().then(()=>agentGet(id,'/v1/tools')),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('PROBE_TIMEOUT')),timeoutMs);})
        ]);
        // Only the authenticated existing fixed-target tool inventory qualifies
        // as OPERABLE; HTTP 200/true/empty object/Agent error never qualifies.
        const tools=reply?.tools;
        if(Array.isArray(tools)&&tools.length<=200&&
           tools.every(tool=>tool&&typeof tool.name==='string'&&
              GOOD.test(tool.name))){
          status='OPERABLE';reason=null;count=tools.length;
        }
      }catch(error){
        if(error?.message==='PARITY_AGENT_UNREACHABLE'){
          status='UNREACHABLE';reason='AGENT_TOOL_TRANSPORT_UNREACHABLE';
        }else if(error?.message==='PROBE_TIMEOUT'){
          reason='PROBE_TIMEOUT';
        }else{
          reason='TOOL_PROBE_NOT_VERIFIED';
        }
      }finally{clearTimeout(timer);}
      const observedAtMs=clock();
      const value=frozen({
        id,registered:true,state:status,controlPlane:status,
        signedHealth:'NOT_VERIFIED',toolCount:count,reason,observedAtMs
      });
      cache.set(id,{expiresAtMs:observedAtMs+ttlMs,value});
      return value;
    })();
    inflight.set(id,pending);
    try{return await pending;}finally{inflight.delete(id);}
  }
  return Object.freeze({
    async list(){
      // At most two new reads concurrently. Four fixed devices only.
      const results=[];
      for(let i=0;i<DEVICES.length;i+=2){
        const items=await Promise.all(DEVICES.slice(i,i+2).map(probe));
        results.push(...items);
      }
      return Object.freeze(results);
    },
    peek(){
      const now=clock();
      return DEVICES.map(id=>{
        const cached=cache.get(id);
        return cached&&cached.expiresAtMs>now?cached.value:
          frozen({...registeredOnlyDeviceList().find(x=>x.id===id),
            state:'UNKNOWN',reason:'NOT_CHECKED_OR_EXPIRED'});
      });
    },
    staticIds:DEVICES
  });
}
