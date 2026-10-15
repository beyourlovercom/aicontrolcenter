import test from 'node:test';
import assert from 'node:assert/strict';
import {registerParityReadTools} from './official-parity-read-tools.mjs';
const fakeZ=(()=>{
 const node={min(){return this},max(){return this},int(){return this},optional(){return this}};
 return {string:()=>({...node}),number:()=>({...node}),enum:()=>({...node})};
})();
function setup({principal={kind:'cloudflare-access',canOperate:true},deny=false,reply={text:'[FILE] hello.txt'}}={}){
 const registered=new Map(),calls=[];
 const server={registerTool(name,meta,handler){if(registered.has(name))throw Error('DUPLICATE');registered.set(name,{meta,handler})}};
 const auth=(p,deviceId,name,args)=>{
  assert.equal(p,principal);
  if(deny)throw Error('OPERATOR_DENIED');
  return {name,arguments:args};
 };
 const delegate=async v=>{calls.push(v);return reply};
 const names=registerParityReadTools({server,z:fakeZ,principal,authorizeRemoteCall:auth,delegate});
 const invoke=(name,input)=>registered.get(name).handler(input);
 return {names,registered,calls,invoke};
}
test('three directly named read-only tools registered; no process/write tool',()=>{
 const f=setup();
 assert.deepEqual(f.names,['dc_read_file','dc_list_directory','dc_get_file_info']);
 assert.deepEqual([...f.registered.keys()],f.names);
 assert(f.names.every(n=>n.startsWith('dc_')&&!n.includes('start_process')));
});
test('read_file maps only approved arguments via trusted policy to fixed device',async()=>{
 const f=setup();const r=await f.invoke('dc_read_file',
 {deviceId:'us-macmini',path:'/tmp/demo.txt',offset:0,length:10});
 assert.deepEqual(r,{content:[{type:'text',text:'[FILE] hello.txt'}]});
 assert.deepEqual(f.calls,[{deviceId:'us-macmini',name:'read_file',
  arguments:{path:'/tmp/demo.txt',offset:0,length:10}}]);
});
test('invalid device/URL/injected action rejected before delegate',async()=>{
 const f=setup();
 for(const x of [
  {deviceId:'unknown',path:'/tmp/demo.txt'},
  {deviceId:'us-macmini',path:'https://example.com/anything'},
  {deviceId:'us-macmini',path:'/tmp/demo.txt',command:'rm -rf /'},
  {deviceId:'us-macmini',path:'/tmp/demo.txt',length:999},
  {deviceId:'us-macmini',path:'/tmp/demo.txt',offset:-5}
 ]){
  const r=await f.invoke('dc_read_file',x);assert.equal(r.isError,true);
 }
 assert.equal(f.calls.length,0);
});
test('operator denial fails closed with zero delegated calls',async()=>{
 const f=setup({deny:true});
 assert.equal((await f.invoke('dc_list_directory',{deviceId:'china-mac',path:'/tmp'})).isError,true);
 assert.equal(f.calls.length,0);
});
test('underlying operation names never supplied by user',async()=>{
 const f=setup();const r=await f.invoke('dc_get_file_info',{
  deviceId:'windows',path:'C:\\Temp\\safe.txt',name:'start_process'
 });
 assert.equal(r.isError,true);assert.equal(f.calls.length,0);
});
test('directory depth is bounded and all four canonical devices are accepted',async()=>{
 const f=setup();for(const id of ['us-macmini','china-mac','windows','007windows']){
  const r=await f.invoke('dc_list_directory',{deviceId:id,path:'/tmp',depth:1});
  assert.equal(r.isError,undefined);
 }
 assert.equal(f.calls.length,4);
 assert.equal((await f.invoke('dc_list_directory',{deviceId:'007windows',path:'/tmp',depth:4})).isError,true);
});
test('read-only tool registration rejects unverified or missing OAuth operator',()=>{
 const server={registerTool(){}};
 for(const principal of [null,{kind:'internal',canOperate:true},
  {kind:'cloudflare-access',canOperate:false}])assert.throws(()=>
   registerParityReadTools({server,z:fakeZ,principal,authorizeRemoteCall:()=>true,delegate:async()=>({})}));
});
test('custom declared device roster cannot include arbitrary target or duplicates',()=>{
 const s={registerTool(){}},principal={kind:'cloudflare-access',canOperate:true};
 for(const allowDevices of [['evil-host'],['us-macmini','us-macmini'],[]])
  assert.throws(()=>registerParityReadTools({server:s,z:fakeZ,principal,
   authorizeRemoteCall:()=>true,delegate:async()=>({}),allowDevices}),{message:'PARITY_READ_REGISTRATION_DENIED'});
});
test('backend error is redacted instead of leaking secrets or stack',async()=>{
 const f=setup({reply:{isError:true,text:'secret=private-token'}});
 const r=await f.invoke('dc_read_file',{deviceId:'us-macmini',path:'/tmp/file'});
 assert.deepEqual(r,{isError:true,content:[{type:'text',text:'PARITY_UPSTREAM_DENIED'}]});
});
test('backend oversized output is rejected',async()=>{
 const f=setup({reply:{text:'x'.repeat(66000)}});
 assert.equal((await f.invoke('dc_read_file',{deviceId:'us-macmini',path:'/tmp/file'})).isError,true);
});
