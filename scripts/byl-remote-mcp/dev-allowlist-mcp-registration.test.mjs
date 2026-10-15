import test from 'node:test';
import assert from 'node:assert/strict';
import {registerDevAllowlistMcpHandlers} from './dev-allowlist-mcp-registration.mjs';
function setup({authenticated=true,canList=true,canCall=true}={}){
 const handlers=new Map(),server={setRequestHandler(schema,fn){handlers.set(schema.name,fn);}};
 let count=0;
 const service=Object.fromEntries(['prepare','apply','rollback','status'].map(op=>
  [op,async()=>{count++;return {project:'byl-wordpress-core',releaseId:'release-20261014',state:'PREPARED',digest:'a'.repeat(64)};}]));
 const list={name:'list'},call={name:'call'};
 registerDevAllowlistMcpHandlers({server,ListToolsRequestSchema:list,
  CallToolRequestSchema:call,service,
  resolvePrincipal:async()=>authenticated?{subject:'verified-oauth-user'}:null,
  authorizeTool:async({operation})=>operation==='list'?canList:canCall});
 return {list:handlers.get('list'),call:handlers.get('call'),calls:()=>count};
}
test('anonymous cannot enumerate registered Dev tools',async()=>{
 const f=setup({authenticated:false});
 assert.deepEqual(await f.list({},{}),{tools:[]});
 assert.equal((await f.call({params:{name:'dev_release_apply',arguments:{manifest:{}}}},{})).isError,true);
 assert.equal(f.calls(),0);
});
test('authenticated principals see only explicitly operator-authorized tools',async()=>{
 const f=setup({canList:false});
 assert.deepEqual(await f.list({},{}),{tools:[]});
 assert.equal((await f.call({params:{name:'dev_release_apply',arguments:{manifest:{}}}},{})).isError,true);
 assert.equal(f.calls(),0);
});
test('Dev sidecar tool registration exposes exactly four registered schemas',async()=>{
 const f=setup();
 const tools=(await f.list({},{})).tools;
 assert.deepEqual(tools.map(x=>x.name),['dev_release_prepare','dev_release_apply','dev_release_rollback','dev_release_status']);
 assert.ok(tools.every(x=>x.inputSchema.additionalProperties===false));
});
test('valid status route does not accept supplied identity or arbitrary command',async()=>{
 const f=setup();
 const reject=await f.call({params:{name:'dev_release_status',arguments:{project:'byl-wordpress-core',releaseId:'release-20261014',principal:{admin:true}}}},{});
 assert.equal(reject.isError,true);assert.equal(f.calls(),0);
 const ok=await f.call({params:{name:'dev_release_status',arguments:{project:'byl-wordpress-core',releaseId:'release-20261014'}}},{});
 assert.equal(ok.isError,undefined);assert.equal(f.calls(),1);
});
test('service call requires separate action-level grant after tool visibility',async()=>{
 const f=setup({canCall:false});
 const deny=await f.call({params:{name:'dev_release_status',arguments:{project:'byl-wordpress-core',releaseId:'release-20261014'}}},{});
 assert.equal(deny.isError,true);assert.equal(f.calls(),0);
});
test('registration fails closed without server-owned identity resolver',()=>{
 assert.throws(()=>registerDevAllowlistMcpHandlers(),{message:'FORMAL_MCP_REGISTRATION_NOT_CONFIGURED'});
});
