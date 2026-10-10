import {readFileSync} from 'node:fs';
const token=readFileSync('/Users/a/.byl-remote-mcp/gateway.token','utf8').trim();
const payload=JSON.stringify({jsonrpc:'2.0',id:1,method:'tools/call',params:{name:'gui_dev_cart_home_canary',arguments:{}}});
const response=await fetch('http://127.0.0.1:8796/mcp',{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'application/json',accept:'application/json, text/event-stream'},body:payload,signal:AbortSignal.timeout(90000)});
const body=await response.json();
const text=body?.result?.content?.[0]?.text||'';
const result=JSON.parse(text);
console.log(JSON.stringify({httpStatus:response.status,pass:response.ok&&!body.result?.isError&&result?.verified===true,result}));
if(!response.ok||body.result?.isError||result?.verified!==true)process.exitCode=1;
