import {createHash,randomUUID} from 'node:crypto';
import {readRun} from './run-store.mjs';
import {readOrMaterializeResult} from './result-store.mjs';
import {createTask,createWorkPackage,readWorkStore} from './work-store.mjs';
import {startRun} from './executor-runtime.mjs';
import {appendBridgeEvent,createBridgeRequest,createDelivery,createReceipt,listBridgeRequestIds,readBridgeRequest,readBridgeState,readDelivery,readReceipt,sha256,updateBridgeState} from './bridge-store.mjs';

function fail(code,detail=''){const error=new Error(detail?`${code}: ${detail}`:code);error.code=code;throw error;}
function text(value,code,max=4096){if(typeof value!=='string'||!value.trim()||value.length>max)fail(code);return value;}
function uuid(value){if(typeof value!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value))fail('BRIDGE_REQUEST_INVALID');return value;}
function exactInstruction(value){if(typeof value!=='string'||!value.trim()||Buffer.byteLength(value,'utf8')>60000)fail('BRIDGE_REQUEST_INVALID');return value;}
function existingTaskBinding(context,taskId,env){
  const store=readWorkStore(context,env);const task=store.tasks.find(item=>item.id===taskId);if(!task)fail('BRIDGE_TASK_NOT_FOUND');
  const wp=store.workPackages.find(item=>item.id===task.workPackageId);if(!wp)fail('BRIDGE_TASK_NOT_FOUND');return {task,wp};
}
function derivedUuid(requestId,label){
  const chars=createHash('sha256').update(requestId).update('\0').update(label).digest('hex').slice(0,32).split('');
  chars[12]='5';chars[16]=['8','9','a','b'][parseInt(chars[16],16)%4];const hex=chars.join('');
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}
function automaticTaskBinding(context,input,env,options={}){
  const requestId=uuid(input?.requestId);
  const workPackageTitle=text(input?.workPackageTitle,'BRIDGE_WORK_PACKAGE_TITLE_REQUIRED',240);
  const taskTitle=text(input?.taskTitle,'BRIDGE_TASK_TITLE_REQUIRED',240);
  const workPackageId=derivedUuid(requestId,'work-package');const taskId=derivedUuid(requestId,'task');
  let store=readWorkStore(context,env);let wp=store.workPackages.find(item=>item.id===workPackageId);
  if(wp&&wp.title!==workPackageTitle)fail('BRIDGE_REQUEST_CONFLICT');
  if(!wp)wp=createWorkPackage(context,{title:workPackageTitle,status:'ACTIVE'},env,{uuid:()=>workPackageId,now:options.now}).workPackage;
  store=readWorkStore(context,env);let task=store.tasks.find(item=>item.id===taskId);
  if(task&&(task.workPackageId!==wp.id||task.title!==taskTitle))fail('BRIDGE_REQUEST_CONFLICT');
  if(!task)task=createTask(context,{workPackageId:wp.id,title:taskTitle,status:'TODO'},env,{uuid:()=>taskId,now:options.now}).task;
  return {task,wp};
}
function taskBinding(context,input,env,options={}){
  if(typeof input?.taskId==='string'&&input.taskId.trim())return existingTaskBinding(context,input.taskId.trim(),env);
  return automaticTaskBinding(context,input,env,options);
}
function requestCandidate(context,input,binding,runId,now){
  const instruction=exactInstruction(input.instruction);
  return {schema:'aicc.v3.bridge-request.v1',requestId:uuid(input.requestId),provider:input.provider,conversationId:text(input.conversationId,'BRIDGE_CONVERSATION_ID_UNAVAILABLE'),originTurnId:text(input.originTurnId,'BRIDGE_ORIGIN_TURN_ID_REQUIRED'),taskId:binding.task.id,workPackageId:binding.wp.id,instructionSha256:sha256(instruction),runId,projectId:context.project.id,repositoryIdentity:context.repository.identity,repositoryPath:context.repository.path,createdAt:now()};
}
function sameBinding(existing,input,binding,instructionHash){
  return existing.provider===input.provider&&existing.conversationId===input.conversationId&&existing.originTurnId===input.originTurnId&&existing.taskId===binding.task.id&&existing.workPackageId===binding.wp.id&&existing.instructionSha256===instructionHash;
}
function startExactRun(context,request,instruction,env,options){
  try{return (options.startRun||startRun)(context,{taskId:request.taskId,instruction},env,{...(options.executorOptions||{}),uuid:()=>request.runId});}
  catch(error){if(error?.code==='RUN_TASK_NOT_FOUND')fail('BRIDGE_TASK_NOT_FOUND');const next=new Error('BRIDGE_RUN_BINDING_FAILED');next.code='BRIDGE_RUN_BINDING_FAILED';next.causeCode=error?.code||null;throw next;}
}
export function submitBridgeRequest(context,input,env=process.env,options={}){
  if(input?.provider!=='chatgpt-web')fail('BRIDGE_REQUEST_INVALID');uuid(input?.requestId);const instruction=exactInstruction(input?.instruction);const binding=taskBinding(context,input,env,options);
  let request;let created=false;
  try{request=readBridgeRequest(context,input.requestId,env);}catch(error){if(error?.code!=='BRIDGE_REQUEST_INVALID')throw error;}
  if(request){if(!sameBinding(request,input,binding,sha256(instruction)))fail('BRIDGE_REQUEST_CONFLICT');}
  else{
    request=requestCandidate(context,input,binding,(options.runUuid||randomUUID)(),options.now||(()=>new Date().toISOString()));
    createBridgeRequest(context,request,env);appendBridgeEvent(context,request.requestId,'REQUEST_CREATED',{taskId:request.taskId,runId:request.runId},env,options);created=true;
  }
  let run;try{run=readRun(context,request.runId,env);}catch(error){if(error?.code!=='RUN_NOT_FOUND')throw error;}
  if(!run){
    try{run=startExactRun(context,request,instruction,env,options);appendBridgeEvent(context,request.requestId,'RUN_BOUND',{runId:run.runId},env,options);}
    catch(error){appendBridgeEvent(context,request.requestId,'RUN_BINDING_FAILED',{errorCode:error?.code||'BRIDGE_RUN_BINDING_FAILED'},env,options);throw error;}
  }
  return {created,request,run,state:readBridgeState(context,request.requestId,env)};
}
function materializeDelivery(context,request,env,options={}){
  let result;try{result=readOrMaterializeResult(context,request.runId,env,options.resultOptions||{});}catch(error){
    if(['RESULT_NOT_FOUND','RESULT_NOT_READY','RESULT_SOURCE_NOT_FOUND'].includes(error?.code))fail('BRIDGE_RESULT_NOT_READY');
    if(String(error?.code||'').startsWith('RESULT_'))fail('BRIDGE_RUN_BINDING_FAILED');throw error;
  }
  if(result.runId!==request.runId||result.taskId!==request.taskId||result.workPackageId!==request.workPackageId)fail('BRIDGE_RUN_BINDING_FAILED');
  const delivery={schema:'aicc.v3.bridge-delivery.v1',deliveryId:`delivery:${request.requestId}:${result.resultId}`,requestId:request.requestId,conversationId:request.conversationId,originTurnId:request.originTurnId,taskId:request.taskId,workPackageId:request.workPackageId,runId:request.runId,resultId:result.resultId,contentSha256:result.contentSha256,content:result.content,createdAt:(options.now||(()=>new Date().toISOString()))()};
  let existing;try{existing=readDelivery(context,request.requestId,env);}catch(error){if(error?.code!=='BRIDGE_DELIVERY_NOT_FOUND')throw error;}
  const saved=existing||createDelivery(context,request.requestId,delivery,env);
  if(saved.content!==result.content||saved.contentSha256!==result.contentSha256||saved.resultId!==result.resultId)fail('BRIDGE_RUN_BINDING_FAILED');
  const state=readBridgeState(context,request.requestId,env);
  if(state.deliveryState==='WAITING_RESULT'){
    updateBridgeState(context,request.requestId,{deliveryState:'READY'},env,options);
    appendBridgeEvent(context,request.requestId,'DELIVERY_READY',{deliveryId:saved.deliveryId,resultId:saved.resultId},env,options);
  }
  return saved;
}
export function bridgeProjection(context,requestId,env=process.env,options={}){
  const request=readBridgeRequest(context,requestId,env);let run=null;try{run=readRun(context,request.runId,env);}catch(error){if(error?.code!=='RUN_NOT_FOUND')throw error;}
  let delivery=null;if(run){try{delivery=materializeDelivery(context,request,env,options);}catch(error){if(error?.code!=='BRIDGE_RESULT_NOT_READY')throw error;}}
  return {schema:'aicc.v3.bridge-projection.v1',request,run,state:readBridgeState(context,requestId,env),delivery,receipt:readReceipt(context,requestId,env)};
}
export function claimBridgeDelivery(context,requestId,input,env=process.env,options={}){
  const bridgeInstanceId=text(input?.bridgeInstanceId,'BRIDGE_REQUEST_INVALID');const projection=bridgeProjection(context,requestId,env,options);
  if(!projection.delivery)fail('BRIDGE_RESULT_NOT_READY');const state=projection.state;
  if(state.deliveryState==='DELIVERED')fail('BRIDGE_DELIVERY_ALREADY_DELIVERED');
  if(state.deliveryState==='DELIVERY_UNCERTAIN')fail('BRIDGE_DELIVERY_UNCERTAIN');
  if(state.deliveryState==='CLAIMED')fail('BRIDGE_DELIVERY_ALREADY_CLAIMED');
  if(state.claimAttempts>=3)fail('BRIDGE_RETRY_EXHAUSTED');
  if(state.deliveryState!=='READY')fail('BRIDGE_RESULT_NOT_READY');
  const attempt=state.claimAttempts+1;const claim={claimId:(options.claimUuid||randomUUID)(),bridgeInstanceId,claimedAt:(options.now||(()=>new Date().toISOString()))(),attempt};
  const next=updateBridgeState(context,requestId,{deliveryState:'CLAIMED',claimAttempts:attempt,safePreSendRetryCount:Math.max(0,attempt-1),activeClaim:claim},env,options);
  appendBridgeEvent(context,requestId,'DELIVERY_CLAIMED',{deliveryId:projection.delivery.deliveryId,claimId:claim.claimId,bridgeInstanceId,attempt},env,options);
  return {request:projection.request,delivery:projection.delivery,claim,state:next};
}
function terminalReceipt(request,delivery,claim,outcome,input,now){
  const receipt={schema:'aicc.v3.bridge-receipt.v1',requestId:request.requestId,deliveryId:delivery.deliveryId,claimId:claim.claimId,outcome,createdAt:now()};
  if(outcome==='DELIVERED'){
    if(input?.conversationId!==delivery.conversationId||input?.contentSha256!==delivery.contentSha256)fail('BRIDGE_RECEIPT_MISMATCH');
    receipt.conversationId=input.conversationId;receipt.contentSha256=input.contentSha256;
    if(input.providerMessageId!=null){if(typeof input.providerMessageId!=='string'||!input.providerMessageId)fail('BRIDGE_RECEIPT_MISMATCH');receipt.providerMessageId=input.providerMessageId;}
  }
  return receipt;
}
export function recordBridgeReceipt(context,requestId,input,env=process.env,options={}){
  const projection=bridgeProjection(context,requestId,env,options);const state=projection.state;
  if(['DELIVERED','DELIVERY_UNCERTAIN'].includes(state.deliveryState)){
    const existing=projection.receipt;
    if(existing&&input?.claimId===existing.claimId&&input?.outcome===existing.outcome&&input?.conversationId===existing.conversationId&&input?.contentSha256===existing.contentSha256&&(input?.providerMessageId??null)===(existing.providerMessageId??null))return {receipt:existing,state};
    if(state.deliveryState==='DELIVERY_UNCERTAIN'&&!existing)fail('BRIDGE_DELIVERY_UNCERTAIN');
    fail('BRIDGE_RECEIPT_MISMATCH');
  }
  if(state.deliveryState==='READY'&&input?.outcome==='ABORTED_BEFORE_SEND'&&state.lastAbortedClaimId===input?.claimId)return {receipt:null,state};
  if(state.deliveryState!=='CLAIMED'||!state.activeClaim||input?.claimId!==state.activeClaim.claimId)fail('BRIDGE_RECEIPT_MISMATCH');
  if(!projection.delivery)fail('BRIDGE_DELIVERY_NOT_FOUND');const outcome=input?.outcome;
  if(outcome==='ABORTED_BEFORE_SEND'){
    const next=updateBridgeState(context,requestId,{deliveryState:'READY',activeClaim:null,lastAbortedClaimId:state.activeClaim.claimId},env,options);
    appendBridgeEvent(context,requestId,'DELIVERY_ABORTED_BEFORE_SEND',{claimId:state.activeClaim.claimId,attempt:state.activeClaim.attempt},env,options);
    return {receipt:null,state:next};
  }
  if(!['DELIVERED','UNCERTAIN'].includes(outcome))fail('BRIDGE_RECEIPT_MISMATCH');
  const receipt=terminalReceipt(projection.request,projection.delivery,state.activeClaim,outcome,input,options.now||(()=>new Date().toISOString()));
  const saved=createReceipt(context,requestId,receipt,env);const terminal=outcome==='DELIVERED'?'DELIVERED':'DELIVERY_UNCERTAIN';
  const next=updateBridgeState(context,requestId,{deliveryState:terminal,activeClaim:null},env,options);
  appendBridgeEvent(context,requestId,outcome==='DELIVERED'?'DELIVERY_DELIVERED':'DELIVERY_UNCERTAIN',{claimId:saved.claimId,deliveryId:saved.deliveryId},env,options);
  return {receipt:saved,state:next};
}
export function reconcileBridgeStartup(context,env=process.env,options={}){
  const reconciled=[];
  for(const requestId of listBridgeRequestIds(context,env)){
    try{
      const state=readBridgeState(context,requestId,env);if(state.deliveryState!=='CLAIMED')continue;
      const receipt=readReceipt(context,requestId,env);
      if(receipt){
        const terminal=receipt.outcome==='DELIVERED'?'DELIVERED':'DELIVERY_UNCERTAIN';
        updateBridgeState(context,requestId,{deliveryState:terminal,activeClaim:null},env,options);reconciled.push({requestId,state:terminal});continue;
      }
      updateBridgeState(context,requestId,{deliveryState:'DELIVERY_UNCERTAIN',activeClaim:null},env,options);
      appendBridgeEvent(context,requestId,'RESTART_DELIVERY_UNCERTAIN',{reason:'CLAIMED_WITHOUT_TERMINAL_RECEIPT'},env,options);
      reconciled.push({requestId,state:'DELIVERY_UNCERTAIN'});
    }catch{continue;}
  }
  return reconciled;
}
