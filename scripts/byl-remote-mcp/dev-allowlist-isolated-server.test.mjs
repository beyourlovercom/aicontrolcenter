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
function factory({Server=FakeServer,allowMutatingTools=false,authenticated=true,operatorGrant=true}={}){
 let calls=0;
 const service=Object.fromEntries(['prepare','apply','rollback','status']
   .map(k=>[k,async()=>{calls++;return {project:'byl-wordpress-core',releaseId:'dev-test-release',state:k,digest:'a'.repeat(64)};}]));
 const server=createIsolatedDevMcpServer({
   Server,ListToolsRequestSchema:listSchema,CallToolRequestSchema:callSchema,
   resolvePrincipal:async()=>authenticated?{sub:'trusted-server-principal'}:null,
   authorizeTool:async()=>operatorGrant,service,allowMutatingTools
 });
 return {server,calls:()=>calls,list:server.handlers.get('list'),call:server.handlers.get('call')};
}
test('constructor ALWAYS creates separate isolated server with correct identity',()=>{
 const s=factory().server;
 assert.equal(s.identity.name,'aicc-dev-deployment-isolated');
 assert.deepEqual(s.options,{capabilities:{tools:{}}});
 assert.equal(s.handlers.size,2);
});
test('default only exposes status, never prepare/apply/rollback even with operator grant',async()=>{
 const f=factory();
 const tools=(await f.list({},{})).tools.map(x=>x.name);
 assert.deepEqual(tools,['dev_release_status']);
 for(const action of ['prepare','apply','rollback']){
   const r=await f.call({params:{name:'dev_release_'+action,arguments:{manifest:{}}}},{});
   assert.equal(r.isError,true);
 }
 assert.equal(f.calls(),0);
});
test('default status may be called read-only by trusted authorized principal',async()=>{
 const f=factory();
 const result=await f.call({params:{name:'dev_release_status',
   arguments:{project:'byl-wordpress-core',releaseId:'dev-test-release'}}},{});
 assert.equal(result.isError,undefined);assert.equal(f.calls(),1);
});
test('operator denial means neither status visibility nor invocation',async()=>{
 const f=factory({operatorGrant:false});
 assert.deepEqual((await f.list({},{})).tools,[]);
 const r=await f.call({params:{name:'dev_release_status',arguments:{
   project:'byl-wordpress-core',releaseId:'dev-test-release'}}},{});
 assert.equal(r.isError,true);assert.equal(f.calls(),0);
});
test('anonymous principal does not see or call isolated tools',async()=>{
 const f=factory({authenticated:false});
 assert.deepEqual((await f.list({},{})).tools,[]);
 assert.equal((await f.call({params:{name:'dev_release_status',
  arguments:{project:'byl-wordpress-core',releaseId:'dev-test-release'}}},{})).isError,true);
 assert.equal(f.calls(),0);
});
test('explicit trusted mutating-mode switch still requires operator authorization',async()=>{
 const f=factory({allowMutatingTools:true,operatorGrant:false});
 assert.deepEqual((await f.list({},{})).tools,[]);
 assert.equal((await f.call({params:{name:'dev_release_apply',arguments:{manifest:{}}}},{})).isError,true);
 assert.equal(f.calls(),0);
});
test('fresh instance guard rejects a constructor reusing a previously returned server',()=>{
 const singleton=new FakeServer({name:'incompatible-existing'},{capabilities:{tools:{}}});
 function ReusedServer(){return singleton;}
 const f=factory({Server:ReusedServer});
 assert.equal(f.server,singleton);
 assert.throws(()=>factory({Server:ReusedServer}),{message:'MCP_SERVER_NOT_FRESH'});
});
test('unconfigured SDK/authorization fails closed before new server is used',()=>{
 assert.throws(()=>createIsolatedDevMcpServer(),{message:'ISOLATED_DEV_MCP_NOT_CONFIGURED'});
 assert.throws(()=>createIsolatedDevMcpServer({Server:FakeServer,authorizeTool:()=>true,
  resolvePrincipal:()=>({}),service:{},allowMutatingTools:'yes'}),
  {message:'ISOLATED_DEV_MCP_NOT_CONFIGURED'});
});
