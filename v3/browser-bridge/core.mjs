export const BRIDGE_PROVIDER='chatgpt-web';
export const MAX_SUBMIT_ATTEMPTS=3;

function fail(code){const error=new Error(code);error.code=code;throw error;}
function nonEmpty(value,code){if(typeof value!=='string'||!value.trim())fail(code);return value;}

export function conversationFromUrl(value){
  let url;try{url=new URL(value);}catch{fail('BRIDGE_CONVERSATION_ID_UNAVAILABLE');}
  if(url.protocol!=='https:'||url.hostname!=='chatgpt.com')fail('BRIDGE_CONVERSATION_ID_UNAVAILABLE');
  const parts=url.pathname.split('/').filter(Boolean);
  const marker=parts.lastIndexOf('c');
  if(marker<0||!parts[marker+1])fail('BRIDGE_CONVERSATION_ID_UNAVAILABLE');
  const conversationId=decodeURIComponent(parts[marker+1]);
  if(!conversationId||conversationId.includes('/')||/\s/.test(conversationId))fail('BRIDGE_CONVERSATION_ID_UNAVAILABLE');
  return {conversationId,conversationUrl:`https://chatgpt.com${url.pathname}`};
}

export function exactInstruction(value){
  if(typeof value!=='string'||!value.trim()||new TextEncoder().encode(value).length>60000)fail('BRIDGE_REQUEST_INVALID');
  return value;
}
export function createOriginBinding(input,ids={}){
  const {conversationId,conversationUrl}=conversationFromUrl(input?.url);
  const taskId=typeof input?.taskId==='string'&&input.taskId.trim()?input.taskId.trim():null;
  const taskTitle=nonEmpty(input?.taskTitle,'BRIDGE_TASK_TITLE_REQUIRED').trim();
  const workPackageTitle=taskId?null:nonEmpty(input?.workPackageTitle,'BRIDGE_WORK_PACKAGE_TITLE_REQUIRED').trim();
  const instruction=exactInstruction(input?.instruction);
  const uuid=ids.uuid||crypto.randomUUID.bind(crypto);
  return {
    provider:BRIDGE_PROVIDER,
    requestId:uuid(),
    originTurnId:uuid(),
    conversationId,
    conversationUrl,
    taskId,
    workPackageTitle,
    taskTitle,
    instruction
  };
}

export function requestBody(binding){
  const body={
    provider:BRIDGE_PROVIDER,
    requestId:binding.requestId,
    conversationId:binding.conversationId,
    originTurnId:binding.originTurnId,
    instruction:binding.instruction
  };
  body.taskTitle=binding.taskTitle;
  if(binding.taskId)body.taskId=binding.taskId;
  else body.workPackageTitle=binding.workPackageTitle;
  return body;
}

export function sameConversation(expected,url){
  try{return conversationFromUrl(url).conversationId===expected;}catch{return false;}
}

export function parseNextStepDecision(value){
  if(typeof value!=='string'||!value.includes('AICC_NEXT_STEP_V1'))fail('NEXT_STEP_DECISION_INVALID');
  const decision=value.match(/^AICC_DECISION:\s*(EXECUTE|STOP_GATE)\s*$/mi)?.[1]||null;
  const workPackage=value.match(/^AICC_WORK_PACKAGE:\s*(.*?)\s*$/mi)?.[1]?.trim()||'';
  const taskTitle=value.match(/^AICC_TASK:\s*(.*?)\s*$/mi)?.[1]?.trim()||'';
  const instruction=value.match(/AICC_INSTRUCTION_BEGIN\s*\n([\s\S]*?)\nAICC_INSTRUCTION_END/i)?.[1]||'';
  const gateReason=value.match(/^AICC_GATE_REASON:\s*(.*?)\s*$/mi)?.[1]?.trim()||'';
  if(decision==='STOP_GATE'){
    if(!gateReason||gateReason==='NONE')fail('NEXT_STEP_DECISION_INVALID');
    return {decision:'STOP_GATE',gateReason};
  }
  if(decision!=='EXECUTE'||!workPackage||!taskTitle||!instruction.trim())fail('NEXT_STEP_DECISION_INVALID');
  if(workPackage.length>240||taskTitle.length>240||new TextEncoder().encode(instruction).length>60000)fail('NEXT_STEP_DECISION_INVALID');
  return {decision:'EXECUTE',workPackageTitle:workPackage,taskTitle,instruction};
}

export function recoveryAction(projection,ledger){
  const state=projection?.state?.deliveryState;
  if(state==='DELIVERED')return 'DONE';
  if(state==='DELIVERY_UNCERTAIN')return 'UNCERTAIN';
  if(state==='WAITING_RESULT')return 'WAIT';
  if(state==='READY')return 'CLAIM';
  if(state!=='CLAIMED')return 'WAIT';
  const claimId=projection?.state?.activeClaim?.claimId;
  if(!claimId)return 'UNCERTAIN_RECEIPT';
  if(ledger?.claimId!==claimId)return 'UNCERTAIN_RECEIPT';
  return ledger?.sendAttempted?'UNCERTAIN_RECEIPT':'ABORT_RECEIPT';
}
