import {conversationFromUrl,sameConversation} from './core.mjs';
import {createCoordinator} from './coordinator.mjs';

const BASE='http://127.0.0.1:1420';
const TOKEN_KEY='aiccBridgeTokenV1';
const ALARM='aicc-v3-bridge-poll';

try{await chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'});}catch{}

const storage={
  async get(key){const value=await chrome.storage.local.get(key);return value[key];},
  async set(key,value){await chrome.storage.local.set({[key]:value});}
};

async function token(){
  const value=await storage.get(TOKEN_KEY);
  if(typeof value!=='string'||value.length<32){const error=new Error('BRIDGE_AUTH_REQUIRED');error.code='BRIDGE_AUTH_REQUIRED';throw error;}
  return value;
}

async function request(path,{method='GET',body,auth=true,overrideToken}={}){
  const headers={};if(body!==undefined)headers['content-type']='application/json';
  if(auth)headers['x-aicc-bridge-token']=overrideToken||await token();
  let response;try{response=await fetch(`${BASE}${path}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body)});}catch{const error=new Error('BRIDGE_AICC_UNREACHABLE');error.code='BRIDGE_AICC_UNREACHABLE';throw error;}
  let value={};try{value=await response.json();}catch{}
  if(!response.ok){const error=new Error(value.errorCode||`HTTP_${response.status}`);error.code=value.errorCode||`HTTP_${response.status}`;error.status=response.status;throw error;}
  return value;
}
const api={
  async createRequest(body){return request('/api/bridge/requests',{method:'POST',body});},
  async getRequest(requestId){return (await request(`/api/bridge/requests/${encodeURIComponent(requestId)}`)).bridge;},
  async claim(requestId,body){return request(`/api/bridge/requests/${encodeURIComponent(requestId)}/claim`,{method:'POST',body});},
  async receipt(requestId,body){return request(`/api/bridge/requests/${encodeURIComponent(requestId)}/receipt`,{method:'POST',body});}
};

async function waitTabComplete(tabId,timeout=15000){
  const current=await chrome.tabs.get(tabId);if(current.status==='complete')return current;
  return new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{chrome.tabs.onUpdated.removeListener(listener);reject(new Error('BRIDGE_TAB_LOAD_TIMEOUT'));},timeout);
    function listener(id,info,tab){if(id===tabId&&info.status==='complete'){clearTimeout(timer);chrome.tabs.onUpdated.removeListener(listener);resolve(tab);}}
    chrome.tabs.onUpdated.addListener(listener);
  });
}

async function exactConversationTab(input){
  if(Number.isInteger(input.tabId)){
    try{
      let tab=await chrome.tabs.get(input.tabId);
      if(sameConversation(input.conversationId,tab.url||''))return tab;
      tab=await chrome.tabs.update(input.tabId,{url:input.conversationUrl});
      tab=await waitTabComplete(tab.id);
      if(sameConversation(input.conversationId,tab.url||''))return tab;
    }catch{}
  }
  const tabs=await chrome.tabs.query({url:'https://chatgpt.com/*'});
  const exact=tabs.find(tab=>sameConversation(input.conversationId,tab.url||''));
  if(exact)return exact;
  const created=await chrome.tabs.create({url:input.conversationUrl,active:false});
  const loaded=await waitTabComplete(created.id);
  if(!sameConversation(input.conversationId,loaded.url||''))throw new Error('BRIDGE_CONVERSATION_MISMATCH');
  return loaded;
}
const destination={
  async deliver(input){
    let tab;try{tab=await exactConversationTab(input);}catch{return {outcome:'ABORTED_BEFORE_SEND'};}
    if(!sameConversation(input.conversationId,tab.url||''))return {outcome:'ABORTED_BEFORE_SEND'};
    try{
      const response=await chrome.tabs.sendMessage(tab.id,{type:'AICC_DELIVER_EXACT',conversationId:input.conversationId,content:input.content,contentSha256:input.contentSha256});
      if(response?.outcome==='DELIVERED')return response;
      if(response?.outcome==='ABORTED_BEFORE_SEND')return response;
      return {outcome:'UNCERTAIN'};
    }catch(error){
      const text=String(error?.message||error||'');
      if(text.includes('Receiving end does not exist')||text.includes('Could not establish connection'))return {outcome:'ABORTED_BEFORE_SEND'};
      return {outcome:'UNCERTAIN'};
    }
  }
};

const coordinator=createCoordinator({storage,api,destination});

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
let burstRunning=false;
async function burstPoll(){
  if(burstRunning)return;burstRunning=true;
  try{
    for(let i=0;i<120;i++){
      await coordinator.pollAll();
      const pending=(await coordinator.ledgers()).some(item=>!['DELIVERED','DELIVERY_UNCERTAIN','SUBMIT_FAILED'].includes(item.status));
      if(!pending)break;
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
  }finally{burstRunning=false;}
}

async function status(){
  const paired=typeof(await storage.get(TOKEN_KEY))==='string';
  const ledgers=await coordinator.ledgers();
  return {paired,pending:ledgers.filter(item=>!['DELIVERED','DELIVERY_UNCERTAIN','SUBMIT_FAILED'].includes(item.status)).length,total:ledgers.length};
}

function errorBody(error){return {ok:false,errorCode:error?.code||error?.message||'BRIDGE_CLIENT_ERROR'};}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  void (async()=>{
    if(message?.type==='AICC_LIST_TASKS')return sendResponse({ok:true,tasks:await listTasks()});
    if(message?.type==='AICC_SAVE_PAIRING')return sendResponse({ok:true,...await savePairing(message.token)});
    if(message?.type==='AICC_PAIRING_STATUS'){try{await autoPair();}catch{}return sendResponse({ok:true,...await status()});}
    if(message?.type==='AICC_SUBMIT_EXPLICIT'){
      if(!sender.tab?.id||!sender.tab?.url)throw Object.assign(new Error('BRIDGE_CONVERSATION_ID_UNAVAILABLE'),{code:'BRIDGE_CONVERSATION_ID_UNAVAILABLE'});
      const senderConversation=conversationFromUrl(sender.tab.url);
      const supplied=conversationFromUrl(message.url);
      if(senderConversation.conversationId!==supplied.conversationId)throw Object.assign(new Error('BRIDGE_CONVERSATION_MISMATCH'),{code:'BRIDGE_CONVERSATION_MISMATCH'});
      const result=await coordinator.submitAction({url:sender.tab.url,tabId:sender.tab.id,taskId:message.taskId,instruction:message.instruction});
      void burstPoll();return sendResponse({ok:true,requestId:result.ledger.requestId,runId:result.ledger.runId});
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
    try{await chrome.scripting.executeScript({target:{tabId:tab.id},files:['content.js']});}catch{}
  }
}

chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===ALARM)void coordinator.pollAll();});
chrome.runtime.onStartup.addListener(()=>{void ensureAlarm();void reinjectOpenChatgptTabs();void autoPair().then(()=>coordinator.pollAll()).catch(()=>{});});
chrome.runtime.onInstalled.addListener(()=>{void ensureAlarm();void reinjectOpenChatgptTabs();void autoPair().catch(()=>{});});
await ensureAlarm();
void reinjectOpenChatgptTabs();
void autoPair().then(()=>coordinator.pollAll()).catch(()=>{});
