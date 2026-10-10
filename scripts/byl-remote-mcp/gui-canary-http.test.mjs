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
