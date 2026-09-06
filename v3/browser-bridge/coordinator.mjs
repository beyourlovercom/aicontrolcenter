import {createOriginBinding,MAX_SUBMIT_ATTEMPTS,recoveryAction,requestBody} from './core.mjs';

const REQUESTS_KEY='aiccBridgeRequestsV1';
const INSTANCE_KEY='aiccBridgeInstanceIdV1';

function fail(code){const error=new Error(code);error.code=code;throw error;}
function nowIso(clock){return (clock?.now||(()=>new Date().toISOString()))();}

export function createCoordinator(deps={}){
  const storage=deps.storage;
  const api=deps.api;
  const destination=deps.destination;
  const ids=deps.ids||{};
  const clock=deps.clock||{};
  if(!storage||!api||!destination)throw new Error('BRIDGE_CLIENT_DEPENDENCY_MISSING');

  async function requestMap(){return (await storage.get(REQUESTS_KEY))||{};}
  async function saveMap(map){await storage.set(REQUESTS_KEY,map);return map;}
  async function getLedger(requestId){return (await requestMap())[requestId]||null;}
  async function putLedger(ledger){const map=await requestMap();map[ledger.requestId]=ledger;await saveMap(map);return ledger;}

  async function instanceId(){
    let value=await storage.get(INSTANCE_KEY);
    if(value)return value;
    value=(ids.uuid||crypto.randomUUID.bind(crypto))();
    await storage.set(INSTANCE_KEY,value);return value;
  }
  async function submitExisting(ledger){
    if(ledger.submitAttempts>=MAX_SUBMIT_ATTEMPTS)fail('BRIDGE_SUBMIT_RETRY_EXHAUSTED');
    ledger={...ledger,submitAttempts:ledger.submitAttempts+1,status:'SUBMITTING',updatedAt:nowIso(clock)};
    await putLedger(ledger);
    try{
      const response=await api.createRequest(requestBody(ledger));
      ledger={...ledger,status:'WAITING_RESULT',runId:response?.request?.runId||response?.run?.runId||ledger.runId||null,lastError:null,updatedAt:nowIso(clock)};
      await putLedger(ledger);return {ledger,response};
    }catch(error){
      ledger={...ledger,status:ledger.submitAttempts>=MAX_SUBMIT_ATTEMPTS?'SUBMIT_FAILED':'SUBMIT_PENDING',lastError:error?.code||'BRIDGE_SUBMIT_FAILED',updatedAt:nowIso(clock)};
      await putLedger(ledger);throw error;
    }
  }

  async function enqueueAction(input){
    const binding=createOriginBinding(input,ids);
    const ledger={...binding,tabId:input.tabId??null,status:'SUBMIT_PENDING',submitAttempts:0,runId:null,claimId:null,sendAttempted:false,pendingReceipt:null,createdAt:nowIso(clock),updatedAt:nowIso(clock)};
    await putLedger(ledger);
    return {ledger};
  }
  async function submitAction(input){
    const queued=await enqueueAction(input);
    return submitExisting(queued.ledger);
  }

  async function queueReceipt(ledger,receipt){
    ledger={...ledger,pendingReceipt:receipt,updatedAt:nowIso(clock)};
    await putLedger(ledger);
    try{
      const response=await api.receipt(ledger.requestId,receipt);
      const state=response?.state?.deliveryState;
      const status=state==='DELIVERED'?'DELIVERED':state==='DELIVERY_UNCERTAIN'?'DELIVERY_UNCERTAIN':state==='READY'?'WAITING_RESULT':ledger.status;
      ledger={...ledger,status,pendingReceipt:null,claimId:state==='READY'?null:ledger.claimId,sendAttempted:state==='READY'?false:ledger.sendAttempted,updatedAt:nowIso(clock)};
      await putLedger(ledger);return {ledger,response};
    }catch(error){
      ledger={...ledger,lastError:error?.code||'BRIDGE_RECEIPT_TRANSPORT_FAILED',updatedAt:nowIso(clock)};
      await putLedger(ledger);throw error;
    }
  }
  async function flushPendingReceipt(ledger){
    if(!ledger.pendingReceipt)return {ledger,flushed:false};
    const result=await queueReceipt(ledger,ledger.pendingReceipt);
    return {...result,flushed:true};
  }

  async function claimAndDeliver(ledger){
    const bridgeInstanceId=await instanceId();
    const claimed=await api.claim(ledger.requestId,{bridgeInstanceId});
    const claim=claimed?.claim;const delivery=claimed?.delivery;
    if(!claim?.claimId||!delivery?.deliveryId)fail('BRIDGE_CLIENT_CLAIM_INVALID');
    ledger={...ledger,status:'CLAIMED',claimId:claim.claimId,deliveryId:delivery.deliveryId,sendAttempted:false,pendingReceipt:null,updatedAt:nowIso(clock)};
    await putLedger(ledger);

    ledger={...ledger,sendAttempted:true,updatedAt:nowIso(clock)};
    await putLedger(ledger);
    let outcome;
    try{
      outcome=await destination.deliver({tabId:ledger.tabId,conversationId:delivery.conversationId,conversationUrl:ledger.conversationUrl,content:delivery.content,contentSha256:delivery.contentSha256});
    }catch{outcome={outcome:'UNCERTAIN'};}

    if(outcome?.outcome==='DELIVERED'){
      const receipt={claimId:claim.claimId,outcome:'DELIVERED',conversationId:delivery.conversationId,contentSha256:delivery.contentSha256};
      if(outcome.providerMessageId)receipt.providerMessageId=outcome.providerMessageId;
      return queueReceipt(ledger,receipt);
    }
    if(outcome?.outcome==='ABORTED_BEFORE_SEND')return queueReceipt(ledger,{claimId:claim.claimId,outcome:'ABORTED_BEFORE_SEND'});
    return queueReceipt(ledger,{claimId:claim.claimId,outcome:'UNCERTAIN'});
  }

  async function reconcileClaimed(ledger,projection){
    const action=recoveryAction(projection,ledger);
    if(action==='ABORT_RECEIPT')return queueReceipt(ledger,{claimId:projection.state.activeClaim.claimId,outcome:'ABORTED_BEFORE_SEND'});
    if(action==='UNCERTAIN_RECEIPT')return queueReceipt(ledger,{claimId:projection.state.activeClaim.claimId,outcome:'UNCERTAIN'});
    return {ledger,projection};
  }
  async function pollOne(requestId){
    let ledger=await getLedger(requestId);if(!ledger)return null;
    if(ledger.pendingReceipt){const flushed=await flushPendingReceipt(ledger);ledger=flushed.ledger;if(flushed.flushed)return flushed;}
    if(ledger.status==='SUBMIT_PENDING'||ledger.status==='SUBMITTING')return submitExisting(ledger);
    if(['SUBMIT_FAILED','RUN_FAILED','DELIVERED','DELIVERY_UNCERTAIN'].includes(ledger.status))return {ledger};

    const projection=await api.getRequest(requestId);
    if(projection?.run&&['EXITED','SPAWN_ERROR','ORPHANED','STOPPED'].includes(projection.run.state)&&!projection.delivery){
      ledger={...ledger,status:'RUN_FAILED',lastError:'BRIDGE_RUN_FAILED',runId:projection.run.runId||ledger.runId,updatedAt:nowIso(clock)};
      await putLedger(ledger);return {ledger,projection};
    }
    const action=recoveryAction(projection,ledger);
    if(action==='DONE'){
      ledger={...ledger,status:'DELIVERED',updatedAt:nowIso(clock)};await putLedger(ledger);return {ledger,projection};
    }
    if(action==='UNCERTAIN'){
      ledger={...ledger,status:'DELIVERY_UNCERTAIN',updatedAt:nowIso(clock)};await putLedger(ledger);return {ledger,projection};
    }
    if(action==='CLAIM')return claimAndDeliver(ledger);
    if(action==='ABORT_RECEIPT'||action==='UNCERTAIN_RECEIPT')return reconcileClaimed(ledger,projection);
    return {ledger,projection};
  }

  async function pollAll(){
    const map=await requestMap();const results=[];
    for(const requestId of Object.keys(map)){
      try{results.push(await pollOne(requestId));}catch(error){results.push({requestId,errorCode:error?.code||'BRIDGE_CLIENT_POLL_FAILED'});}
    }
    return results;
  }

  async function ledgers(){return Object.values(await requestMap());}

  return {enqueueAction,submitAction,pollOne,pollAll,ledgers,getLedger,instanceId};
}
