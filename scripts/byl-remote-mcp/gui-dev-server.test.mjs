import test from 'node:test';import assert from 'node:assert/strict';import {createGuiDevServer} from './gui-dev-server.mjs';
const token='a'.repeat(40), request={action:'inspect',windowPid:321,expectedHost:'dev.beyourlover.com',expectedTitle:'BYL GUI TEST READY'};
test('loopback authenticated inspect and denial contract',async()=>{
 const server=createGuiDevServer({token,lookup:()=>({ok:true,pid:321,title:'BYL GUI TEST READY - Google Chrome',url:'/tmp/byl-gui-owner-uat-20261010.html'})});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
 const url='http://127.0.0.1:'+server.address().port+'/dev/gui/inspect';
 const send=(value,auth)=>fetch(url,{method:'POST',headers:{'content-type':'application/json',authorization:auth},body:JSON.stringify(value)});
 const denied=await send(request,'Bearer wrong');assert.equal(denied.status,401);
 const ok=await send(request,'Bearer '+token);assert.equal(ok.status,200);assert.equal((await ok.json()).executed,false);
 const mut=await send({...request,action:'click',target:'Click test only'},'Bearer '+token);assert.equal(mut.status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
