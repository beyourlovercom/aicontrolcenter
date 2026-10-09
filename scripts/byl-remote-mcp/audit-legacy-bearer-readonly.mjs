/** Read-only production legacy MCP compatibility audit.
 * Run on the existing US Mac mini. Never print the Bearer token or request headers.
 * No files, services, devices, or remote agents are modified.
 */
import {readFileSync} from 'node:fs';

const token=readFileSync('/Users/a/.byl-remote-mcp/gateway.token','utf8').trim();
const url=process.env.BYL_AUDIT_MCP_URL||'http://127.0.0.1:8792/mcp';
if(!['http://127.0.0.1:8792/mcp','https://mcp.beyourlover.com/mcp'].includes(url)){
  throw new Error('AUDIT_URL_NOT_ALLOWLISTED');
}
const headers={
  authorization:'Bearer '+token,
  'content-type':'application/json',
  accept:'application/json, text/event-stream'
};
async function probe(method,id,params){
  const response=await fetch(url,{
    method:'POST',headers,
    body:JSON.stringify({jsonrpc:'2.0',id,method,params}),
    signal:AbortSignal.timeout(8000)
  });
  const body=await response.text();
  let payload;
  try{payload=JSON.parse(body);}catch{
    const data=body.split('\n').find(line=>line.startsWith('data: '));
    if(data){try{payload=JSON.parse(data.slice(6));}catch{}}
  }
  const result={
    method,http:response.status,ok:response.ok,
    jsonrpc:payload?.jsonrpc||null,
    errorCode:payload?.error?.code??null,
    validResult:!!payload?.result
  };
  if(method==='tools/list'){
    result.tools=Array.isArray(payload?.result?.tools)?payload.result.tools.map(x=>x.name):[];
  }
  console.log(JSON.stringify(result));
  if(!response.ok||!payload?.result)process.exitCode=1;
}
await probe('initialize',1,{
  protocolVersion:'2025-03-26',capabilities:{},
  clientInfo:{name:'byl-prod-legacy-readonly-audit',version:'1.0'}
});
await probe('tools/list',2,{});
