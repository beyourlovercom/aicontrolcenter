import test from 'node:test';import assert from 'node:assert/strict';
import {createGuiCanaryServer} from './gui-canary-http.mjs';
test('loopback canary is bearer protected and scoped',async()=>{
 const token='a'.repeat(64);
 const s=createGuiCanaryServer({token,inspect:()=>({ok:true,pid:123}),navigate:()=>({ok:true}),allowNavigation:false});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 const url='http://127.0.0.1:'+s.address().port;
 try{
  const anon=await fetch(url+'/v1/gui/tools');assert.equal(anon.status,401);
  const headers={authorization:'Bearer '+token,'content-type':'application/json'};
  const list=await fetch(url+'/v1/gui/tools',{headers});assert.deepEqual((await list.json()).tools,['inspect_dev_cart']);
  const inspect=await fetch(url+'/v1/gui/inspect',{method:'POST',headers,body:JSON.stringify({windowPid:123})});assert.equal(inspect.status,200);
  const bad=await fetch(url+'/v1/gui/inspect',{method:'POST',headers,body:JSON.stringify({windowPid:123,extra:'unsafe'})});assert.equal(bad.status,400);
  const action=await fetch(url+'/v1/gui/navigate-home',{method:'POST',headers,body:JSON.stringify({windowPid:123})});assert.equal(action.status,403);
 }finally{await new Promise(r=>s.close(r))}
});

test('enabled canary accepts only authenticated, scoped navigation',async()=>{
 const token='b'.repeat(64);
 const s=createGuiCanaryServer({token,allowNavigation:true,inspect:()=>({ok:true}),navigate:({windowPid})=>({ok:windowPid===123,verified:windowPid===123})});
 await new Promise(resolve=>s.listen(0,'127.0.0.1',resolve));
 const base='http://127.0.0.1:'+s.address().port+'/v1/gui/navigate-home';
 try{
  const headers={authorization:'Bearer '+token,'content-type':'application/json'};
  const anon=await fetch(base,{method:'POST',body:'{"windowPid":123}'});assert.equal(anon.status,401);
  const wrong=await fetch(base,{method:'POST',headers,body:'{"windowPid":456}'});assert.equal(wrong.status,403);
  const right=await fetch(base,{method:'POST',headers,body:'{"windowPid":123}'});assert.equal(right.status,200);
 }finally{await new Promise(resolve=>s.close(resolve))}
});
