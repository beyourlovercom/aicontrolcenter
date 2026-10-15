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
 // Existing production tool handlers are on the same test server.
 const oldHandler=async()=>({content:[{type:'text',text:'legacy'}]});
 for(const name of ['remote_list_devices','remote_list_tools','remote_call','remote_process_selftest'])
  server.registerTool(name,{},oldHandler);
 const principal={kind:'cloudflare-access',canOperate:true};
 const authorizeRemoteCall=(_p,_id,name,args)=>{
  if(!operatorGranted)throw Error('OPERATOR_DENIED');
  return {name,arguments:args};
 };
 const delegate=async()=>({text:'OBSERVED'});
 const authorizeHealth=async()=>operatorGranted;
 const monitor={list:async()=>[{id:'us-macmini',state:'unknown',verified:false}],
  check:async deviceId=>({id:deviceId,state:'unknown',verified:false})};
 return {server,handlers,oldHandler,principal,authorizeRemoteCall,delegate,authorizeHealth,monitor,enabled};
}
test('disabled by default: never register a new tool',()=>{
 const f=fixture({enabled:false});
 assert.throws(()=>registerOfficialParityV1(f),{message:'PARITY_NOT_ACTIVATED'});
 assert.equal(f.handlers.size,4);
});
test('one verified OAuth server session can expose 7 new read-only tools',()=>{
 const f=fixture();
 const names=registerOfficialParityV1({...f,z});
 assert.deepEqual(names,[
  'dc_read_file','dc_list_directory','dc_get_file_info',
  'dc_list_sessions','dc_list_processes','dc_list_devices_live','dc_ping'
 ]);
 assert.equal(f.handlers.size,11);
 for(const n of ['remote_list_devices','remote_list_tools','remote_call','remote_process_selftest'])
  assert.equal(f.handlers.get(n),f.oldHandler);
 assert.equal(names.some(n=>n.includes('start_process')||n.includes('write')||n.includes('terminate')),false);
});
test('no injected command or device can replace the existing operator gate',async()=>{
 const f=fixture({operatorGranted:false});
 registerOfficialParityV1({...f,z});
 for(const [name,args] of [
  ['dc_read_file',{deviceId:'windows',path:'/tmp/example'}],
  ['dc_list_sessions',{deviceId:'windows'}],
  ['dc_ping',{deviceId:'windows'}]]){
   assert.equal((await f.handlers.get(name)(args)).isError,true);
 }
});
test('incomplete health service is rejected before any partial tool registration',()=>{
 const f=fixture();
 assert.throws(()=>registerOfficialParityV1({...f,z,monitor:null}),
 {message:'PARITY_REGISTRATION_INCOMPLETE'});
 assert.equal(f.handlers.size,4);
});
test('fake principal is refused without registering any new tools',()=>{
 const f=fixture();
 assert.throws(()=>registerOfficialParityV1({...f,z,
  principal:{kind:'anonymous',canOperate:true}}),
 {message:'PARITY_PRINCIPAL_NOT_VERIFIED'});
 assert.equal(f.handlers.size,4);
});
