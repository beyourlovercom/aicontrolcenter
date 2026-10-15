import test from 'node:test';
import assert from 'node:assert/strict';
import {DEV_DEPLOY_TOOL_SPECS,makeDevToolDispatcher} from './dev-allowlist-mcp-tools.mjs';
function setup(auth=true){
 let calls=0;const service=Object.fromEntries(['prepare','apply','rollback','status'].map(s=>[s,async()=>{calls++;return {project:'byl-wordpress-core',releaseId:'release-001',state:s.toUpperCase(),digest:'a'.repeat(64)};}]));
 return {dispatch:makeDevToolDispatcher({service,authorizeTool:async()=>auth}),calls:()=>calls};
}
test('four exact names, no arbitrary command transport',()=>{
 assert.deepEqual(DEV_DEPLOY_TOOL_SPECS.map(t=>t.name),
 ['dev_release_prepare','dev_release_apply','dev_release_rollback','dev_release_status']);
 for(const tool of DEV_DEPLOY_TOOL_SPECS)assert.equal(tool.inputSchema.additionalProperties,false);
});
test('unknown tool cannot be routed to arbitrary process',async()=>{
 const f=setup();
 const v=await f.dispatch({name:'start_process',arguments:{command:'rm -rf /'}});
 assert.equal(v.isError,true);assert.equal(f.calls(),0);
});
test('server-side authorization required, even for status',async()=>{
 const f=setup(false);
 for(const name of DEV_DEPLOY_TOOL_SPECS.map(t=>t.name)){
  const a= name==='dev_release_status'?{project:'byl-wordpress-core',releaseId:'release-001'}:{manifest:{}};
  assert.equal((await f.dispatch({name,arguments:a})).isError,true);
 }
 assert.equal(f.calls(),0);
});
test('excess user arguments are denied before authority and service',async()=>{
 const f=setup();
 const x=await f.dispatch({name:'dev_release_apply',arguments:{manifest:{},command:'echo anything'}});
 assert.equal(x.isError,true);assert.equal(f.calls(),0);
});
test('authorized status is read-only and only returns receipt fields',async()=>{
 const f=setup();
 const x=await f.dispatch({name:'dev_release_status',arguments:{project:'byl-wordpress-core',releaseId:'release-001'}});
 assert.equal(x.isError,undefined);assert.equal(f.calls(),1);
 const o=JSON.parse(x.content[0].text);
 assert.deepEqual(Object.keys(o),['project','releaseId','state','digest']);
});
test('invalid adapter and internal error are safe',async()=>{
 assert.throws(()=>makeDevToolDispatcher(),{message:'DEV_TOOL_NOT_CONFIGURED'});
 const dispatch=makeDevToolDispatcher({authorizeTool:async()=>true,service:Object.fromEntries(['prepare','apply','rollback','status'].map(k=>[k,async()=>{throw Error('sensitive host token');}]))});
 const result=await dispatch({name:'dev_release_prepare',arguments:{manifest:{}}});
 assert.equal(result.isError,true);
 assert.equal(result.content[0].text,'DEPLOY_ERROR');
});
