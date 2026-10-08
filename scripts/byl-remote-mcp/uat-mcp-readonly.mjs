#!/usr/bin/env node
/**
 * BYL Remote MCP read-only UAT. Node.js 20+.
 * Never prints credentials, response bodies, or arbitrary command output.
 * Authenticated run: supply BYL_MCP_UAT_BEARER via a secure local environment.
 * Without it, only public health / negative-auth tests run; UAT remains BLOCKED.
 */
import {pathToFileURL} from 'node:url';

export const EXPECTED_DEVICES = Object.freeze({
  'us-macmini': /as-Mac-mini/i,
  'china-mac': /amacbook-pro/i,
  'windows': /YST-241030SSD/i
});
export const REQUIRED_TOOLS = Object.freeze([
  'remote_list_devices','remote_list_tools','remote_call','remote_process_selftest'
]);
const DEFAULT_ENDPOINT='http://127.0.0.1:8792/mcp';
const TIMEOUT_MS=15_000;

function parseRpc(text){
  const trimmed=text.trim();
  if(trimmed.startsWith('data:') || trimmed.startsWith('event:')){
    const frames=trimmed.split(/\r?\n/).filter(line=>line.startsWith('data:'));
    if(!frames.length) throw Error('SSE_NO_DATA');
    return JSON.parse(frames.at(-1).slice(5).trim());
  }
  return JSON.parse(trimmed);
}
function safeEndpoint(raw){
  const url=new URL(raw);
  if(!['http:','https:'].includes(url.protocol))throw Error('BAD_SCHEME');
  if(url.username||url.password||url.hash)throw Error('UNSAFE_URL');
  if(url.pathname!=='/mcp')throw Error('EXPECTED_MCP_PATH');
  if(url.protocol==='http:'&&!['localhost','127.0.0.1','::1','[::1]'].includes(url.hostname))throw Error('HTTP_NOT_LOOPBACK');
  return url;
}
function safeText(value){
  if(value==null) return '';
  if(typeof value==='string')return value;
  return JSON.stringify(value);
}
export async function runUat({endpoint=DEFAULT_ENDPOINT,token='',fetchImpl=fetch,write=console.log}={}){
  const url=safeEndpoint(endpoint);
  const base=new URL(url);
  const checks=[];
  const record=(name,status,reason='')=>{
    const row={name,status,...(reason?{reason}:{})};checks.push(row);
    write([name,status,reason].filter(Boolean).join(' | '));
  };
  async function request(path,method='GET',body,auth=false){
    const uri=new URL(path,base);
    const headers={'accept':'application/json, text/event-stream'};
    if(body!==undefined)headers['content-type']='application/json';
    if(auth)headers.authorization='Bearer '+token;
    return fetchImpl(uri,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(TIMEOUT_MS)});
  }
  try{
    const response=await request('/healthz');
    record('health',response.ok?'PASS':'FAIL','HTTP_'+response.status);
  }catch{record('health','FAIL','UNREACHABLE');}
  try{
    const response=await request('/mcp','POST',{jsonrpc:'2.0',id:100,method:'initialize',params:{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'byl-readonly-uat',version:'1.0.0'}}});
    record('reject_anonymous_mcp',response.status===401?'PASS':'FAIL','HTTP_'+response.status);
  }catch{record('reject_anonymous_mcp','FAIL','UNREACHABLE');}
  if(!token){
    record('authenticated_mcp','BLOCKED','NO_LOCAL_TEST_CREDENTIAL');
    const status=checks.some(c=>c.status==='FAIL')?'FAIL':'BLOCKED';
    record('overall',status);
    return {status,checks};
  }
  let rpcId=1;
  async function call(method,params){
    const resp=await request('/mcp','POST',{jsonrpc:'2.0',id:rpcId++,method,params},true);
    if(resp.status!==200) throw Error('HTTP_'+resp.status);
    const data=parseRpc(await resp.text());
    if(data.error||!data.result)throw Error('RPC_ERROR');
    return data.result;
  }
  try{
    const init=await call('initialize',{protocolVersion:'2025-03-26',capabilities:{},clientInfo:{name:'byl-readonly-uat',version:'1.0.0'}});
    record('initialize',init.serverInfo?'PASS':'FAIL');
  }catch{record('initialize','FAIL','HANDSHAKE');}
  try{
    const tools=await call('tools/list',{});
    const names=(tools.tools||[]).map(t=>t.name);
    record('tools_list',REQUIRED_TOOLS.every(x=>names.includes(x))?'PASS':'FAIL');
  }catch{record('tools_list','FAIL','TOOLS_UNAVAILABLE');}
  try{
    const result=await call('tools/call',{name:'remote_list_devices',arguments:{}});
    const value=safeText(result.content);
    record('device_registry',Object.keys(EXPECTED_DEVICES).every(id=>value.includes(id))?'PASS':'FAIL','REGISTRY_ONLY_NOT_HEARTBEAT');
  }catch{record('device_registry','FAIL','TOOL_ERROR');}
  for(const [deviceId,re] of Object.entries(EXPECTED_DEVICES)){
    try{
      const result=await call('tools/call',{name:'remote_process_selftest',arguments:{deviceId}});
      const value=safeText(result.content);
      const pass=!result.isError&&re.test(value);
      record('hostname_'+deviceId,pass?'PASS':'FAIL',pass?'READ_ONLY':'UNVERIFIED_IDENTITY');
    }catch{record('hostname_'+deviceId,'FAIL','TOOL_ERROR');}
  }
  const fail=checks.some(c=>c.status==='FAIL');
  const status=fail?'FAIL':checks.some(c=>c.status==='BLOCKED')?'BLOCKED':'PASS';
  record('overall',status);
  return {status,checks};
}

if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  runUat({endpoint:process.env.BYL_MCP_UAT_URL||DEFAULT_ENDPOINT,token:process.env.BYL_MCP_UAT_BEARER||''})
    .then(r=>{process.exitCode=r.status==='PASS'?0:r.status==='BLOCKED'?2:1;})
    .catch(()=>{console.error('UAT_SETUP_FAILED');process.exitCode=1;});
}
