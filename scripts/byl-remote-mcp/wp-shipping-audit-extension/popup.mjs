/**
 * Only explicit Owner consent happens inside the short-lived Chrome popup.
 * Long-running GET inspection/cleanup belongs to the background worker.
 */
import {fixedShippingRequest} from './guard.mjs';
import {fixedInstanceBatchRequest} from './instance-guard.mjs';
import {DEV_A5_KEY,isDevReceiptAwaitingOwner,ownerApproveDevReceipt,
  hasFreshOwnerDevApproval} from './instance-approval.mjs';
const environment=document.getElementById('environment');
const operation=document.getElementById('operation');
const zoneId=document.getElementById('zoneId');
const button=document.getElementById('audit');
const approve=document.getElementById('approveDev');
const status=document.getElementById('status');
const say=text=>{status.textContent=text;};

const refreshDevApproval=async()=>{
  try{
    const record=(await chrome.storage.local.get(DEV_A5_KEY))[DEV_A5_KEY];
    approve.disabled=!isDevReceiptAwaitingOwner(record);
  }catch{approve.disabled=true;}
};
void refreshDevApproval();
approve.addEventListener('click',async()=>{
  if(approve.disabled)return;
  approve.disabled=true;
  try{
    const record=(await chrome.storage.local.get(DEV_A5_KEY))[DEV_A5_KEY];
    const approved=ownerApproveDevReceipt(record);
    if(!approved){say('Dev export confirmation expired or unavailable.');return;}
    await chrome.storage.local.set({[DEV_A5_KEY]:approved});
    if(hasFreshOwnerDevApproval(approved)){
      say('Owner-confirmed Dev A5 audit recorded for this extension build (48h). WWW still requires a separate Chrome host permission and an explicit audit click.');
    }else say('Could not verify the Owner Dev approval record.');
  }catch{say('Owner confirmation unavailable. No WWW permission was changed.');}
  finally{void refreshDevApproval();}
});

operation.addEventListener('change',()=>{
  zoneId.disabled=operation.value!=='methods';
});
button.addEventListener('click',async()=>{
  if(button.disabled)return;
  const input={environment:environment.value,operation:operation.value};
  if(input.operation==='methods'){
    if(!/^\d{1,5}$/.test(zoneId.value)){say('Invalid zone ID');return;}
    input.zoneId=Number(zoneId.value);
  }
  const request=input.operation==='instanceBatch'
    ?fixedInstanceBatchRequest(input):fixedShippingRequest(input);
  if(!request.ok){say('Denied: '+request.errorCode);return;}
  button.disabled=true;
  say('Waiting for Chrome permission for '+request.host+'.');
  try{
    // Native Chrome permission dialog requires an actual Owner button click.
    const consent=await chrome.permissions.request({origins:[request.origin+'*']});
    if(consent!==true){say('Host permission not granted. No audit started.');return;}
    say(input.operation==='instanceBatch'
      ?'Reading nine fixed Woo shipping method settings pages sequentially. You may close this popup.'
      :'Reading authorized Woo Shipping page (read-only). You may close the popup.');
    const result=await chrome.runtime.sendMessage({
      type:'BYL_WP_SHIPPING_AUDIT',request:input
    });
    if(!result?.ok){say('Audit stopped safely: '+(result?.errorCode||'WORKER_UNAVAILABLE'));return;}
    say('Redacted local JSON completed:\n'+result.path+
      '\nShipping records observed: '+result.count+
      '\n'+(result.partial?'PARTIAL: hidden configuration values remain UNKNOWN.':'Visible fields captured.')+
      '\nReview using your authorized DC read_file tool.');
  }catch{
    say('Browser audit ended with an unavailable/closed permission or worker channel. '+
      'No WooCommerce form was submitted; check Downloads for a completed JSON receipt, if any.');
  }finally{button.disabled=false;void refreshDevApproval();}
});
