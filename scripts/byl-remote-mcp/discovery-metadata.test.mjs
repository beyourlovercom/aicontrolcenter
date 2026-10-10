import test from 'node:test';
import assert from 'node:assert/strict';
import {metadata,RESOURCE,makeHandler} from './discovery-metadata.mjs';
import {createServer} from 'node:http';
test('verified-style issuer and exact canonical resource',()=>{
 const issuer='https://example.cloudflareaccess.com';
 assert.deepEqual(metadata(issuer),{resource:RESOURCE,authorization_servers:[issuer]});
 assert.throws(()=>metadata('http://example.cloudflareaccess.com'));
 assert.throws(()=>metadata('https://invalid.example'));
 assert.throws(()=>metadata(issuer,'https://mcp-uat.beyourlover.com'));
});

test('real localhost HTTP discovery responder handles allow and deny routes',async()=>{
 const server=createServer(makeHandler('https://example.cloudflareaccess.com'));
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const base='http://127.0.0.1:'+server.address().port;
  for(const path of ['/.well-known/oauth-protected-resource','/.well-known/oauth-protected-resource/mcp']){
   const r=await fetch(base+path);
   assert.equal(r.status,200);
   assert.deepEqual(await r.json(),metadata('https://example.cloudflareaccess.com'));
   const h=await fetch(base+path,{method:'HEAD'});
   assert.equal(h.status,200);
   assert.equal(await h.text(),'');
   const post=await fetch(base+path,{method:'POST'});
   assert.equal(post.status,405);
  }
  for(const path of ['/mcp','/control/','/.well-known/oauth-authorization-server']){
   const r=await fetch(base+path);
   assert.equal(r.status,404);
  }
  assert.equal((await fetch(base+'/healthz')).status,200);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
