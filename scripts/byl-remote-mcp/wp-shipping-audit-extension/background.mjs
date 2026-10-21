/**
 * Owned async audit worker. This avoids tying audit cleanup to popup lifetime.
 * Only fixed, consented Woo Shipping GET pages; no arbitrary URL or form writes.
 */
import {fixedShippingRequest,exactAuditPage,sanitizeBrowserSnapshot,safeExportName}
  from './guard.mjs';
import {readWooShippingDocument} from './snapshot.mjs';
import {fixedInstanceBatchRequest,exactInstancePage,sanitizeInstanceDetail,
  aggregateInstanceBatch,safeBatchFilename} from './instance-guard.mjs';
import {readWooShippingInstanceDocument} from './instance-snapshot.mjs';
import {DEV_A5_KEY,A5_VERSION,newDevReceipt,hasFreshOwnerDevApproval} from './instance-approval.mjs';

const ACTIVE_KEY='bylWpShippingActiveAuditV1';
const INSTANCE_RULE_IDS=Object.freeze([1810001,1810002,1810003]);
let running=false;
const safeCode=value=>{
  const known=new Set(['HOST_PERMISSION_NOT_GRANTED','TAB_UNAVAILABLE','AUTH_OR_URL_DENIED',
    'AUDIT_TIMEOUT','DOM_READ_FAILED','TAB_NAVIGATION_FAILED','AUDIT_RESPONSE_TOO_LARGE',
    'EXPORT_FAILED','DATA_UNTRUSTED','AUDIT_BUSY','AUDIT_WORKER_FAILED',
    'INSTANCE_SOURCE_NOT_VERIFIED','INVALID_REQUIREMENT','INVALID_RATE_FIELD',
    'DEV_A5_REQUIRED','AUDIT_CLEANUP_FAILED',
    'DEV_OWNER_PASS_REQUIRED','INSTANCE_RULE_COLLISION']);
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
    const bound=state.operation==='instanceBatch'
      ?fixedInstanceBatchRequest({environment:state.environment,operation:'instanceBatch'})
        .targets?.find(target=>target.instanceId===state.instanceId)
      :fixedShippingRequest({environment:state.environment,operation:state.operation,
        ...(state.operation==='methods'?{zoneId:state.zoneId}:{})});
    if(tab.url==='about:blank'||
      (state.operation==='instanceBatch'
        ?exactInstancePage(tab.url,bound):exactAuditPage(tab.url,bound)))
      await chrome.tabs.remove(state.tabId);
  }catch{}
  const ruleIds=state.operation==='instanceBatch'
    ?(Array.isArray(state.ruleIds)&&state.ruleIds.length===INSTANCE_RULE_IDS.length&&
      state.ruleIds.every((n,i)=>n===INSTANCE_RULE_IDS[i])?INSTANCE_RULE_IDS:[])
    :(Number.isInteger(state.ruleId)&&state.ruleId>=10000?[state.ruleId]:[]);
  if(ruleIds.length){
    try{await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[...ruleIds]});}catch{}
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
        const matches=request?.kind
          ?exactInstancePage(tab.url,request):exactAuditPage(tab.url,request);
        if(!matches)return finish(Error('AUTH_OR_URL_DENIED'));
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
      requestMethods:['post','put','patch','delete','head','options','connect','other'],
      resourceTypes:['main_frame','sub_frame','xmlhttprequest','script','stylesheet',
        'image','font','object','ping','csp_report','media','websocket',
        'webtransport','webbundle','other'],
      tabIds:[tabId]
    }
  };
}

/**
 * Pre-navigation main-frame guard: allow only the exact observed instance URL.
 * Higher priority exact allow beats the tab-wide main-frame GET block; the
 * independent non-GET block matches a distinct method set.
 */
function instanceRules(tabId,target){
  const literalUrlRegex='^'+target.url.replaceAll('.','\\.').replaceAll('?','\\?')+
    String.fromCharCode(36);
  return [
    {...blockingRule(tabId),id:INSTANCE_RULE_IDS[0]},
    {id:INSTANCE_RULE_IDS[1],priority:110,action:{type:'block'},
      condition:{regexFilter:'^https?://',requestMethods:['get'],
        resourceTypes:['main_frame'],tabIds:[tabId]}},
    {id:INSTANCE_RULE_IDS[2],priority:200,action:{type:'allow'},
      condition:{regexFilter:literalUrlRegex,
        requestMethods:['get'],resourceTypes:['main_frame'],tabIds:[tabId]}}
  ];
}
async function assertInstanceRuleIdsFree(){
  const current=await chrome.declarativeNetRequest.getSessionRules();
  if(!Array.isArray(current)||current.some(x=>INSTANCE_RULE_IDS.includes(x.id)))
    throw Error('INSTANCE_RULE_COLLISION');
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
      owner:'BYL_WP_SHIPPING',tabId:tab.id,ruleId:rule.id,
      environment:request.environment,operation:request.operation,zoneId:request.zoneId
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

/**
 * A5 controlled nine-instance audit: one temporary tab per known instance,
 * sequentially, exact URL and bounded timeout. No arbitrary GET targets.
 */
async function readInstanceBatchAndExport(request){
  if(request.operation!=='instanceBatch'||request.targets.length!==9)
    throw Error('DATA_UNTRUSTED');
  const permitted=await chrome.permissions.contains({origins:[request.origin+'*']});
  if(permitted!==true)throw Error('HOST_PERMISSION_NOT_GRANTED');
  if(request.environment==='WWW'){
    // Require recent, separate Owner confirmation of a complete redacted
    // Dev export under the exact extension version. A prior export alone
    // must NOT silently unlock WWW.
    const evidence=await chrome.storage.local.get(DEV_A5_KEY);
    if(!hasFreshOwnerDevApproval(evidence?.[DEV_A5_KEY]))
      throw Error('DEV_OWNER_PASS_REQUIRED');
  }
  const details=[];
  for(const target of request.targets){
    let tab=null,rule=null,ruleArmed=false;
    try{
      tab=await chrome.tabs.create({url:'about:blank',active:false});
      if(!Number.isInteger(tab.id))throw Error('TAB_UNAVAILABLE');
      await assertInstanceRuleIdsFree();
      rule=instanceRules(tab.id,target);
      await chrome.storage.session.set({[ACTIVE_KEY]:{
        owner:'BYL_WP_SHIPPING',tabId:tab.id,ruleIds:[...INSTANCE_RULE_IDS],
        environment:request.environment,operation:'instanceBatch',
        instanceId:target.instanceId
      }});
      // Atomically enforce non-GET block, all-mainframe GET block, and
      // exact fixed GET allow before the first navigation.
      await chrome.declarativeNetRequest.updateSessionRules({addRules:rule});
      ruleArmed=true;
      await chrome.tabs.update(tab.id,{url:target.url,active:false});
      await waitForExactTab(tab.id,target,15000);
      const verified=await chrome.tabs.get(tab.id);
      if(!exactInstancePage(verified.url,target))throw Error('AUTH_OR_URL_DENIED');
      const returned=await chrome.scripting.executeScript({
        target:{tabId:tab.id},world:'ISOLATED',
        func:readWooShippingInstanceDocument,
        args:[target.url,target.instanceId,target.kind]
      });
      if(returned.length!==1||!returned[0]?.result)throw Error('DOM_READ_FAILED');
      const detail=sanitizeInstanceDetail(returned[0].result,target);
      if(!detail.ok)throw Error(detail.errorCode||'DATA_UNTRUSTED');
      details.push(detail);
    }finally{
      // Cleanup is independent per instance; never leave an unguarded tab
      // open to continue after the popup was closed.
      let tabClosed=true,ruleRemoved=true;
      if(tab?.id)try{await chrome.tabs.remove(tab.id);}catch{tabClosed=false;}
      if(ruleArmed&&Array.isArray(rule))try{
        await chrome.declarativeNetRequest.updateSessionRules({
          removeRuleIds:rule.map(item=>item.id)
        });
      }catch{ruleRemoved=false;}
      if(tabClosed&&ruleRemoved){
        try{await chrome.storage.session.remove(ACTIVE_KEY);}catch{}
      }
      if(!tabClosed||!ruleRemoved)throw Error('AUDIT_CLEANUP_FAILED');
    }
  }
  const observedAt=new Date().toISOString();
  const normalized=aggregateInstanceBatch(request,details,observedAt);
  if(!normalized.ok)throw Error('DATA_UNTRUSTED');
  const receipt={
    ...normalized,protection:'sequential-9-tab-scoped-non-GET-rules',
    note:'Each priorZoneId is from an earlier WWW method-list receipt; the instance detail page does not independently verify its zone. An authenticated GET may trigger routine site internals.'
  };
  const json=JSON.stringify(receipt,null,2);
  if(json.length>65000)throw Error('AUDIT_RESPONSE_TOO_LARGE');
  const filename=safeBatchFilename(request,new Date());
  if(!filename)throw Error('EXPORT_FAILED');
  const downloadId=await chrome.downloads.download({
    url:'data:application/json;charset=utf-8,'+encodeURIComponent(json),
    filename,saveAs:false,conflictAction:'uniquify'
  });
  if(!Number.isInteger(downloadId))throw Error('EXPORT_FAILED');
  const path=await awaitDownloaded(downloadId);
  if(request.environment==='DEV'){
    // Record only after the redacted 9-instance download has actually
    // completed. It remains LOCKED until the Owner explicitly confirms the
    // reviewed Dev JSON through the extension's separate consent control.
    const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(json));
    const sha256=[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
    const pending=newDevReceipt(sha256,observedAt);
    if(!pending)throw Error('DATA_UNTRUSTED');
    await chrome.storage.local.set({[DEV_A5_KEY]:pending});
  }
  return {ok:true,path,count:receipt.count,partial:receipt.partial};
}

chrome.runtime.onMessage.addListener((message,sender,sendResponse)=>{
  if(sender.id!==chrome.runtime.id||message?.type!=='BYL_WP_SHIPPING_AUDIT')return false;
  if(running){sendResponse({ok:false,errorCode:'AUDIT_BUSY'});return false;}
  const isInstanceBatch=message?.request?.operation==='instanceBatch';
  const request=isInstanceBatch?fixedInstanceBatchRequest(message.request):
    fixedShippingRequest(message.request);
  if(!request.ok){sendResponse({ok:false,errorCode:request.errorCode});return false;}
  running=true;
  (async()=>{
    try{
      await recovery;
      sendResponse(await (isInstanceBatch?readInstanceBatchAndExport(request):readAndExport(request)));
    }catch(error){sendResponse({ok:false,errorCode:safeCode(error?.message)});}
    finally{running=false;}
  })();
  return true;
});
