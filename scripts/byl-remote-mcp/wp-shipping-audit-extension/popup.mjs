/**
 * Only explicit Owner consent happens inside the short-lived Chrome popup.
 * Long-running GET inspection/cleanup belongs to the background worker.
 */
import {fixedShippingRequest} from './guard.mjs';
const environment=document.getElementById('environment');
const operation=document.getElementById('operation');
const zoneId=document.getElementById('zoneId');
const button=document.getElementById('audit');
const status=document.getElementById('status');
const say=text=>{status.textContent=text;};
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
  const request=fixedShippingRequest(input);
  if(!request.ok){say('Denied: '+request.errorCode);return;}
  button.disabled=true;
  say('Waiting for Chrome permission for '+request.host+'.');
  try{
    // Native Chrome permission dialog requires an actual Owner button click.
    const consent=await chrome.permissions.request({origins:[request.origin+'*']});
    if(consent!==true){say('Host permission not granted. No audit started.');return;}
    say('Reading authorized Woo Shipping page (read-only). You may close the popup.');
    const result=await chrome.runtime.sendMessage({
      type:'BYL_WP_SHIPPING_AUDIT',request:input
    });
    if(!result?.ok){say('Audit stopped safely: '+(result?.errorCode||'WORKER_UNAVAILABLE'));return;}
    say('Redacted local JSON completed:\n'+result.path+
      '\nShipping rows observed: '+result.count+
      '\n'+(result.partial?'PARTIAL: hidden configuration values remain UNKNOWN.':'Visible fields captured.')+
      '\nReview using your authorized DC read_file tool.');
  }catch{
    say('Browser audit ended with an unavailable/closed permission or worker channel. '+
      'No WooCommerce form was submitted; check Downloads for a completed JSON receipt, if any.');
  }finally{button.disabled=false;}
});
