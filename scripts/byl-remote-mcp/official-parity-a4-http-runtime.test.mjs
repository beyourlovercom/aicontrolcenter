import test from 'node:test';
import assert from 'node:assert/strict';
import {z} from 'zod';
import {createCredentialFreeOAuthHttpRuntime} from './official-parity-a4-http-runtime.mjs';

const FLAG='BYL_MCP_PARITY_CORE_READ_ENABLED';
let servers=[],transports=[];
class FakeMcpServer{
 constructor(){this.tools=new Map();this.closed=0;servers.push(this);}
 registerTool(name,_schema,handler){if(this.tools.has(name))throw Error('DUPLICATE_TOOL');this.tools.set(name,handler);}
 async connect(transport){this.transport=transport;}
 async close(){this.closed++;}
}
class FakeHTTPTransport{
 constructor(settings){this.settings=settings;this.closed=0;transports.push(this);}
 async handleRequest(req,res){res.json({
  names:[...servers.at(-1).tools.keys()],principal:req.bylPrincipal.kind
 });}
 async close(){this.closed++;}
}
function fixture({on=false,envOverride={},hosts=['localhost','127.0.0.1'],
 bearer='SYNTHETIC_TOKEN_NOT_A_REAL_SECRET_2026'}={}){
 servers=[];transports=[];
 const routes=new Map(),audit=[],agentCalls=[],logs=[];
 const app={
  post:(p,...h)=>routes.set('post:'+p,h),
  get:(p,...h)=>routes.set('get:'+p,h),
  delete:(p,...h)=>routes.set('delete:'+p,h)
 };
 const env={
  BYL_MCP_STAGING:'0',BYL_MCP_OAUTH_COMPAT_CANDIDATE:'1',
  BYL_MCP_PRODUCTION_OAUTH_ENABLED:'1',BYL_MCP_ACCESS_ENABLED:'1',
  [FLAG]:on?'1':'0',...envOverride
 };
 const args={env,endpointRouting:()=>({port:8797,paths:['/oauth/mcp']}),
  getAccessConfig:()=>({enabled:true,issuer:'synthetic'}),
  resolveAccessPrincipal:async jwt=>{
   if(jwt==='valid-authorized-identity')return {kind:'cloudflare-access',canOperate:true,subjectHash:'fixture-user'};
   if(jwt==='valid-readonly-identity')return {kind:'cloudflare-access',canOperate:false,subjectHash:'fixture-reader'};
   throw Error('ACCESS_DENIED');
  },
  bearerToken:bearer,allowedHosts:hosts,
  createMcpExpressApp:settings=>{app.settings=settings;return app;},
  StreamableHTTPServerTransport:FakeHTTPTransport,McpServer:FakeMcpServer,z,
  agentGet:async()=>({tools:[]}),
  agentCall:async(...x)=>{agentCalls.push(x);return {result:'harmless'};},
  canExposeRemoteCall:p=>p.canOperate===true,
  authorizeRemoteCall:(_p,_d,name,args)=>({name,arguments:args}),
  auditLegacyOperation:e=>{audit.push(e);return true;},
  auditOperation:e=>{audit.push(e);return true;},
  logger:{error:message=>logs.push(message)}
 };
 return {args,app,routes,audit,agentCalls,logs,bearer};
}
function response(){
 const r={statusCode:200,headersSent:false,body:null,closer:null,
  status(code){this.statusCode=code;return this;},
  json(value){this.headersSent=true;this.body=value;return this;},
  once(event,fn){if(event==='close')this.closer=fn;return this;}
 };
 return r;
}
async function invoke(f,method,path,headers={}){
 const routes=f.routes.get(method+':'+path);
 assert(routes,'Expected route '+method+':'+path);
 const req={headers,body:{jsonrpc:'2.0',method:'tools/list',id:1}};
 const res=response();
 let nexted=false;
 if(routes.length===1)await routes[0](req,res);
 else{
  await routes[0](req,res,()=>{nexted=true;});
  if(nexted)await routes[1](req,res);
 }
 return {res,req,nexted};
}
test('constructor never listens and never embeds production connection details',()=>{
 const f=fixture(),out=createCredentialFreeOAuthHttpRuntime(f.args);
 assert.equal(out.listens,false);
 assert.equal(out.requiresSeparateLaunchApproval,true);
 assert.deepEqual(out.paths,['/oauth/mcp']);
 assert.deepEqual([...f.routes.keys()].sort(),[
  'delete:/oauth/mcp','get:/healthz','get:/oauth/mcp','post:/oauth/mcp'
 ]);
 assert.equal(f.app.settings.host,'127.0.0.1');
 assert.equal(servers.length,0);
 assert.equal(transports.length,0);
 assert.equal(JSON.stringify(out).includes(f.bearer),false);
});
test('unauthorized requests remain 401 without constructing an SDK server',async()=>{
 const f=fixture({on:true});createCredentialFreeOAuthHttpRuntime(f.args);
 for(const headers of [{}, {authorization:'Bearer incorrect-secret'},
  {'cf-access-jwt-assertion':'forged'}, {authorization:'Basic synthetic'}]){
  const {res}=await invoke(f,'post','/oauth/mcp',headers);
  assert.equal(res.statusCode,401);
  assert.equal(res.body.error.message,'Unauthorized');
 }
 assert.equal(servers.length,0);assert.equal(f.agentCalls.length,0);
});
test('existing bearer client sees exactly four legacy tools when flag is on',async()=>{
 const f=fixture({on:true});createCredentialFreeOAuthHttpRuntime(f.args);
 const {res}=await invoke(f,'post','/oauth/mcp',{authorization:'Bearer '+f.bearer});
 assert.equal(res.statusCode,200);
 assert.deepEqual(res.body.names,[
  'remote_list_devices','remote_list_tools','remote_call','remote_process_selftest'
 ]);
 assert.equal(res.body.principal,'internal');
 assert.equal(transports.length,1);
 assert.equal(transports[0].settings.enableJsonResponse,true);
 res.closer();res.closer();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(servers[0].closed,1);
 assert.equal(transports[0].closed,1);
});
test('authorized verified OAuth sees nine tool names when flag is on',async()=>{
 const f=fixture({on:true});createCredentialFreeOAuthHttpRuntime(f.args);
 const {res}=await invoke(f,'post','/oauth/mcp',{
  'cf-access-jwt-assertion':'valid-authorized-identity'});
 assert.equal(res.statusCode,200);
 assert.equal(res.body.names.length,9);
 assert.deepEqual(res.body.names.filter(x=>x.startsWith('dc_')),[
  'dc_read_file','dc_list_directory','dc_get_file_info','dc_list_sessions','dc_list_processes'
 ]);
 assert.equal(res.body.names.includes('dc_ping'),false);
});
test('read-only authenticated OAuth sees original three tools, no 500',async()=>{
 const f=fixture({on:true});createCredentialFreeOAuthHttpRuntime(f.args);
 const {res}=await invoke(f,'post','/oauth/mcp',{
  'cf-access-jwt-assertion':'valid-readonly-identity'});
 assert.equal(res.statusCode,200);
 assert.deepEqual(res.body.names,[
  'remote_list_devices','remote_list_tools','remote_process_selftest'
 ]);
});
test('when feature flag OFF, original OAuth operator has four tools',async()=>{
 const f=fixture();createCredentialFreeOAuthHttpRuntime(f.args);
 const {res}=await invoke(f,'post','/oauth/mcp',{
  'cf-access-jwt-assertion':'valid-authorized-identity'});
 assert.equal(res.body.names.length,4);
});
test('GET/DELETE on OAuth route remain authenticated method-not-allowed',async()=>{
 const f=fixture();createCredentialFreeOAuthHttpRuntime(f.args);
 for(const m of ['get','delete']){
  const denied=await invoke(f,m,'/oauth/mcp');
  assert.equal(denied.res.statusCode,401);
  const allowed=await invoke(f,m,'/oauth/mcp',{authorization:'Bearer '+f.bearer});
  assert.equal(allowed.res.statusCode,405);
  assert.equal(allowed.res.body.error.message,'Method not allowed');
 }
});
test('healthz remains sanitized and does not expose token or remote addresses',async()=>{
 const f=fixture();createCredentialFreeOAuthHttpRuntime(f.args);
 const {res}=await invoke(f,'get','/healthz');
 assert.equal(res.statusCode,200);
 assert.equal(res.body.ok,true);
 assert.equal(JSON.stringify(res.body).includes(f.bearer),false);
 assert.equal(JSON.stringify(res.body).includes('BYL_MCP_PARITY'),false);
});
test('bad flags or noncanonical route never create app or endpoint',()=>{
 for(const invalid of [
  {env:{BYL_MCP_STAGING:'1'}},
  {env:{BYL_MCP_ACCESS_ENABLED:'0'}},
  {endpointRouting:()=>({port:8792,paths:['/mcp']})},
  {endpointRouting:()=>({port:8797,paths:['/oauth/mcp','/mcp']})}
 ]){
  const f=fixture();const a={...f.args,...invalid,env:{...f.args.env,...(invalid.env||{})}};
  assert.throws(()=>createCredentialFreeOAuthHttpRuntime(a));
  assert.equal(f.routes.size,0);
 }
});
test('invalid host allowlists and missing enabled audit fail before route registration',()=>{
 for(const hosts of [['*','localhost'],['localhost','127.0.0.1','https://private.example'],
  ['localhost'],['localhost','127.0.0.1','evil host']]){
  const f=fixture({hosts});
  assert.throws(()=>createCredentialFreeOAuthHttpRuntime(f.args),
   {message:'PARITY_HOST_ALLOWLIST_INVALID'});
  assert.equal(f.routes.size,0);
 }
 const f=fixture({on:true});f.args.auditOperation=null;
 assert.throws(()=>createCredentialFreeOAuthHttpRuntime(f.args),
  {message:'PARITY_RUNTIME_POLICY_INCOMPLETE'});
 assert.equal(f.routes.size,0);
});
test('unhandled transport failures are sanitized, never echo stack or bearer',async()=>{
 const f=fixture();
 f.args.StreamableHTTPServerTransport=class{
  constructor(){}async handleRequest(){throw Error('DO NOT LEAK '+f.bearer);}
  async close(){}
 };
 createCredentialFreeOAuthHttpRuntime(f.args);
 const {res}=await invoke(f,'post','/oauth/mcp',{authorization:'Bearer '+f.bearer});
 assert.equal(res.statusCode,500);
 assert.deepEqual(f.logs,['PARITY_MCP_HANDLER_FAILURE']);
 assert.equal(JSON.stringify(res.body).includes(f.bearer),false);
});


test('client abort before response completes closes MCP session exactly once',async()=>{
 const f=fixture();
 let entered;
 const enteredPromise=new Promise(resolve=>{entered=resolve;});
 let release;
 const wait=new Promise(resolve=>{release=resolve;});
 f.args.StreamableHTTPServerTransport=class{
  constructor(){this.closed=0;transports.push(this);}
  async handleRequest(){entered();await wait;}
  async close(){this.closed++;}
 };
 createCredentialFreeOAuthHttpRuntime(f.args);
 const handlers=f.routes.get('post:/oauth/mcp');
 const req={headers:{authorization:'Bearer '+f.bearer},body:{}};
 const res=response();
 let approved=false;
 await handlers[0](req,res,()=>{approved=true;});
 assert.equal(approved,true);
 const executing=handlers[1](req,res);
 await enteredPromise;
 assert.equal(servers.length,1);
 assert.equal(typeof res.closer,'function');
 res.closer();
 res.closer();
 release();
 await executing;
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(servers[0].closed,1);
 assert.equal(transports[0].closed,1);
});


test('verified operator takes precedence when bearer and Access JWT are both present',async()=>{
 const f=fixture({on:true});createCredentialFreeOAuthHttpRuntime(f.args);
 const {res}=await invoke(f,'post','/oauth/mcp',{
  authorization:'Bearer '+f.bearer,
  'cf-access-jwt-assertion':'valid-authorized-identity'
 });
 assert.equal(res.statusCode,200);
 assert.equal(res.body.principal,'cloudflare-access');
 assert.deepEqual(res.body.names.filter(name=>name.startsWith('dc_')),[
  'dc_read_file','dc_list_directory','dc_get_file_info',
  'dc_list_sessions','dc_list_processes'
 ]);
 assert.equal(res.body.names.length,9);
 assert.equal(f.agentCalls.length,0);
});

test('verified read-only Access principal is not promoted by a valid internal bearer',async()=>{
 const f=fixture({on:true});createCredentialFreeOAuthHttpRuntime(f.args);
 const {res}=await invoke(f,'post','/oauth/mcp',{
  authorization:'Bearer '+f.bearer,
  'cf-access-jwt-assertion':'valid-readonly-identity'
 });
 assert.equal(res.statusCode,200);
 assert.equal(res.body.principal,'cloudflare-access');
 assert.deepEqual(res.body.names,[
  'remote_list_devices','remote_list_tools','remote_process_selftest'
 ]);
});

test('bad or malformed Access assertion with a valid bearer is rejected, not downgraded',async()=>{
 const f=fixture({on:true});createCredentialFreeOAuthHttpRuntime(f.args);
 for(const assertion of ['forged','',[],['valid-authorized-identity'],'x'.repeat(8193)]){
  const {res}=await invoke(f,'post','/oauth/mcp',{
   authorization:'Bearer '+f.bearer,
   'cf-access-jwt-assertion':assertion
  });
  assert.equal(res.statusCode,401);
  assert.equal(res.body.error.message,'Unauthorized');
 }
 assert.equal(servers.length,0);
 assert.equal(f.agentCalls.length,0);
});

test('verified Access operator does not need the internal service bearer',async()=>{
 const f=fixture({on:true});createCredentialFreeOAuthHttpRuntime(f.args);
 const {res}=await invoke(f,'post','/oauth/mcp',{
  authorization:'Bearer invalid-bearer',
  'cf-access-jwt-assertion':'valid-authorized-identity'
 });
 assert.equal(res.statusCode,200);
 assert.equal(res.body.principal,'cloudflare-access');
 assert.equal(res.body.names.length,9);
});

test('Core-5 OFF preserves original four tools for verified dual credentials',async()=>{
 const f=fixture({on:false});createCredentialFreeOAuthHttpRuntime(f.args);
 const {res}=await invoke(f,'post','/oauth/mcp',{
  authorization:'Bearer '+f.bearer,
  'cf-access-jwt-assertion':'valid-authorized-identity'
 });
 assert.equal(res.statusCode,200);
 assert.equal(res.body.principal,'cloudflare-access');
 assert.equal(res.body.names.length,4);
 assert.equal(res.body.names.some(name=>name.startsWith('dc_')),false);
});
