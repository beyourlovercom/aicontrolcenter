import {fixedShippingRequest,exactAuditPage,sanitizeBrowserSnapshot,safeExportName}
  from './guard.mjs';
import {readWooShippingDocument} from './snapshot.mjs';

const environment=document.getElementById('environment');
const operation=document.getElementById('operation');
const zoneId=document.getElementById('zoneId');
const button=document.getElementById('audit');
const status=document.getElementById('status');
operation.addEventListener('change',()=>{zoneId.disabled=operation.value!=='methods';});
const say=message=>{status.textContent=message;};

function waitForExactTab(tabId,expectedUrl,timeoutMs=25000){
  return new Promise((resolve,reject)=>{
    let finished=false;
    const finish=(err,tab)=>{
      if(finished)return;
      finished=true;
      clearTimeout(timeout);
      chrome.tabs.onUpdated.removeListener(onUpdate);
      chrome.tabs.onRemoved.removeListener(onRemove);
      err?reject(err):resolve(tab);
    };
    const onRemove=id=>{if(id===tabId)finish(Error('AUDIT_TAB_CLOSED'));};
    const onUpdate=async(id,info)=>{
      if(id!==tabId||info.status!=='complete')return;
      try{
        const tab=await chrome.tabs.get(tabId);
        if(tab.status!=='complete')return;
        if(!exactAuditPage(tab.url,expected))return finish(Error('AUTH_OR_URL_DENIED'));
        finish(null,tab);
      }catch{finish(Error('TAB_UNAVAILABLE'));}
    };
    const expected={ok:true,url:expectedUrl,host:new URL(expectedUrl).hostname};
    const timeout=setTimeout(()=>finish(Error('AUDIT_TIMEOUT')),timeoutMs);
    chrome.tabs.onUpdated.addListener(onUpdate);
    chrome.tabs.onRemoved.addListener(onRemove);
    // The navigation may have completed before the event listener was installed.
    chrome.tabs.get(tabId).then(tab=>{
      if(tab.status==='complete')onUpdate(tabId,{status:'complete'});
    }).catch(()=>finish(Error('TAB_UNAVAILABLE')));
  });
}
const blockingRule=tabId=>({
  id:10000+crypto.getRandomValues(new Uint32Array(1))[0]%1000000,
  priority:1,
  action:{type:'block'},
  condition:{
    regexFilter:'^https?://',
    requestMethods:['post','put','patch','delete','connect','other'],
    resourceTypes:['main_frame','sub_frame','xmlhttprequest','script','stylesheet',
      'image','font','object','ping','csp_report','media','websocket',
      'webtransport','webbundle','other'],
    tabIds:[tabId]
  }
});
async function readAndExport(request){
  let auditTab=null,rule=null,ruleArmed=false;
  try{
    // Do not execute any audit unless Chrome itself granted explicit host access.
    const granted=await chrome.permissions.request({origins:[request.origin+'*']});
    if(granted!==true)throw Error('HOST_PERMISSION_NOT_GRANTED');

    auditTab=await chrome.tabs.create({url:'about:blank',active:false});
    if(!Number.isInteger(auditTab.id))throw Error('TAB_UNAVAILABLE');

    rule=blockingRule(auditTab.id);
    // Fail closed: non-GET traffic is blocked before the first WWW/Dev request.
    await chrome.declarativeNetRequest.updateSessionRules({addRules:[rule]});
    ruleArmed=true;

    const changed=await chrome.tabs.update(auditTab.id,{url:request.url,active:false});
    if(!changed)throw Error('TAB_NAVIGATION_FAILED');
    await waitForExactTab(auditTab.id,request.url);
    const tab=await chrome.tabs.get(auditTab.id);
    if(!exactAuditPage(tab.url,request))throw Error('AUTH_OR_URL_DENIED');

    const response=await chrome.scripting.executeScript({
      target:{tabId:auditTab.id},
      world:'ISOLATED',
      func:readWooShippingDocument,
      args:[request.url,request.operation]
    });
    if(response.length!==1||!response[0]?.result)throw Error('DOM_READ_FAILED');
    const result=sanitizeBrowserSnapshot(response[0].result,request);
    if(!result.ok)throw Error(result.errorCode||'DATA_UNTRUSTED');
    const receipt={
      ...result,
      observedAt:new Date().toISOString(),
      nonGetBlocker:'tab-bound-temporary-DNR-active-during-read',
      pageInteraction:'fixed-GET-navigation-only',
      note:'Unknown/hidden method costs are null, never assumed to be zero.'
    };
    const json=JSON.stringify(receipt,null,2);
    if(json.length>65000)throw Error('AUDIT_RESPONSE_TOO_LARGE');
    const filename=safeExportName(request,new Date());
    if(!filename)throw Error('EXPORT_NAME_DENIED');
    // Writes a redacted JSON to the local Downloads folder only.
    // No remote telemetry, mail, storage sync, or web endpoint is used.
    const dataUrl='data:application/json;charset=utf-8,'+encodeURIComponent(json);
    const downloadId=await chrome.downloads.download({
      url:dataUrl,filename,saveAs:false,conflictAction:'uniquify'
    });
    if(!Number.isInteger(downloadId))throw Error('EXPORT_FAILED');
    return {filename,partial:receipt.partial,count:receipt.rows.length};
  }finally{
    // Close guarded audit tab BEFORE removing the write-blocking session rule.
    if(auditTab?.id)try{await chrome.tabs.remove(auditTab.id);}catch{}
    if(ruleArmed&&rule?.id)try{
      await chrome.declarativeNetRequest.updateSessionRules({removeRuleIds:[rule.id]});
    }catch{
      // A leftover tab-bound rule is safer than removal without proof; it cannot
      // grant browser or WWW access. Subsequent requests use a distinct tab/rule.
    }
  }
}
button.addEventListener('click',async()=>{
  if(button.disabled)return;
  const input={environment:environment.value,operation:operation.value};
  if(input.operation==='methods'){
    if(!/^\d{1,5}$/.test(zoneId.value)){say('Invalid zone ID');return;}
    input.zoneId=Number(zoneId.value);
  }
  const request=fixedShippingRequest(input);
  if(!request.ok){say('Denied: '+request.errorCode);return;}
  button.disabled=true;
  say('Waiting for Chrome host permission. No site changes will be made.');
  try{
    const result=await readAndExport(request);
    say('Local JSON saved: '+result.filename+
      '\nObserved rows: '+result.count+
      '\n'+(result.partial?'PARTIAL: some settings are not visible.':'Visible fields captured.')+
      '\nUse the authorized DC read_file tool to inspect the downloaded JSON.');
  }catch(error){
    const code=String(error?.message||'AUDIT_FAILED');
    const allowed=new Set(['HOST_PERMISSION_NOT_GRANTED','TAB_UNAVAILABLE',
      'AUTH_OR_URL_DENIED','AUDIT_TIMEOUT','DOM_READ_FAILED','TAB_NAVIGATION_FAILED',
      'AUDIT_RESPONSE_TOO_LARGE','EXPORT_FAILED','DATA_UNTRUSTED']);
    say('Audit stopped safely: '+(allowed.has(code)?code:'INSPECTION_FAILED_CLOSED')+
      '\nNo WooCommerce form was submitted.');
  }finally{button.disabled=false;}
});
