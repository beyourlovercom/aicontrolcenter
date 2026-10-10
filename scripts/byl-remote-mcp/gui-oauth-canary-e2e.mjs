import {readFileSync} from 'node:fs';
const key=readFileSync('/Users/a/.byl-remote-mcp/gateway.token','utf8').trim();
const endpoint='http://127.0.0.1:8799/mcp';
async function request(headers){
 const body=JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/list',params:{}});
 const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',accept:'application/json, text/event-stream',...headers},body});
 return {status:res.status,body:await res.text()};
}
const bearer=await request({authorization:'Bearer '+key});
const data=JSON.parse(bearer.body);
const names=data?.result?.tools?.map(x=>x.name)||[];
if(bearer.status!==200||names.length!==5||!names.includes('gui_dev_cart_home_canary'))throw Error('LEGACY_TOOLS_FAILED');
console.log('OAUTH_CANARY_LEGACY_BEARER_PASS tools='+names.length);
const unauth=await request({});
if(unauth.status!==401)throw Error('UNAUTH_FAILED');
console.log('OAUTH_CANARY_ANONYMOUS_DENIED_PASS');
const spoof=await request({'cf-access-jwt-assertion':'x'.repeat(100)});
if(spoof.status!==401)throw Error('SPOOFED_ASSERTION_FAILED');
console.log('OAUTH_CANARY_SPOOF_ASSERTION_DENIED_PASS');
