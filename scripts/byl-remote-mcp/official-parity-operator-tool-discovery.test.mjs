import test from 'node:test';
import assert from 'node:assert/strict';
import {filterDiscoveredAgentTools} from './official-parity-operator-tool-discovery.mjs';
const operator={kind:'cloudflare-access',canOperate:true};
const capabilities={tools:[{name:'get_config'},{name:'read_file'},{name:'start_process'}]};
const filtered=(deviceId,resolver,principal=operator,agentReply=capabilities)=>
 filterDiscoveredAgentTools({agentReply,principal,deviceId,
   listAuthorizedRemoteToolNames:resolver});

test('discovery hides get_config where operator policy denies it',()=>{
 const actual=filtered('windows',()=>['read_file','start_process']);
 assert.deepEqual(actual.tools.map(x=>x.name),['read_file','start_process']);
});
test('device-specific existing get_config permission is preserved',()=>{
 const resolver=(_principal,device)=>device==='007windows'
   ? ['get_config','read_file','start_process']:['read_file','start_process'];
 assert.deepEqual(filtered('007windows',resolver).tools.map(x=>x.name),
  ['get_config','read_file','start_process']);
 assert.deepEqual(filtered('china-mac',resolver).tools.map(x=>x.name),
  ['read_file','start_process']);
});
test('read-only identity gets no privileged tool metadata',()=>{
 let called=false;
 const result=filtered('windows',()=>{called=true;return ['read_file'];},
  {kind:'cloudflare-access',canOperate:false});
 assert.deepEqual(result,{tools:[]});assert.equal(called,false);
});
test('missing or malformed policy fails closed; never returns raw agent inventory',()=>{
 for(const resolver of [undefined,()=>null,()=>({'read_file':true}),
  ()=>['read_file','INVALID-TOOL'],()=>Promise.resolve(['read_file'])]){
  assert.throws(()=>filtered('windows',resolver),/OPERATOR_DISCOVERY_POLICY/);
 }
});
test('upstream capabilities cannot authorize names policy did not grant',()=>{
 assert.deepEqual(filtered('windows',()=>['read_file','not_installed']).tools,
  [{name:'read_file'}]);
});
test('invalid, duplicate and oversized agent metadata fails closed',()=>{
 for(const agentReply of [{tools:[{name:'read_file'},{name:'read_file'}]},
  {tools:[{name:'get-config'}]},{tools:'not-array'},
  {tools:Array.from({length:129},(_,i)=>({name:'t'+i}))}]){
  assert.throws(()=>filtered('windows',()=>['read_file'],operator,agentReply),
   /OPERATOR_DISCOVERY_AGENT_INVALID/);
 }
});
test('internal principal retains only names approved by its trusted policy',()=>{
 const x=filtered('windows',()=>new Set(['start_process']),
  {kind:'internal',canOperate:true});
 assert.deepEqual(x.tools.map(y=>y.name),['start_process']);
});
