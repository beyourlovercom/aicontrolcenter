import test from 'node:test';
import assert from 'node:assert/strict';
import {createIsolatedDevMcpServer} from './dev-allowlist-isolated-server.mjs';

class FakeServer{
 constructor(identity,options){
   this.identity=identity;this.options=options;this.handlers=new Map();
 }
 setRequestHandler(schema,handler){
   if(this.handlers.has(schema.key))throw Error('DUPLICATE_HANDLER');
   this.handlers.set(schema.key,handler);
 }
}
const listSchema={key:'list'},callSchema={key:'call'};
function factory({Server=FakeServer,authenticated=true,operatorGrant=true}={}){
 const server=createIsolatedDevMcpServer({
   Server,ListToolsRequestSchema:listSchema,CallToolRequestSchema:callSchema,
   resolvePrincipal:async()=>authenticated?{sub:'verified-oauth-principal'}:null,
   authorizeTool:async()=>operatorGrant
 });
 return {server,list:server.handlers.get('list'),call:server.handlers.get('call')};
}
const statusArguments={project:'byl-wordpress-core',releaseId:'g1-smoke-release'};
test('constructor creates fresh separate isolated server with exact identity',()=>{
 const s=factory().server;
 assert.equal(s.identity.name,'aicc-dev-deployment-isolated');
 assert.deepEqual(s.options,{capabilities:{tools:{}}});
 assert.equal(s.handlers.size,2);
});
test('G1 exposes exactly dev_release_status, even when operator grants everything',async()=>{
 const f=factory();
 assert.deepEqual((await f.list({},{})).tools.map(t=>t.name),['dev_release_status']);
 for(const action of ['prepare','apply','rollback']){
  const r=await f.call({params:{name:'dev_release_'+action,arguments:{manifest:{}}}},{});
  assert.equal(r.isError,true);
 }
});
test('authorized status returns explicit NOT_ENABLED, not real deploy receipt',async()=>{
 const f=factory();
 const result=await f.call({params:{name:'dev_release_status',arguments:statusArguments}},{});
 assert.equal(result.isError,undefined);
 assert.deepEqual(JSON.parse(result.content[0].text),{
  project:'byl-wordpress-core',releaseId:'g1-smoke-release',state:'NOT_ENABLED',digest:null
 });
});
test('operator denial removes visibility and invocation',async()=>{
 const f=factory({operatorGrant:false});
 assert.deepEqual((await f.list({},{})).tools,[]);
 assert.equal((await f.call({params:{name:'dev_release_status',arguments:statusArguments}},{})).isError,true);
});
test('anonymous principal removes visibility and invocation',async()=>{
 const f=factory({authenticated:false});
 assert.deepEqual((await f.list({},{})).tools,[]);
 assert.equal((await f.call({params:{name:'dev_release_status',arguments:statusArguments}},{})).isError,true);
});
test('caller cannot inject a fake OAuth principal in tool arguments',async()=>{
 const f=factory();
 const r=await f.call({params:{name:'dev_release_status',arguments:{
  ...statusArguments,principal:{sub:'admin'}
 }}},{});
 assert.equal(r.isError,true);
});
test('trusted server cannot configure any mutation mode or inject filesystem release service',()=>{
 const base={Server:FakeServer,ListToolsRequestSchema:listSchema,
  CallToolRequestSchema:callSchema,resolvePrincipal:async()=>({sub:'u'}),
  authorizeTool:async()=>true};
 for(const extra of [
  {allowMutatingTools:true},{allowMutatingTools:false},
  {service:{status:async()=>({state:'APPLIED'})}},
  {receiver:{apply:async()=>true}},
  {command:'node arbitrary-deploy.js'}
 ]){
  assert.throws(()=>createIsolatedDevMcpServer({...base,...extra}),
   {message:'G1_MUTATING_CONFIGURATION_DENIED'});
 }
});
test('a reused existing SDK server is rejected',()=>{
 const singleton=new FakeServer({name:'existing-oauth-dc'},{capabilities:{tools:{}}});
 function ReusedServer(){return singleton;}
 factory({Server:ReusedServer});
 assert.throws(()=>factory({Server:ReusedServer}),{message:'MCP_SERVER_NOT_FRESH'});
});
test('missing identity resolver and malformed input reject before server creation',()=>{
 assert.throws(()=>createIsolatedDevMcpServer(),{message:'ISOLATED_DEV_MCP_NOT_CONFIGURED'});
 assert.throws(()=>createIsolatedDevMcpServer(null),{message:'G1_MUTATING_CONFIGURATION_DENIED'});
});
test('legacy OAuth/DC tool handler objects remain untouched',async()=>{
 const legacy=new FakeServer({name:'existing-oauth-dc'},{capabilities:{tools:{}}});
 const oldList=async()=>({tools:['remote_list_devices','remote_call',
  'remote_list_tools','remote_process_selftest'].map(name=>({name}))});
 const oldCall=async()=>({content:[{type:'text',text:'EXISTING_HANDLER'}]});
 legacy.setRequestHandler(listSchema,oldList);
 legacy.setRequestHandler(callSchema,oldCall);
 const sidecar=factory();
 assert.notEqual(sidecar.server,legacy);
 assert.equal(legacy.handlers.get('list'),oldList);
 assert.equal(legacy.handlers.get('call'),oldCall);
 assert.deepEqual((await legacy.handlers.get('list')()).tools.map(x=>x.name),
 ['remote_list_devices','remote_call','remote_list_tools','remote_process_selftest']);
 assert.deepEqual((await sidecar.list({},{})).tools.map(x=>x.name),['dev_release_status']);
});
