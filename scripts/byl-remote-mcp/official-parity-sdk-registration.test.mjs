import test from 'node:test';
import assert from 'node:assert/strict';
import {registerOfficialParityV1} from './official-parity-sdk-registration.mjs';
const basic={min(){return this},max(){return this},int(){return this},optional(){return this}};
const z={string:()=>({...basic}),number:()=>({...basic}),enum:()=>({...basic})};
function fixture({enabled=true,operatorGranted=true}={}){
 const handlers=new Map();
 const server={registerTool(name,_meta,handler){
  if(handlers.has(name))throw Error('NAME_COLLISION');
  handlers.set(name,handler);
 }};
 const oldHandler=async()=>({content:[{type:'text',text:'legacy'}]});
 for(const name of ['remote_list_devices','remote_list_tools','remote_call','remote_process_selftest'])
  server.registerTool(name,{},oldHandler);
 const principal={kind:'cloudflare-access',canOperate:true};
 const canExposeRemoteCall=()=>operatorGranted;
 const authorizeRemoteCall=(_p,_id,name,args)=>{
  if(!operatorGranted)throw Error('OPERATOR_DENIED');
  return {name,arguments:args};
 };
 const delegate=async()=>({text:'OBSERVED'});
 const authorizeHealth=async()=>operatorGranted;
 const monitor={list:async()=>[{id:'us-macmini',state:'unknown',verified:false}],
  check:async deviceId=>({id:deviceId,state:'unknown',verified:false})};
 return {server,handlers,oldHandler,principal,canExposeRemoteCall,authorizeRemoteCall,delegate,authorizeHealth,monitor,enabled};
}
test('disabled by default: register zero new tools',()=>{
 const f=fixture({enabled:false});
 assert.throws(()=>registerOfficialParityV1({...f,z}),{message:'PARITY_NOT_ACTIVATED'});
 assert.equal(f.handlers.size,4);
});
test('A4 phase 1 exposes five direct core reads without signed Agent dependencies',()=>{
 const f=fixture();
 const names=registerOfficialParityV1({...f,z,monitor:null,authorizeHealth:null});
 assert.deepEqual(names,[
  'dc_read_file','dc_list_directory','dc_get_file_info','dc_list_sessions','dc_list_processes'
 ]);
 assert.equal(f.handlers.size,9);
 for(const n of ['remote_list_devices','remote_list_tools','remote_call','remote_process_selftest'])
  assert.equal(f.handlers.get(n),f.oldHandler);
 assert.equal(names.some(n=>n.includes('start_process')||n.includes('write')||n.includes('terminate')),false);
 assert.equal(f.handlers.has('dc_ping'),false);
});
test('A4 phase 2 adds signed Ping only when independently verified',()=>{
 const f=fixture();
 const names=registerOfficialParityV1({...f,z,mode:'signed-health',signedAgentEvidenceVerified:true});
 assert.deepEqual(names,[
  'dc_read_file','dc_list_directory','dc_get_file_info','dc_list_sessions',
  'dc_list_processes','dc_list_devices_live','dc_ping'
 ]);
 assert.equal(f.handlers.size,11);
 for(const n of ['remote_list_devices','remote_list_tools','remote_call','remote_process_selftest'])
  assert.equal(f.handlers.get(n),f.oldHandler);
});
test('signed Agent absent or unverified fails before any new tool is registered',()=>{
 for(const overrides of [
  {mode:'signed-health'},
  {mode:'signed-health',signedAgentEvidenceVerified:true,monitor:null},
  {mode:'signed-health',signedAgentEvidenceVerified:true,authorizeHealth:null}
 ]){
  const f=fixture();
  assert.throws(()=>registerOfficialParityV1({...f,z,...overrides}),
   {message:'PARITY_SIGNED_HEALTH_NOT_VERIFIED'});
  assert.equal(f.handlers.size,4);
 }
});
test('unknown mode or unauthorized server cannot register any tool',()=>{
 const f=fixture();
 assert.throws(()=>registerOfficialParityV1({...f,z,mode:'full-access'}),
  {message:'PARITY_MODE_DENIED'});
 assert.equal(f.handlers.size,4);
});
test('incomplete core dependencies fail before registration',()=>{
 const f=fixture();
 assert.throws(()=>registerOfficialParityV1({...f,z,delegate:null}),
  {message:'PARITY_REGISTRATION_INCOMPLETE'});
 assert.equal(f.handlers.size,4);
});
test('legacy Operator Policy still rejects read and process diagnostics',async()=>{
 const f=fixture({operatorGranted:false});
 registerOfficialParityV1({...f,z,canExposeRemoteCall:()=>true});
 for(const [name,args] of [
  ['dc_read_file',{deviceId:'windows',path:'/tmp/example'}],
  ['dc_list_sessions',{deviceId:'windows'}]]){
  assert.equal((await f.handlers.get(name)(args)).isError,true);
 }
});
test('health Operator Policy denial is independent of file policy',async()=>{
 const f=fixture({operatorGranted:false});
 registerOfficialParityV1({...f,z,mode:'signed-health',signedAgentEvidenceVerified:true,canExposeRemoteCall:()=>true});
 assert.equal((await f.handlers.get('dc_ping')({deviceId:'us-macmini'})).isError,true);
});
test('unverified principal is refused before registration',()=>{
 const f=fixture();
 assert.throws(()=>registerOfficialParityV1({...f,z,
  principal:{kind:'anonymous',canOperate:true}}),
 {message:'PARITY_PRINCIPAL_NOT_VERIFIED'});
 assert.equal(f.handlers.size,4);
});

test('new tool names invisible when installed Operator Policy hides remote_call',()=>{
 const f=fixture({operatorGranted:false});
 assert.throws(()=>registerOfficialParityV1({...f,z}),
  {message:'PARITY_OPERATOR_VISIBILITY_DENIED'});
 assert.equal(f.handlers.size,4);
});
test('an invalid exposure predicate cannot expose partial new tool registry',()=>{
 for(const injected of [null,()=>{throw Error('unexpected');},()=>undefined,()=>1]){
  const f=fixture();
  const expected=injected===null?'PARITY_OPERATOR_VISIBILITY_REQUIRED':'PARITY_OPERATOR_VISIBILITY_DENIED';
  assert.throws(()=>registerOfficialParityV1({...f,z,canExposeRemoteCall:injected}),
   {message:expected});
  assert.equal(f.handlers.size,4);
 }
});
