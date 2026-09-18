import {conversationFromUrl,parseNextStepDecision,sameConversation,settleWithTimeout} from './core.mjs';
import {createCoordinator} from './coordinator.mjs';

const BASE='http://127.0.0.1:1420';
const TOKEN_KEY='aiccBridgeTokenV1';
const ALARM='aicc-v3-bridge-poll';
const NEXT_STEP_PLAN_TIMEOUT_MS=135000;

try{void chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});}catch{}

const storage={
  async get(key){const value=await chrome.storage.local.get(key);return value[key];},
  async set(key,value){await chrome.storage.local.set({[key]:value});}
};

async function token(){
  const value=await storage.get(TOKEN_KEY);
  if(typeof value!=='string'||value.length<32){const error=new Error('BRIDGE_AUTH_REQUIRED');error.code='BRIDGE_AUTH_REQUIRED';throw error;}
  return value;
}

async function request(path,{method='GET',body,auth=true,overrideToken,timeout=5000}={}){
  const headers={};if(body!==undefined)headers['content-type']='application/json';
  if(auth)headers['x-aicc-bridge-token']=overrideToken||await token();
  const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),timeout);
  let response;
  try{response=await fetch(`${BASE}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:controller.signal});}
  catch{const error=new Error('BRIDGE_AICC_UNREACHABLE');error.code='BRIDGE_AICC_UNREACHABLE';throw error;}
  finally{clearTimeout(timer);}
  let value={};try{value=await response.json();}catch{}
  if(!response.ok){const error=new Error(value.errorCode||`HTTP_${response.status}`);error.code=value.errorCode||`HTTP_${response.status}`;error.status=response.status;throw error;}
  return value;
}
const api={
  async createRequest(body){return request('/api/bridge/requests',{method:'POST',body,timeout:30000});},
  async getRequest(requestId){return (await request(`/api/bridge/requests/${encodeURIComponent(requestId)}`)).bridge;},
  async claim(requestId,body){return request(`/api/bridge/requests/${encodeURIComponent(requestId)}/claim`,{method:'POST',body});},
  async receipt(requestId,body){return request(`/api/bridge/requests/${encodeURIComponent(requestId)}/receipt`,{method:'POST',body});},
  async publishSnapshot(body){return request('/api/bridge/snapshots',{method:'POST',body,timeout:10000});},
  async claimNextStep(body){return (await request('/api/bridge/next-step/claim',{method:'POST',body,timeout:10000})).claimed;},
  async nextStepReceipt(requestId,body){return request(`/api/bridge/next-step/${encodeURIComponent(requestId)}/receipt`,{method:'POST',body,timeout:10000});},
  async claimHumanChat(body){return (await request('/api/bridge/chat/claim',{method:'POST',body,timeout:10000})).claimed;},
  async humanChatReceipt(requestId,body){return request(`/api/bridge/chat/${encodeURIComponent(requestId)}/receipt`,{method:'POST',body,timeout:10000});}
};

async function waitTabComplete(tabId,timeout=15000){
  const current=await chrome.tabs.get(tabId);if(current.status==='complete')return current;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(listener);reject(new Error('BRIDGE_TAB_LOAD_TIMEOUT'));},timeout);
    function listener(id,info,tab){if(id===tabId&&info.status==='complete'){clearTimeout(timer);chrome.tabs.onUpdated.removeListener(listener);resolve(tab);}}
    chrome.tabs.onUpdated.addListener(listener);
  });
}
async function installContentAdapter(tabId){
  await chrome.scripting.executeScript({target:{tabId},func:()=>{try{globalThis.__AICC_V3_BRIDGE_CLEANUP__?.();}catch{}try{delete globalThis.__AICC_V3_BRIDGE_CONTENT_VERSION__;}catch{}try{delete globalThis.__AICC_V3_BRIDGE_CLEANUP__;}catch{}}});
  await chrome.scripting.executeScript({target:{tabId},files:['composer-text.js','content.js']});
}

async function exactConversationTab(input){
  if(Number.isInteger(input.tabId)){
    try{
      let tab=await chrome.tabs.get(input.tabId);
      if(sameConversation(input.conversationId,tab.url||''))return {tab,ephemeral:false};
    }catch{}
  }
  const tabs=await chrome.tabs.query({url:'https://chatgpt.com/*'});
  const exact=tabs.find(tab=>sameConversation(input.conversationId,tab.url||''));
  if(exact)return {tab:exact,ephemeral:false};
  const created=await chrome.tabs.create({url:input.conversationUrl,active:false});
  const loaded=await waitTabComplete(created.id);
  if(!sameConversation(input.conversationId,loaded.url||'')){try{await chrome.tabs.remove(created.id);}catch{}throw new Error('BRIDGE_CONVERSATION_MISMATCH');}
  return {tab:loaded,ephemeral:true};
}

async function existingConversationTab(input){
  if(Number.isInteger(input.tabId)){
    try{const tab=await chrome.tabs.get(input.tabId);if(sameConversation(input.conversationId,tab.url||''))return tab;}catch{}
  }
  const tabs=await chrome.tabs.query({url:'https://chatgpt.com/*'});return tabs.find(tab=>sameConversation(input.conversationId,tab.url||''))||null;
}
async function ensureHumanConversationTab(input){
  const existing=await existingConversationTab(input);if(existing)return existing;
  const created=await chrome.tabs.create({url:input.conversationUrl,active:false});
  const loaded=await waitTabComplete(created.id);
  if(!sameConversation(input.conversationId,loaded.url||'')){try{await chrome.tabs.remove(created.id);}catch{}throw new Error('BRIDGE_CONVERSATION_MISMATCH');}
  await installContentAdapter(loaded.id);
  return loaded;
}
const PLANNER_CONVERSATIONS_KEY='aiccPlannerConversationsV1';
const plannerTabIds=new Set();
async function waitConversationTab(tabId,timeout=20000){
  const end=Date.now()+timeout;
  while(Date.now()<end){try{const tab=await chrome.tabs.get(tabId);if(sameConversationSafe(tab.url||''))return tab;}catch{}await new Promise(resolve=>setTimeout(resolve,200));}
  return null;
}
async function waitPlannerDecision(tabId,afterMessageId,timeout=120000){
  const end=Date.now()+timeout;
  while(Date.now()<end){
    try{const response=await chrome.tabs.sendMessage(tabId,{type:'AICC_READ_PLANNER_DECISION',afterMessageId});if(response?.outcome==='DELIVERED'&&typeof response.assistantText==='string')return response;}catch{}
    await new Promise(resolve=>setTimeout(resolve,500));
  }
  return {outcome:'UNCERTAIN',reason:'NEXT_STEP_GPT_DECISION_UNPROVEN'};
}
const planningDestination={
  async plan(input){
    const map=(await storage.get(PLANNER_CONVERSATIONS_KEY))||{};
    const startUrl=typeof map[input.roomId]==='string'?map[input.roomId]:'https://chatgpt.com/';
    let tab;
    try{
      tab=await chrome.tabs.create({url:startUrl,active:false});plannerTabIds.add(tab.id);tab=await waitTabComplete(tab.id);
      await installContentAdapter(tab.id);
      let submitted=await chrome.tabs.sendMessage(tab.id,{type:'AICC_SUBMIT_TRANSIENT',content:input.prompt,contentSha256:input.promptSha256});
      if(submitted?.outcome==='ABORTED_BEFORE_SEND'&&['BRIDGE_COMPOSER_NOT_FOUND','BRIDGE_SEND_CONTROL_NOT_FOUND'].includes(submitted.reason)){
        const siblings=await chrome.tabs.query({windowId:tab.windowId});const previous=siblings.find(item=>item.active&&item.id!==tab.id)||null;
        try{
          await chrome.tabs.update(tab.id,{active:true});await new Promise(resolve=>setTimeout(resolve,900));await installContentAdapter(tab.id);
          submitted=await chrome.tabs.sendMessage(tab.id,{type:'AICC_SUBMIT_TRANSIENT',content:input.prompt,contentSha256:input.promptSha256});
        }finally{if(Number.isInteger(previous?.id))try{await chrome.tabs.update(previous.id,{active:true});}catch{}}
      }
      if(submitted?.outcome==='ABORTED_BEFORE_SEND')return submitted;
      if(submitted?.outcome!=='SUBMITTED')return {outcome:'UNCERTAIN',reason:submitted?.reason||'NEXT_STEP_PLAN_SUBMIT_UNCERTAIN'};
      let conversationTab=await waitConversationTab(tab.id);if(!conversationTab)return {outcome:'UNCERTAIN',reason:'NEXT_STEP_PLANNER_CONVERSATION_UNAVAILABLE'};
      const identity=conversationFromUrl(conversationTab.url);map[input.roomId]=conversationTab.url;await storage.set(PLANNER_CONVERSATIONS_KEY,map);
      if(conversationTab.status!=='complete')conversationTab=await waitTabComplete(tab.id);
      await installContentAdapter(tab.id);
      const response=await settleWithTimeout(waitPlannerDecision(tab.id,submitted.beforeAssistantId??null,120000),NEXT_STEP_PLAN_TIMEOUT_MS,{outcome:'UNCERTAIN',reason:'NEXT_STEP_PLAN_TRANSPORT_TIMEOUT'});
      if(response?.outcome!=='DELIVERED')return response;
      return {...response,conversationId:identity.conversationId,conversationUrl:conversationTab.url};
    }catch(error){
      const value=String(error?.message||error||'');
      if(value.includes('Receiving end does not exist')||value.includes('Could not establish connection'))return {outcome:'ABORTED_BEFORE_SEND',reason:'NEXT_STEP_CONTENT_SCRIPT_UNAVAILABLE'};
      return {outcome:'UNCERTAIN',reason:'NEXT_STEP_PLAN_TRANSPORT_UNCERTAIN'};
    }finally{if(Number.isInteger(tab?.id)){plannerTabIds.delete(tab.id);try{await chrome.tabs.remove(tab.id);}catch{}}}
  }
};

const destination={
  async deliver(input){
    let resolved;try{resolved=await exactConversationTab(input);}catch{return {outcome:'ABORTED_BEFORE_SEND'};}
    const {tab,ephemeral}=resolved;if(!sameConversation(input.conversationId,tab.url||''))return {outcome:'ABORTED_BEFORE_SEND'};
    try{
      const response=await chrome.tabs.sendMessage(tab.id,{type:'AICC_DELIVER_EXACT',conversationId:input.conversationId,content:input.content,contentSha256:input.contentSha256});
      if(response?.outcome==='DELIVERED')return response;
      if(response?.outcome==='ABORTED_BEFORE_SEND')return response;
      return {outcome:'UNCERTAIN'};
    }catch(error){
      const text=String(error?.message||error||'');
      if(text.includes('Receiving end does not exist')||text.includes('Could not establish connection'))return {outcome:'ABORTED_BEFORE_SEND'};
      return {outcome:'UNCERTAIN'};
    }finally{if(ephemeral)try{await chrome.tabs.remove(tab.id);}catch{}}
  }
};

const coordinator=createCoordinator({storage,api,destination});

async function readTabSnapshot(tab){
  if(!Number.isInteger(tab?.id)||plannerTabIds.has(tab.id)||!sameConversationSafe(tab.url||''))return null;
  try{
    const response=await chrome.tabs.sendMessage(tab.id,{type:'AICC_READ_SNAPSHOT'});
    if(!response?.ok||!response.snapshot)return null;
    const identity=conversationFromUrl(tab.url);
    if(response.snapshot.conversationId!==identity.conversationId)return null;
    return {...response.snapshot,tabId:tab.id};
  }catch{return null;}
}
async function publishTabSnapshot(tab){
  const snapshot=await readTabSnapshot(tab);
  if(!snapshot||!Array.isArray(snapshot.messages)||snapshot.messages.length===0)return null;
  return api.publishSnapshot(snapshot);
}
function sameConversationSafe(url){try{conversationFromUrl(url);return true;}catch{return false;}}
async function snapshotOpenChatgptTabs(){
  let tabs=[];try{tabs=await chrome.tabs.query({url:'https://chatgpt.com/*'});}catch{return [];}
  const conversations=tabs.filter(tab=>sameConversationSafe(tab.url||''));
  const snapshots=(await Promise.all(conversations.map(tab=>readTabSnapshot(tab)))).filter(snapshot=>Array.isArray(snapshot?.messages)&&snapshot.messages.length>0);
  const best=new Map();
  for(const snapshot of snapshots){const current=best.get(snapshot.conversationId);if(!current||snapshot.messages.length>current.messages.length||snapshot.messages.length===current.messages.length&&snapshot.capturedAt>current.capturedAt)best.set(snapshot.conversationId,snapshot);}
  return Promise.all([...best.values()].map(snapshot=>api.publishSnapshot(snapshot)));
}

async function listTasks(){
  const value=await request('/api/work',{auth:false});
  return value?.store?.tasks||[];
}

async function testPairing(candidate){
  if(typeof candidate!=='string'||candidate.length<32)throw new Error('BRIDGE_AUTH_REQUIRED');
  try{
    await request('/api/bridge/requests/00000000-0000-4000-8000-000000000000',{overrideToken:candidate});
  }catch(error){
    if(error?.status===401||error?.code==='BRIDGE_AUTH_REQUIRED')throw error;
  }
  return true;
}

async function savePairing(candidate){
  await testPairing(candidate);
  await storage.set(TOKEN_KEY,candidate);
  await coordinator.instanceId();
  return {paired:true};
}
async function autoPair(){
  const existing=await storage.get(TOKEN_KEY);if(typeof existing==='string'&&existing.length>=32)return {paired:true};
  const value=await request('/api/bridge/bootstrap',{method:'POST',auth:false});
  if(typeof value?.token!=='string'||value.token.length<32)throw Object.assign(new Error('BRIDGE_AUTH_REQUIRED'),{code:'BRIDGE_AUTH_REQUIRED'});
  return savePairing(value.token);
}
const NEXT_STEP_RECEIPTS_KEY='aiccNextStepReceiptsV1';
const NEXT_STEP_MAX_CONCURRENCY=4;
let nextStepReceiptMutation=Promise.resolve();
async function nextStepReceiptMap(){
  const value=await storage.get(NEXT_STEP_RECEIPTS_KEY);
  return value||{};
}
async function persistNextStepReceipt(requestId,body){
  const task=nextStepReceiptMutation.then(async()=>{const map=await nextStepReceiptMap();map[requestId]=body;await storage.set(NEXT_STEP_RECEIPTS_KEY,map);return body;});
  nextStepReceiptMutation=task.catch(()=>{});return task;
}
async function flushNextStepReceipts(){
  const task=nextStepReceiptMutation.then(async()=>{
    const map=await nextStepReceiptMap();let changed=false;
    for(const [requestId,body] of Object.entries(map)){
      try{await api.nextStepReceipt(requestId,body);delete map[requestId];changed=true;}catch{}
    }
    if(changed)await storage.set(NEXT_STEP_RECEIPTS_KEY,map);
  });
  nextStepReceiptMutation=task.catch(()=>{});return task;
}
async function finishNextStep(requestId,body){
  await persistNextStepReceipt(requestId,body);
  await flushNextStepReceipts();
}
const humanChatInFlight=new Set();let humanChatClaimLoopRunning=false;
async function processHumanChatClaim(claimed){
  const requestValue=claimed.request;const claimId=claimed.state.claim.claimId;const requestId=requestValue.requestId;
  try{
    const tab=await ensureHumanConversationTab(requestValue);
    let result;
    try{
      await installContentAdapter(tab.id);
      result=await chrome.tabs.sendMessage(tab.id,{type:'AICC_DELIVER_EXACT',conversationId:requestValue.conversationId,content:requestValue.content,contentSha256:requestValue.contentSha256});
    }
    catch{result={outcome:'UNCERTAIN',reason:'HUMAN_CHAT_DELIVERY_UNCERTAIN'};}
    if(result?.outcome==='DELIVERED')await api.humanChatReceipt(requestId,{claimId,outcome:'DELIVERED'});
    else if(result?.outcome==='ABORTED_BEFORE_SEND')await api.humanChatReceipt(requestId,{claimId,outcome:'ABORTED_BEFORE_SEND',errorCode:result.reason||'HUMAN_CHAT_ABORTED_BEFORE_SEND'});
    else await api.humanChatReceipt(requestId,{claimId,outcome:'UNCERTAIN',errorCode:result?.reason||'HUMAN_CHAT_DELIVERY_UNCERTAIN'});
  }catch{try{await api.humanChatReceipt(requestId,{claimId,outcome:'UNCERTAIN',errorCode:'HUMAN_CHAT_PROCESSING_UNCERTAIN'});}catch{}}
  finally{humanChatInFlight.delete(requestId);}
}
async function pollHumanChat(){
  if(humanChatClaimLoopRunning)return;humanChatClaimLoopRunning=true;
  try{
    const bridgeInstanceId=await coordinator.instanceId();const jobs=[];
    while(humanChatInFlight.size<NEXT_STEP_MAX_CONCURRENCY){const claimed=await api.claimHumanChat({bridgeInstanceId});if(!claimed?.request||!claimed?.state?.claim)break;const id=claimed.request.requestId;if(humanChatInFlight.has(id))break;humanChatInFlight.add(id);jobs.push(processHumanChatClaim(claimed));}
    await Promise.all(jobs);
  }catch{}finally{humanChatClaimLoopRunning=false;}
}
const nextStepInFlight=new Set();let nextStepClaimLoopRunning=false;
async function processNextStepClaim(claimed){
  const requestValue=claimed.request;const claimId=claimed.state.claim.claimId;const requestId=requestValue.requestId;
  try{
    const planned=await planningDestination.plan(requestValue);
    if(planned?.outcome==='ABORTED_BEFORE_SEND'){await finishNextStep(requestId,{claimId,outcome:'ABORTED_BEFORE_SEND',errorCode:planned.reason||'NEXT_STEP_ABORTED_BEFORE_SEND'});return;}
    if(planned?.outcome!=='DELIVERED'||typeof planned.assistantText!=='string'){await finishNextStep(requestId,{claimId,outcome:'UNCERTAIN',errorCode:planned?.reason||'NEXT_STEP_DECISION_UNCERTAIN'});return;}
    let decision;try{decision=parseNextStepDecision(planned.assistantText);}catch{await finishNextStep(requestId,{claimId,outcome:'UNCERTAIN',errorCode:'NEXT_STEP_DECISION_INVALID'});return;}
    if(decision.decision==='STOP_GATE'){await finishNextStep(requestId,{claimId,outcome:'STOP_GATE',decision});return;}
    const queued=await coordinator.enqueueAction({url:planned.conversationUrl,tabId:null,workPackageTitle:decision.workPackageTitle,taskTitle:decision.taskTitle,instruction:decision.instruction,roomId:requestValue.roomId,workstreamId:requestValue.workstreamId,runtimeBinding:{projectId:requestValue.projectId,projectName:requestValue.projectName||requestValue.projectId,repositoryIdentity:requestValue.repositoryIdentity,repositoryPath:requestValue.worktree,branch:requestValue.branch,head:requestValue.head},executionProvider:{executionClass:decision.actionClass,provider:decision.provider,providerRoutingReason:decision.providerRoutingReason}});
    await finishNextStep(requestId,{claimId,outcome:'EXECUTION_QUEUED',bridgeRequestId:queued.ledger.requestId,decision});
    void coordinator.pollOne(queued.ledger.requestId).catch(()=>{}).finally(()=>burstPoll());
  }catch{await finishNextStep(requestId,{claimId,outcome:'UNCERTAIN',errorCode:'NEXT_STEP_PROCESSING_UNCERTAIN'}).catch(()=>{});}
  finally{nextStepInFlight.delete(requestId);}
}
async function pollNextStep(){
  if(nextStepClaimLoopRunning)return;nextStepClaimLoopRunning=true;
  try{
    await flushNextStepReceipts();const bridgeInstanceId=await coordinator.instanceId();const jobs=[];
    while(nextStepInFlight.size<NEXT_STEP_MAX_CONCURRENCY){
      const claimed=await api.claimNextStep({bridgeInstanceId});if(!claimed?.request||!claimed?.state?.claim)break;
      const requestId=claimed.request.requestId;if(nextStepInFlight.has(requestId))break;
      nextStepInFlight.add(requestId);jobs.push(processNextStepClaim(claimed));
    }
    await Promise.all(jobs);
  }catch{}finally{nextStepClaimLoopRunning=false;}
}

let burstRunning=false;
async function burstPoll(){
  if(burstRunning)return;burstRunning=true;
  try{
    for(let i=0;i<120;i++){
      await coordinator.pollAll();
      const pending=(await coordinator.ledgers()).some(item=>!['DELIVERED','DELIVERY_UNCERTAIN','SUBMIT_FAILED','RUN_FAILED'].includes(item.status));
      if(!pending)break;
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
  }finally{burstRunning=false;}
}

async function status(){
  const paired=typeof(await storage.get(TOKEN_KEY))==='string';
  const ledgers=await coordinator.ledgers();
  return {paired,pending:ledgers.filter(item=>!['DELIVERED','DELIVERY_UNCERTAIN','SUBMIT_FAILED','RUN_FAILED'].includes(item.status)).length,total:ledgers.length};
}

function errorBody(error){return {ok:false,errorCode:error?.code||error?.message||'BRIDGE_CLIENT_ERROR'};}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  void (async()=>{
    if(message?.type==='AICC_LIST_TASKS')return sendResponse({ok:true,tasks:await listTasks()});
    if(message?.type==='AICC_NEXT_STEP_POLL'){await pollNextStep();return sendResponse({ok:true});}
    if(message?.type==='AICC_HUMAN_CHAT_POLL'){await pollHumanChat();return sendResponse({ok:true});}
    if(message?.type==='AICC_SAVE_PAIRING')return sendResponse({ok:true,...await savePairing(message.token)});
    if(message?.type==='AICC_PAIRING_STATUS'){try{await autoPair();}catch{}return sendResponse({ok:true,...await status()});}
    if(message?.type==='AICC_PUBLISH_SNAPSHOT'){
      if(sender.tab?.id&&plannerTabIds.has(sender.tab.id))return sendResponse({ok:true,ignored:true});
      if(!sender.tab?.id||!sender.tab?.url)throw Object.assign(new Error('BRIDGE_CONVERSATION_ID_UNAVAILABLE'),{code:'BRIDGE_CONVERSATION_ID_UNAVAILABLE'});
      const identity=conversationFromUrl(sender.tab.url);
      if(message.snapshot?.conversationId!==identity.conversationId)throw Object.assign(new Error('BRIDGE_CONVERSATION_MISMATCH'),{code:'BRIDGE_CONVERSATION_MISMATCH'});
      return sendResponse({ok:true,...await api.publishSnapshot({...message.snapshot,tabId:sender.tab.id})});
    }
    if(message?.type==='AICC_SUBMIT_EXPLICIT'){
      if(!sender.tab?.id||!sender.tab?.url)throw Object.assign(new Error('BRIDGE_CONVERSATION_ID_UNAVAILABLE'),{code:'BRIDGE_CONVERSATION_ID_UNAVAILABLE'});
      const senderConversation=conversationFromUrl(sender.tab.url);
      const supplied=conversationFromUrl(message.url);
      if(senderConversation.conversationId!==supplied.conversationId)throw Object.assign(new Error('BRIDGE_CONVERSATION_MISMATCH'),{code:'BRIDGE_CONVERSATION_MISMATCH'});
      const taskTitle=typeof message.taskTitle==='string'?message.taskTitle.trim():'';
      if(!taskTitle)throw Object.assign(new Error('BRIDGE_TASK_TITLE_REQUIRED'),{code:'BRIDGE_TASK_TITLE_REQUIRED'});
      if(message.taskId){
        const exact=(await listTasks()).find(task=>task.id===message.taskId);
        if(!exact)throw Object.assign(new Error('BRIDGE_TASK_NOT_FOUND'),{code:'BRIDGE_TASK_NOT_FOUND'});
        if(typeof exact.title!=='string'||!exact.title.trim())throw Object.assign(new Error('BRIDGE_TASK_TITLE_REQUIRED'),{code:'BRIDGE_TASK_TITLE_REQUIRED'});
        if(exact.title!==taskTitle)throw Object.assign(new Error('BRIDGE_TASK_TITLE_MISMATCH'),{code:'BRIDGE_TASK_TITLE_MISMATCH'});
      }
      const queued=await coordinator.enqueueAction({url:sender.tab.url,tabId:sender.tab.id,taskId:message.taskId||null,workPackageTitle:message.workPackageTitle||null,taskTitle,instruction:message.instruction});
      sendResponse({ok:true,requestId:queued.ledger.requestId,runId:null,queued:true});
      void coordinator.pollOne(queued.ledger.requestId).catch(()=>{}).finally(()=>burstPoll());return;
    }
    return sendResponse({ok:false,errorCode:'BRIDGE_CLIENT_MESSAGE_INVALID'});
  })().catch(error=>sendResponse(errorBody(error)));
  return true;
});
async function ensureAlarm(){
  try{await chrome.alarms.create(ALARM,{periodInMinutes:0.5});}catch{}
}
async function reinjectOpenChatgptTabs(){
  let tabs=[];try{tabs=await chrome.tabs.query({url:'https://chatgpt.com/*'});}catch{return;}
  for(const tab of tabs){
    if(!Number.isInteger(tab.id))continue;
    try{await installContentAdapter(tab.id);}catch{}
  }
}
function servicePulse(){void coordinator.pollAll();void snapshotOpenChatgptTabs();void pollNextStep();void pollHumanChat();}

chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM)servicePulse();});
chrome.runtime.onStartup.addListener(()=>{void ensureAlarm();void reinjectOpenChatgptTabs().then(()=>servicePulse());void autoPair().then(()=>servicePulse()).catch(()=>{});});
chrome.runtime.onInstalled.addListener(()=>{void ensureAlarm();void reinjectOpenChatgptTabs().then(()=>servicePulse());void autoPair().then(()=>servicePulse()).catch(()=>{});});
void ensureAlarm();
void reinjectOpenChatgptTabs().then(()=>servicePulse());
void autoPair().then(()=>servicePulse()).catch(()=>{});

chrome.tabs.onUpdated.addListener((tabId,info,tab)=>{if(info.status==='complete'&&sameConversationSafe(tab?.url||''))void publishTabSnapshot({...tab,id:tabId});});
