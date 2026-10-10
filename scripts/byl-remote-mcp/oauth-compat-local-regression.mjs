import {readFileSync} from 'node:fs';
const token=readFileSync('/Users/a/.byl-remote-mcp/gateway.token','utf8').trim();
const body=JSON.stringify({jsonrpc:'2.0',id:1,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'byl-compat-rehearsal',version:'1.0'}}});
async function call(path,authorization){
 const r=await fetch('http://127.0.0.1:8797'+path,{
  method:'POST',
  headers:{'accept':'application/json, text/event-stream','content-type':'application/json',...(authorization?{'authorization':'Bearer '+token}:{})},
  body,signal:AbortSignal.timeout(6000)
 });
 return {status:r.status,contentType:r.headers.get('content-type'),text:await r.text()};
}
const ok=await call('/oauth/mcp',true);
if(ok.status!==200||!ok.text.includes('"protocolVersion"'))throw Error('COMPAT_BEARER_INIT_FAIL:'+ok.status);
console.log('LOCAL_8797_AUTHENTICATED_MCP=PASS');
const deny=await call('/oauth/mcp',false);
if(deny.status!==401)throw Error('COMPAT_ANONYMOUS_NOT_DENIED:'+deny.status);
console.log('LOCAL_8797_ANONYMOUS_DENY=PASS');
const legacy=await call('/mcp',true);
if(legacy.status!==404)throw Error('COMPAT_LEGACY_PATH_EXPOSED:'+legacy.status);
console.log('LOCAL_8797_LEGACY_PATH_NOT_SERVED=PASS');
const control=await call('/control/',true);
if(control.status!==404)throw Error('COMPAT_CONTROL_PATH_EXPOSED:'+control.status);
console.log('LOCAL_8797_CONTROL_PATH_NOT_SERVED=PASS');
