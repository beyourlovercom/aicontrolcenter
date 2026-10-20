/**
 * Owned async audit worker. This avoids tying audit cleanup to popup lifetime.
 * Only fixed, consented Woo Shipping GET pages; no arbitrary URL or form writes.
 */
import {fixedShippingRequest,exactAuditPage,sanitizeBrowserSnapshot,safeExportName}
  from './guard.mjs';
import {readWooShippingDocument} from './snapshot.mjs';

const ACTIVE_KEY='bylWpShippingActiveAuditV1';
let running=false;
const safeCode=value=>{
  const known=new Set(['HOST_PERMISSION_NOT_GRANTED','TAB_UNAVAILABLE','AUTH_OR_URL_DENIED',
    'AUDIT_TIMEOUT','DOM_READ_FAILED','TAB_NAVIGATION_FAILED','AUDIT_RESPONSE_TOO_LARGE',
    'EXPORT_FAILED','DATA_UNTRUSTED','AUDIT_BUSY','AUDIT_WORKER_FAILED']);
  return known.has(value)?value:'AUDIT_FAILED_CLOSED';
};
const auditUrl=url=>{
  try{
    const u=new URL(url);
    return u.protocol==='https:'&&
      ['dev.beyourlover.com','www.beyourlover.com'].includes(u.hostname)&&
      u.pathname==='/wp-admin/admin.php'&&
      u.searchParams.get('page')==='wc-settings'&&
      u.searchParams.get('tab')==='shipping';
  }catch{return false;}
};
// Recover only tabs/rules previously created by this dedicated extension.
// The record is local to Chrome's browser session; never synced or exported.
async function cleanupOrphan(){
  let state;
  try{state=(await chrome.storage.session.get(ACTIVE_KEY))[ACTIVE_KEY];}catch{return;}
  if(!state||state.owner!=='BYL_WP_SHIPPING'||!Number.isInteger(state.tabId))return;
  try{
    const tab=await chrome.tabs.get(state.tabId);
    const bound=fixedShippingRequest({environment:state.environment,
      operation:state.operation,...(state.operation==='methods'?{zoneId:state.zoneId}:{})});
    if(tab.url==='about:blank'||exactAuditPage(tab.url,bound))await chrome.tabs.remove(state.tabId);
  }catch{}
  if(Number.isInteger(state.ruleId)&&state.ruleId>=10000){
    try{await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[state.ruleId]});}catch{}
  }
  try{await chrome.storage.session.remove(ACTIVE_KEY);}catch{}
}
const recovery=cleanupOrphan();
chrome.runtime.onStartup.addListener(()=>{void cleanupOrphan();});

function waitForExactTab(tabId,request,timeoutMs=23000){
  return new Promise((resolve,reject)=>{
    let finished=false;
    const finish=(error,tab)=>{
      if(finished)return;
      finished=true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdate);
      chrome.tabs.onRemoved.removeListener(onRemove);
      error?reject(error):resolve(tab);
    };
    const onRemove=id=>{if(id===tabId)finish(Error('TAB_UNAVAILABLE'));};
    const onUpdate=async(id,change)=>{
      if(id!==tabId||change.status!=='complete')return;
      try{
        const tab=await chrome.tabs.get(tabId);
        if(tab.status!=='complete'||tab.url==='about:blank')return;
        if(!exactAuditPage(tab.url,request))return finish(Error('AUTH_OR_URL_DENIED'));
        finish(null,tab);
      }catch{finish(Error('TAB_UNAVAILABLE'));}
    };
    const timeout=setTimeout(()=>finish(Error('AUDIT_TIMEOUT')),timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdate);
    chrome.tabs.onRemoved.addListener(onRemove);
    chrome.tabs.get(tabId).then(tab=>{
      if(tab.status==='complete')onUpdate(tabId,{status:'complete'});
    }).catch(()=>finish(Error('TAB_UNAVAILABLE')));
  });
}
function blockingRule(tabId){
  return {
    id:10000+(crypto.getRandomValues(new Uint32Array(1))[0]%1000000),
    priority:100,
    action:{type:'block'},
    condition:{
      regexFilter:'^https?://',
      requestMethods:['post','put','patch','delete','connect','other'],
      resourceTypes:['main_frame','sub_frame','xmlhttprequest','script','stylesheet',
        'image','font','object','ping','csp_report','media','websocket',
        'webtransport','webbundle','other'],
      tabIds:[tabId]
    }
  };
}
async function awaitDownloaded(id,limitMs=9000){
  const stop=Date.now()+limitMs;
  while(Date.now()<stop){
    const matches=await chrome.downloads.search({id});
    const item=matches?.[0];
    if(item?.state==='complete'&&typeof item.filename==='string')return item.filename;
    if(item?.state==='interrupted')throw Error('EXPORT_FAILED');
    await new Promise(resolve=>setTimeout(resolve,200));
  }
  throw Error('EXPORT_FAILED');
}
async function readAndExport(request){
  let tab=null,rule=null,ruleArmed=false;
  try{
    const permission=await chrome.permissions.contains({origins:[request.origin+'*']});
    if(permission!==true)throw Error('HOST_PERMISSION_NOT_GRANTED');

    tab=await chrome.tabs.create({url:'about:blank',active:false});
    if(!Number.isInteger(tab.id))throw Error('TAB_UNAVAILABLE');
    rule=blockingRule(tab.id);
    await chrome.storage.session.set({[ACTIVE_KEY]:{
      owner:'BYL_WP_SHIPPING',tabId:tab.id,ruleId:rule.id
    }});
    // The rule is activated BEFORE navigating to the authenticated page.
    await chrome.declarativeNetRequest.updateSessionRules({addRules:[rule]});
    ruleArmed=true;

    await chrome.tabs.update(tab.id,{url:request.url,active:false});
    await waitForExactTab(tab.id,request);
    const verified=await chrome.tabs.get(tab.id);
    if(!exactAuditPage(verified.url,request))throw Error('AUTH_OR_URL_DENIED');

    const output=await chrome.scripting.executeScript({
      target:{tabId:tab.id},world:'ISOLATED',
      func:readWooShippingDocument,args:[request.url,request.operation]
    });
    if(output.length!==1||!output[0]?.result)throw Error('DOM_READ_FAILED');
    const result=sanitizeBrowserSnapshot(output[0].result,request);
    if(!result.ok)throw Error('DATA_UNTRUSTED');
    const receipt={
      ...result,observedAt:new Date().toISOString(),
      protection:'temporary tab-scoped non-GET rule',
      note:'A GET may trigger normal WordPress internals; no audit form or setting write was performed.'
    };
    const json=JSON.stringify(receipt,null,2);
    if(json.length>65000)throw Error('AUDIT_RESPONSE_TOO_LARGE');
    const filename=safeExportName(request,new Date());
    if(!filename)throw Error('EXPORT_FAILED');
    const id=await chrome.downloads.download({
      url:'data:application/json;charset=utf-8,'+encodeURIComponent(json),
      filename,saveAs:false,conflictAction:'uniquify'
    });
    if(!Number.isInteger(id))throw Error('EXPORT_FAILED');
    const path=await awaitDownloaded(id);
    return {ok:true,filename,path,count:receipt.rows.length,partial:receipt.partial};
  }finally{
    if(tab?.id)try{await chrome.tabs.remove(tab.id);}catch{}
    if(ruleArmed&&rule?.id)try{
      await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[rule.id]});
    }catch{}
    try{await chrome.storage.session.remove(ACTIVE_KEY);}catch{}
  }
}
chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(sender.id!==chrome.runtime.id||message?.type!=='BYL_WP_SHIPPING_AUDIT')return false;
  if(running){sendResponse({ok:false,errorCode:'AUDIT_BUSY'});return false;}
  const request=fixedShippingRequest(message.request);
  if(!request.ok){sendResponse({ok:false,errorCode:request.errorCode});return false;}
  running=true;
  (async()=>{
    try{
      await recovery;
      sendResponse(await readAndExport(request));
    }catch(error){sendResponse({ok:false,errorCode:safeCode(error?.message)});}
    finally{running=false;}
  })();
  return true;
});
