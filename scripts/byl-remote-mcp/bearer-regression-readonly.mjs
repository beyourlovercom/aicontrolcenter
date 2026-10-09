import {readFileSync} from 'node:fs';

const token=readFileSync('/Users/a/.byl-remote-mcp/gateway.token','utf8').trim();
if(!token||token.length<12)throw Error('TEST_TOKEN_NOT_FOUND');
const ports=[8792,8795];
const request={
  jsonrpc:'2.0',
  id:1,
  method:'initialize',
  params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'byl-bearer-regression-readonly',version:'1.0.0'}}
};
async function probe(port,auth){
  const r=await fetch('http://127.0.0.1:'+port+'/mcp',{
    method:'POST',
    headers:{'content-type':'application/json','accept':'application/json, text/event-stream',...(auth?{authorization:'Bearer '+token}:{})},
    body:JSON.stringify(request),signal:AbortSignal.timeout(7000)
  });
  const body=await r.text();
  return {status:r.status,validInitialize:body.includes('"result"')&&body.includes('"protocolVersion"'),bodyLength:body.length};
}
for(const port of ports){
  const authed=await probe(port,true);
  const anonymous=await probe(port,false);
  if(authed.status!==200||!authed.validInitialize)throw Error('BEARER_GATE_FAIL_'+port+'_'+authed.status);
  if(anonymous.status!==401)throw Error('ANONYMOUS_GATE_FAIL_'+port+'_'+anonymous.status);
  console.log('MCP_'+port+'_BEARER=PASS');
  console.log('MCP_'+port+'_ANONYMOUS_DENY=PASS');
}
