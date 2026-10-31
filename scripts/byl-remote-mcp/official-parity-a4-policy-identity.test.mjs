import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,mkdirSync,writeFileSync,rmSync,chmodSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {inspectA4PolicyIdentity} from './official-parity-a4-policy-identity.mjs';

function fixture(source='export function authorizeRemoteCall() {}'){
 const home=mkdtempSync(join(tmpdir(),'a4-identity-fixture-'));
 const runtimeDir=join(home,'private-runtime');
 mkdirSync(runtimeDir,{mode:0o700});
 const manifestFile=join(home,'manifest.json');
 const file=join(runtimeDir,'operator-policy.mjs');
 writeFileSync(file,source,{mode:0o600});
 writeFileSync(manifestFile,JSON.stringify({
  runtimeDir, // Only this field is necessary for read-only identity checks.
  bearerPath:'opaque',signingKeyPath:'opaque'
 }),{mode:0o600});
 chmodSync(manifestFile,0o600);
 return {
  manifestFile,file,runtimeDir,
  inspectedSha256:createHash('sha256').update(source).digest('hex'),
  close:()=>rmSync(home,{recursive:true,force:true})
 };
}
test('matches policy resolved from manifest without exposing bytes or private paths',()=>{
 const f=fixture('export function authorizeRemoteCall() {}');
 try{
  const report=inspectA4PolicyIdentity(f);
  assert.deepEqual(report,{
   scope:'SUPPLIED_A4_MANIFEST_ONLY',
   inspectedFileMatchesManifestPolicy:true,
   discoveryExportStaticHint:false,
   liveListenerManifestAttested:false,
   canEnableDiscoveryFilter:false
  });
  assert.equal(JSON.stringify(report).includes(f.runtimeDir),false);
  assert.equal(JSON.stringify(report).includes('authorizeRemoteCall'),false);
 }finally{f.close();}
});
test('detects separately inspected policy mismatch without revealing other hash',()=>{
 const f=fixture();
 try{
  const report=inspectA4PolicyIdentity({...f,inspectedSha256:'f'.repeat(64)});
  assert.equal(report.inspectedFileMatchesManifestPolicy,false);
  assert.equal('policySha256' in report,false);
 }finally{f.close();}
});
test('static export hint is never mistaken for proof of loaded policy or deployment readiness',()=>{
 const f=fixture('export function listAuthorizedRemoteToolNames() {return [];}');
 try{
  const report=inspectA4PolicyIdentity(f);
  assert.equal(report.discoveryExportStaticHint,true);
  assert.equal(report.canEnableDiscoveryFilter,false);
  assert.equal(report.liveListenerManifestAttested,false);
 }finally{f.close();}
});
test('missing expected SHA or insecure manifest fails closed',()=>{
 const f=fixture();
 try{
  assert.throws(()=>inspectA4PolicyIdentity({
   ...f,inspectedSha256:'not-a-hash'
  }),{message:'POLICY_IDENTITY_EXPECTED_SHA_REQUIRED'});
  chmodSync(f.manifestFile,0o644);
  assert.throws(()=>inspectA4PolicyIdentity(f),
   {message:'POLICY_IDENTITY_MANIFEST_INSECURE'});
 }finally{f.close();}
});
test('malformed manifest or insecure runtime directory fails before reading private policy',()=>{
 const f=fixture();
 try{
  writeFileSync(f.manifestFile,'{}',{mode:0o600});
  assert.throws(()=>inspectA4PolicyIdentity(f),
   {message:'POLICY_IDENTITY_MANIFEST_INVALID'});
  writeFileSync(f.manifestFile,JSON.stringify({runtimeDir:f.runtimeDir}),{mode:0o600});
  chmodSync(f.runtimeDir,0o755);
  assert.throws(()=>inspectA4PolicyIdentity(f),
   {message:'POLICY_IDENTITY_RUNTIME_DIRECTORY_INSECURE'});
 }finally{f.close();}
});

test('CLI reports missing manifest environment explicitly without exposing paths',()=>{
 const cli=new URL('./official-parity-a4-policy-identity-cli.mjs',import.meta.url);
 const result=spawnSync(process.execPath,[cli.pathname],{
  encoding:'utf8',
  env:{BYL_MCP_INSPECTED_POLICY_SHA256:'a'.repeat(64)}
 });
 assert.equal(result.status,1);
 assert.deepEqual(JSON.parse(result.stdout.trim()),{
  status:'UNVERIFIED',code:'POLICY_IDENTITY_MANIFEST_ENV_MISSING'
 });
 assert.equal(result.stderr,'');
});
test('CLI distinguishes a bad supplied manifest path from an unset environment',()=>{
 const cli=new URL('./official-parity-a4-policy-identity-cli.mjs',import.meta.url);
 const result=spawnSync(process.execPath,[cli.pathname],{
  encoding:'utf8',
  env:{
   BYL_MCP_INSPECTED_POLICY_SHA256:'a'.repeat(64),
   BYL_MCP_A4_PRIVATE_MANIFEST_FILE:'not-an-absolute-path'
  }
 });
 assert.equal(result.status,1);
 assert.deepEqual(JSON.parse(result.stdout.trim()),{
  status:'UNVERIFIED',code:'POLICY_IDENTITY_MANIFEST_INVALID'
 });
 assert.equal(result.stderr,'');
});
