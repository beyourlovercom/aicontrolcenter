const $=id=>document.getElementById(id);
const BASE='http://127.0.0.1:1420';
const TOKEN_KEY='aiccBridgeTokenV1';
const INSTANCE_KEY='aiccBridgeInstanceIdV1';
const EXPECTED_VERSION='3.8.10';
function render(value){
  const node=$('status');node.className=`status ${value?.ok&&value?.paired?'ok':value?.ok?'':'bad'}`;
  if(!value?.ok){node.textContent=`Not paired · ${value?.errorCode||'BRIDGE_CLIENT_ERROR'}`;return;}
  node.textContent=value.paired?`PAIRED · pending ${value.pending??0} · total ${value.total??0}`:'NOT PAIRED';
}
async function storePairing(token){
  if(typeof token!=='string'||token.length<32)throw new Error('BRIDGE_AUTH_REQUIRED');
  const current=await chrome.storage.local.get(INSTANCE_KEY);
  const values={[TOKEN_KEY]:token};if(!current[INSTANCE_KEY])values[INSTANCE_KEY]=crypto.randomUUID();
  await chrome.storage.local.set(values);return {ok:true,paired:true,pending:0,total:0};
}
async function verifyToken(token){
  const response=await fetch(`${BASE}/api/bridge/requests/00000000-0000-4000-8000-000000000000`,{headers:{'x-aicc-bridge-token':token}});
  if(response.status===401)throw new Error('BRIDGE_AUTH_REQUIRED');return true;
}
async function refresh(){
  try{
    const current=await chrome.storage.local.get(TOKEN_KEY);if(typeof current[TOKEN_KEY]==='string'&&current[TOKEN_KEY].length>=32)return render({ok:true,paired:true,pending:0,total:0});
    const response=await fetch(`${BASE}/api/bridge/bootstrap`,{method:'POST'});const value=await response.json();
    if(!response.ok)throw new Error(value?.errorCode||'BRIDGE_AUTO_PAIR_FAILED');render(await storePairing(value.token));
  }catch{render({ok:false,errorCode:'BRIDGE_CLIENT_UNAVAILABLE'});}
}
$('save').addEventListener('click',async()=>{
  const token=$('token').value;$('save').disabled=true;$('status').textContent='Verifying…';
  try{await verifyToken(token);$('token').value='';render(await storePairing(token));}
  catch(error){render({ok:false,errorCode:error?.message||'BRIDGE_CLIENT_UNAVAILABLE'});}finally{$('save').disabled=false;}
});
if(chrome.runtime.getManifest().version!==EXPECTED_VERSION)chrome.runtime.reload();
else void refresh();
