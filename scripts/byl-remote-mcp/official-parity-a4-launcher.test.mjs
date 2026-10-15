import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,chmodSync,rmSync,readFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {generateKeyPairSync} from 'node:crypto';
import {parseA4LaunchManifest,launchA4OAuthService}
 from './official-parity-a4-launcher.mjs';

const synthTargets={
 'us-macmini':'http://127.0.0.1:8791',
 'china-mac':'http://100.64.1.2:8791',
 'windows':'http://10.1.2.3:8791',
 '007windows':'http://192.168.0.55:8791'
};
function fixture(){
 const dir=mkdtempSync(join(tmpdir(),'a4-runtime-contract-'));
 const privateDir=join(dir,'installed-safe-modules');
 mkdirSync(privateDir,{mode:0o700});
 const token=join(dir,'bearer'),key=join(dir,'ed25519'),audit=join(dir,'audit.log'),manifest=join(dir,'manifest.json');
 const privateKey=generateKeyPairSync('ed25519').privateKey;
 const files=[
  [token,'SYNTHETIC_NON_PRODUCTION_BEARER_2026'],
  [key,privateKey.export({type:'pkcs8',format:'pem'})],
  [audit,'']
 ];
 files.forEach(([p,c])=>{writeFileSync(p,c,{mode:0o600});chmodSync(p,0o600);});
 const data={
  runtimeDir:privateDir,bearerPath:token,signingKeyPath:key,
  targets:synthTargets,allowedHosts:['localhost','127.0.0.1'],auditPath:audit
 };
 writeFileSync(manifest,JSON.stringify(data),{mode:0o600});chmodSync(manifest,0o600);
 const env={
  BYL_MCP_A4_SERVICE_LAUNCH_ENABLED:'1',
  BYL_MCP_STAGING:'0',
  BYL_MCP_PRODUCTION_OAUTH_ENABLED:'1',
  BYL_MCP_OAUTH_COMPAT_CANDIDATE:'1',
  BYL_MCP_ACCESS_ENABLED:'1',
  BYL_MCP_PARITY_CORE_READ_ENABLED:'0',
  BYL_MCP_A4_PRIVATE_MANIFEST_FILE:manifest
 };
 const imported={
  'access-auth.mjs':{
   getAccessConfig:()=>({enabled:true}),
   resolveAccessPrincipal:async()=>({kind:'cloudflare-access',canOperate:true})
  },
  'endpoint-routing.mjs':{endpointRouting:()=>({port:8797,paths:['/oauth/mcp']})},
  'operator-policy.mjs':{
   canExposeRemoteCall:()=>true,
   authorizeRemoteCall:(_p,_id,name,args)=>({name,arguments:args})
  }
 };
 const importPrivate=async path=>imported[path.split('/').at(-1)];
 return {dir,env,manifest,data,token,key,audit,importPrivate,
  dispose:()=>rmSync(dir,{recursive:true,force:true})};
}
test('manifest is strict four-device private-only fields and immutable on parse',()=>{
 const f=fixture();
 try{
  assert.equal(parseA4LaunchManifest(f.data).allowedHosts.length,2);
  assert.throws(()=>parseA4LaunchManifest({...f.data,extra:'leak'}),{message:'A4_MANIFEST_INVALID'});
  const m={...f.data,targets:{'us-macmini':synthTargets['us-macmini']}};
  assert.throws(()=>parseA4LaunchManifest(m),{message:'A4_MANIFEST_INVALID'});
 }finally{f.dispose();}
});
test('trusted explicit load prepares app without binding 8797, no secrets returned',async()=>{
 const f=fixture();
 try{
  const r=await launchA4OAuthService({env:f.env,listen:false,importPrivate:f.importPrivate});
  assert.equal(r.status,'PREPARED_NOT_LISTENING');
  assert.equal(r.port,8797);assert.equal(r.host,'127.0.0.1');
  assert.equal(r.route,'/oauth/mcp');
  assert.equal(JSON.stringify(r).includes('PRIVATE KEY'),false);
  assert.equal(JSON.stringify(r).includes('100.64.1.2'),false);
  assert.equal(readFileSync(f.audit,'utf8'),'');
 }finally{f.dispose();}
});
test('without explicit service launch gate, cannot import secrets or bind service',async()=>{
 const f=fixture();
 try{
  f.env.BYL_MCP_A4_SERVICE_LAUNCH_ENABLED='0';
  await assert.rejects(launchA4OAuthService({env:f.env,listen:false,
   importPrivate:f.importPrivate}),{message:'A4_LAUNCH_NOT_APPROVED'});
 }finally{f.dispose();}
});
test('private manifest group-writable permissions fail closed',async()=>{
 const f=fixture();
 try{
  chmodSync(f.manifest,0o666);
  await assert.rejects(launchA4OAuthService({env:f.env,listen:false,
   importPrivate:f.importPrivate}),{message:'A4_PRIVATE_PERMISSIONS_DENIED'});
 }finally{f.dispose();}
});
test('signing private key and bearer secret never appear in thrown error',async()=>{
 const f=fixture();
 try{
  writeFileSync(f.key,'INVALID_PRIVATE_SECRET_CONTENT');
  await assert.rejects(launchA4OAuthService({env:f.env,listen:false,
   importPrivate:f.importPrivate}),e=>{
    assert.equal(e.message,'PARITY_PRIVATE_KEY_REQUIRED');
    assert.equal(e.message.includes('INVALID_PRIVATE'),false);
    return true;
   });
 }finally{f.dispose();}
});
test('denies missing audit file, invalid installed auth module or wrong route',async()=>{
 const f=fixture();
 try{
  rmSync(f.audit);
  await assert.rejects(launchA4OAuthService({env:f.env,listen:false,
   importPrivate:f.importPrivate}),{message:'A4_PRIVATE_FILE_NOT_ACCESSIBLE'});
  writeFileSync(f.audit,'',{mode:0o600});
  await assert.rejects(launchA4OAuthService({env:f.env,listen:false,
   importPrivate:async()=>({})}),{message:'A4_PRIVATE_POLICY_UNAVAILABLE'});
 }finally{f.dispose();}
});
test('no loaded key, target URI or private file name leaks from public exports',async()=>{
 const f=fixture();
 try{
  const result=await launchA4OAuthService({env:f.env,listen:false,importPrivate:f.importPrivate});
  for(const sensitive of [f.token,f.key,f.manifest,f.data.targets['007windows']])
   assert(!JSON.stringify(result).includes(sensitive));
 }finally{f.dispose();}
});
