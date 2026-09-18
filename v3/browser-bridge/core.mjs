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
function exactRuntimeBinding(value){
  if(value==null)return null;
  if(typeof value!=='object')fail('BRIDGE_REQUEST_INVALID');
  const required=['projectId','repositoryIdentity','repositoryPath','branch','head'];const out={};
  for(const key of required){if(typeof value[key]!=='string'||!value[key].trim())fail('BRIDGE_REQUEST_INVALID');out[key]=value[key].trim();}
  out.projectName=typeof value.projectName==='string'&&value.projectName.trim()?value.projectName.trim():out.projectId;
  return out;
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
    instruction,
    runtimeBinding:exactRuntimeBinding(input?.runtimeBinding),
    roomId:typeof input?.roomId==='string'&&input.roomId.trim()?input.roomId.trim():null,
    workstreamId:typeof input?.workstreamId==='string'&&input.workstreamId.trim()?input.workstreamId.trim():null,
    executionProvider:input?.executionProvider||null
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
  if(binding.runtimeBinding)body.runtimeBinding=binding.runtimeBinding;
  if(binding.roomId)body.roomId=binding.roomId;
  if(binding.workstreamId)body.workstreamId=binding.workstreamId;
  if(binding.executionProvider)body.executionProvider=binding.executionProvider;
  return body;
}

export function sameConversation(expected,url){
  try{return conversationFromUrl(url).conversationId===expected;}catch{return false;}
}

export async function settleWithTimeout(promise,timeoutMs,fallback){
  if(!Number.isFinite(timeoutMs)||timeoutMs<=0)fail('BRIDGE_REQUEST_INVALID');
  let timer;
  try{
    return await Promise.race([Promise.resolve(promise),new Promise(resolve=>{timer=setTimeout(()=>resolve(fallback),timeoutMs);})]);
  }finally{if(timer)clearTimeout(timer);}
}

export function parseNextStepDecision(value){
  if(typeof value!=='string'||!value.includes('AICC_NEXT_STEP_V1'))fail('NEXT_STEP_DECISION_INVALID');
  const decision=value.match(/^AICC_DECISION:\s*(EXECUTE|STOP_GATE)\s*$/mi)?.[1]||null;
  const actionClass=value.match(/^AICC_ACTION_CLASS:\s*(CODE_CHANGE|TEST_ONLY|STOP_GATE)\s*$/mi)?.[1]||null;
  const provider=value.match(/^AICC_PROVIDER:\s*(CLAUDE_CODE|CODEX)\s*$/mi)?.[1]||null;
  const providerRoutingReason=value.match(/^AICC_PROVIDER_ROUTING_REASON:\s*(.*?)\s*$/mi)?.[1]?.trim()||'';
  const workPackage=value.match(/^AICC_WORK_PACKAGE:\s*(.*?)\s*$/mi)?.[1]?.trim()||'';
  const taskTitle=value.match(/^AICC_TASK:\s*(.*?)\s*$/mi)?.[1]?.trim()||'';
  const instruction=value.match(/AICC_INSTRUCTION_BEGIN\s*\n([\s\S]*?)\nAICC_INSTRUCTION_END/i)?.[1]||'';
  const gateReason=value.match(/^AICC_GATE_REASON:\s*(.*?)\s*$/mi)?.[1]?.trim()||'';
  if(decision==='STOP_GATE'){
    if(actionClass!=='STOP_GATE'||!gateReason||gateReason==='NONE')fail('NEXT_STEP_DECISION_INVALID');
    return {decision:'STOP_GATE',gateReason};
  }
  if(decision!=='EXECUTE'||!['CODE_CHANGE','TEST_ONLY'].includes(actionClass)||!workPackage||!taskTitle||!instruction.trim())fail('NEXT_STEP_DECISION_INVALID');
  if(!provider||!providerRoutingReason)fail('NEXT_STEP_DECISION_INVALID');
  if(workPackage.length>240||taskTitle.length>240||new TextEncoder().encode(instruction).length>60000)fail('NEXT_STEP_DECISION_INVALID');
  const forbidden=/(?:\bgit\s+merge\b|\bgh\s+pr\s+merge\b|\bmerge\s+(?:pr|pull request)\b|\bdeploy(?:ment)?\b|\bproduction\s+(?:apply|write|data|deploy)\b|(?:^|\s)--apply(?:\s|$)|\bdata\s+write\b)/i;
  const negatedConstraint=/^\s*(?:[-*]\s*)?(?:\d+[.)]\s*)?(?:do\s+not|don't|must\s+not|never|no\b)/i;
  const actionableInstruction=instruction.split(/\r?\n/).filter(line=>!negatedConstraint.test(line)).join('\n');
  if(forbidden.test(actionableInstruction))return {decision:'STOP_GATE',gateReason:'NEXT_STEP_FORBIDDEN_OPERATION'};
  return {decision:'EXECUTE',actionClass,provider,providerRoutingReason,workPackageTitle:workPackage,taskTitle,instruction};
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
