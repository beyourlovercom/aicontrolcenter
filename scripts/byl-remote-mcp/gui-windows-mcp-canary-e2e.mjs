import {readFileSync} from 'node:fs';
import {join} from 'node:path';
const token=readFileSync(join(process.env.USERPROFILE,'.byl-mcp-backup','gateway.token'),'utf8').trim();
async function rpc(port,method,params,auth=true){
 const r=await fetch('http://127.0.0.1:'+port+'/mcp',{method:'POST',
  headers:{'content-type':'application/json','accept':'application/json, text/event-stream',...(auth?{authorization:'Bearer '+token}:{})},
  body:JSON.stringify({jsonrpc:'2.0',id:1,method,params}),signal:AbortSignal.timeout(30000)});
 return {status:r.status,body:await r.json()};
}
function gate(ok,name){if(!ok)throw Error(name+'_FAIL');console.log(name+'=PASS')}
const anon=await rpc(8893,'tools/list',{},false);
gate(anon.status===401,'CANARY_ANONYMOUS_DENIED');
const c=await rpc(8893,'tools/list',{});
const live=await rpc(8892,'tools/list',{});
const n='gui_dev_cart_home_canary';
gate(c.status===200 && c.body.result?.tools?.some(t=>t.name===n),'CANARY_GUI_TOOL_DISCOVERED');
gate(live.status===200 && !live.body.result?.tools?.some(t=>t.name===n),'LIVE_BACKUP_UNCHANGED');
const res=await rpc(8893,'tools/call',{name:n,arguments:{}});
const receipt=res.body.result?.content?.[0]?.text||'';
gate(res.status===200 && receipt.includes('DEV_GUI_OWNER_CANARY_PASS') && res.body.result?.isError!==true,'CANARY_GUI_DEV_NAVIGATION');
