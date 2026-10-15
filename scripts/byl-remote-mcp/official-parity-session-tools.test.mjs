import test from 'node:test';
import assert from 'node:assert/strict';
import {registerParitySessionTools} from './official-parity-session-tools.mjs';
function setup({deny=false}={}){
 const map=new Map(),calls=[];
 const server={registerTool(name,_,handler){map.set(name,handler)}};
 const z={enum:()=>({})},principal={kind:'cloudflare-access',canOperate:true};
 registerParitySessionTools({server,z,principal,
  authorizeRemoteCall:(_,id,name,args)=>{
   if(deny)throw Error('OPERATOR_DENIED');
   return {name,arguments:args};
  },delegate:async x=>{calls.push(x);return {text:'[]'};}
 });
 return {map,calls};
}
test('session and process tools are read-only direct tool registrations',()=>{
 const s=setup();assert.deepEqual([...s.map.keys()],['dc_list_sessions','dc_list_processes']);
});
test('device scoping routes to the corresponding existing tool',async()=>{
 const s=setup();const out=await s.map.get('dc_list_sessions')({deviceId:'007windows'});
 assert.equal(out.isError,undefined);
 assert.deepEqual(s.calls,[{deviceId:'007windows',name:'list_sessions',arguments:{}}]);
});
test('caller cannot override delegated command or target',async()=>{
 const s=setup();for(const args of [
  {deviceId:'us-macmini',name:'start_process'},
  {deviceId:'bad-host'},
  {deviceId:'us-macmini',arguments:{command:'whoami'}}
 ]){
  assert.equal((await s.map.get('dc_list_processes')(args)).isError,true);
 }
 assert.equal(s.calls.length,0);
});
test('existing Operator Policy denial blocks diagnostic delegation',async()=>{
 const s=setup({deny:true});
 assert.equal((await s.map.get('dc_list_processes')({deviceId:'windows'})).isError,true);
 assert.equal(s.calls.length,0);
});
test('missing verified user cannot even register tool',()=>{
 assert.throws(()=>registerParitySessionTools({
  server:{registerTool(){}},z:{enum:()=>({})},principal:{kind:'anonymous'},
  authorizeRemoteCall:()=>({}),delegate:async()=>({text:''})
 }),{message:'PARITY_SESSION_REGISTRATION_DENIED'});
});
