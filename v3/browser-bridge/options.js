const $=id=>document.getElementById(id);
function send(message){return chrome.runtime.sendMessage(message);}
function render(value){
  const node=$('status');node.className=`status ${value?.ok&&value?.paired?'ok':value?.ok?'':'bad'}`;
  if(!value?.ok){node.textContent=`Not paired · ${value?.errorCode||'BRIDGE_CLIENT_ERROR'}`;return;}
  node.textContent=value.paired?`PAIRED · pending ${value.pending??0} · total ${value.total??0}`:'NOT PAIRED';
}
async function refresh(){try{const current=await send({type:'AICC_PAIRING_STATUS'});if(current?.paired)return render(current);const boot=await fetch('http://127.0.0.1:1420/api/bridge/bootstrap',{method:'POST'});const value=await boot.json();if(!boot.ok||typeof value?.token!=='string')throw new Error(value?.errorCode||'BRIDGE_AUTO_PAIR_FAILED');const saved=await send({type:'AICC_SAVE_PAIRING',token:value.token});render(saved?.ok?{...saved,pending:0,total:0}:saved);}catch{render({ok:false,errorCode:'BRIDGE_CLIENT_UNAVAILABLE'});}}
$('save').addEventListener('click',async()=>{
  const token=$('token').value;$('save').disabled=true;$('status').textContent='Verifying…';
  try{const value=await send({type:'AICC_SAVE_PAIRING',token});if(value?.ok)$('token').value='';render(value);}
  catch{render({ok:false,errorCode:'BRIDGE_CLIENT_UNAVAILABLE'});}finally{$('save').disabled=false;}
});
void refresh();
