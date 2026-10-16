import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile,readFile,symlink,rename,rm,chmod,stat} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createOfflineRelease,verifyOfflineRelease,assessOfflineCandidate} from './agent-versioned-release.mjs';
const config=(base,releaseName='aicc-us-agent-v1')=>({sourceDir:join(base,'src'),outputDir:join(base,'release'),
  deviceId:'us-macmini',sourceCommit:'a'.repeat(40),reviewedTargetCommit:'b'.repeat(40),releaseName});
async function fixture(content="export const name='p2-opt-in';\n"){
 const base=await mkdtemp(join(tmpdir(),'aicc-agent-build-'));
 await mkdir(join(base,'src'));
 await writeFile(join(base,'src','agent-entry.mjs'),content);
 return {base,params:config(base),cleanup:()=>rm(base,{recursive:true,force:true})};
}
test('deterministic offline build, verify, and clear NO RELEASE status',async()=>{
 const {params,cleanup}=await fixture();
 try{
  const r=await createOfflineRelease(params);
  assert.equal(r.integrityVerified,true);
  assert.match(r.buildSha256,/^[0-9a-f]{64}$/);
  assert.equal(r.agentCanary,'STOP');
  const m=JSON.parse(await readFile(join(params.outputDir,'release-manifest.json'),'utf8'));
  assert.equal(m.authority,'UNSIGNED_LOCAL_CANDIDATE');
  assert.equal(m.executingProcessIdentity,'UNVERIFIED');
  assert.equal(m.rollbackBuild,'UNVERIFIED');
  assert.equal(m.deployPermission,'NONE');
  const v=await verifyOfflineRelease(params.outputDir);
  assert.deepEqual(assessOfflineCandidate(v),{
    artifactIntegrity:'PASS',runningVersion:'UNKNOWN',rollback:'UNKNOWN',
    agentOnlyCanary:'STOP',reason:'TRUSTED_RELEASE_OWNER_EVIDENCE_REQUIRED'});
 }finally{await cleanup()}
});
test('identical staged inputs produce same immutable release digest',async()=>{
 const a=await fixture(),b=await fixture();
 try{
  const x=await createOfflineRelease(a.params),y=await createOfflineRelease(b.params);
  assert.equal(x.buildSha256,y.buildSha256);
 }finally{await a.cleanup();await b.cleanup()}
});
test('deterministic ordinal filename order supports punctuation and underscores',async()=>{
 const a=await fixture();
 try{
  await writeFile(join(a.params.sourceDir,'a-b.mjs'),'export const a=1;\n');
  await writeFile(join(a.params.sourceDir,'a_mjs.mjs'),'export const b=2;\n');
  const out=await createOfflineRelease(a.params);
  assert.equal(out.integrityVerified,true);
  const m=JSON.parse(await readFile(join(a.params.outputDir,'release-manifest.json'),'utf8'));
  assert.deepEqual(m.files.map(x=>x.name),['a-b.mjs','a_mjs.mjs','agent-entry.mjs']);
 }finally{await a.cleanup()}
});

test('clean up partial output after staged mkdir failure (nonroot POSIX)',{skip:process.platform==='win32'||typeof process.getuid!=='function'||process.getuid()===0},async()=>{
 const a=await fixture();
 try{
  const prev=process.umask(0o777);
  try{await assert.rejects(createOfflineRelease(a.params),/EACCES|EPERM/);}
  finally{process.umask(prev)}
  await assert.rejects(stat(a.params.outputDir),{code:'ENOENT'});
  const ready=await createOfflineRelease(a.params);
  assert.equal(ready.integrityVerified,true);
 }finally{await a.cleanup()}
});

test('source file tampering after packaging detected',async()=>{
 const a=await fixture();
 try{
  await createOfflineRelease(a.params);
  await chmod(join(a.params.outputDir,'source','agent-entry.mjs'),0o644);
  await writeFile(join(a.params.outputDir,'source','agent-entry.mjs'),"export const hijack=true;\n");
  await assert.rejects(verifyOfflineRelease(a.params.outputDir),/SOURCE_DIGEST_INVALID|SOURCE_TYPE_DENIED/);
 }finally{await a.cleanup()}
});
test('manifest tampering detected',async()=>{
 const a=await fixture();
 try{
  await createOfflineRelease(a.params);
  const p=join(a.params.outputDir,'release-manifest.json');
  const obj=JSON.parse(await readFile(p,'utf8'));obj.sourceCommit='c'.repeat(40);
  await chmod(p,0o644);
  await writeFile(p,JSON.stringify(obj));
  await assert.rejects(verifyOfflineRelease(a.params.outputDir),/MANIFEST_DIGEST_INVALID/);
 }finally{await a.cleanup()}
});
test('reject manifest schema tampering without digest change',async()=>{
 const a=await fixture();
 try{
  await createOfflineRelease(a.params);
  const p=join(a.params.outputDir,'release-manifest.json');
  const obj=JSON.parse(await readFile(p,'utf8'));
  obj.schema='aicc-agent-offline-release-candidate/v0';
  await chmod(p,0o644);
  await writeFile(p,JSON.stringify(obj));
  await assert.rejects(verifyOfflineRelease(a.params.outputDir),/MANIFEST_NOT_OFFLINE_CANDIDATE/);
 }finally{await a.cleanup()}
});
test('reject symlink source',async()=>{
 const a=await fixture();
 try{
  await symlink(join(a.params.sourceDir,'agent-entry.mjs'),join(a.params.sourceDir,'fake.mjs'));
  await assert.rejects(createOfflineRelease(a.params),/SOURCE_TYPE_DENIED/);
 }finally{await a.cleanup()}
});
test('reject legacy private network addresses and machine-specific paths',async()=>{
 for(const secret of [
  "export const peer='http://10.11.12.13:8791';\n",
  "export const userPath='/Users/administrator/.byl-remote-mcp/runtime';\n",
  "export const key='-----BEGIN PRIVATE KEY-----';\n",
  "export const endpoint='http://10.0.0.1:8791';\n",
 ]){
  const a=await fixture(secret);
  try{await assert.rejects(createOfflineRelease(a.params),/PRIVATE_TOPOLOGY_OR_SECRET_SOURCE/)}finally{await a.cleanup()}
 }
});
test('reject unknown or unsafe file extensions',async()=>{
 const a=await fixture();
 try{
  await writeFile(join(a.params.sourceDir,'.env'),'PASSWORD=secret');
  await assert.rejects(createOfflineRelease(a.params),/UNSAFE_SOURCE_FILENAME/);
 }finally{await a.cleanup()}
});
test('refuse to overwrite existing artifact and ensure old artifact preserved',async()=>{
 const a=await fixture();
 try{
  const old=await createOfflineRelease(a.params);
  await assert.rejects(createOfflineRelease(a.params),/OUTPUT_MUST_BE_NEW/);
  const now=await verifyOfflineRelease(a.params.outputDir);
  assert.equal(now.integrityVerified,true);
  assert.equal(old.buildSha256,(JSON.parse(await readFile(join(a.params.outputDir,'release-manifest.json'),'utf8'))).buildSha256)
 }finally{await a.cleanup()}
});
test('output directory inside source forbidden',async()=>{
 const a=await fixture();
 try{await assert.rejects(createOfflineRelease({...a.params,outputDir:join(a.params.sourceDir,'release')}),/SOURCE_OUTPUT_OVERLAP/)}
 finally{await a.cleanup()}
});
test('four-device allowlist enforced',async()=>{
 const a=await fixture();
 try{await assert.rejects(createOfflineRelease({...a.params,deviceId:'unknown-mac'}),/BUNDLE_METADATA_INVALID/)}
 finally{await a.cleanup()}
});
test('build always marks rollback and runtime provenance as unverified',async()=>{
 const a=await fixture();
 try{
  const built=await createOfflineRelease(a.params);
  assert.equal(built.authority,'NOT_ATTESTED');
  assert.equal(built.processVersion,'NOT_PROVED');
  assert.equal(built.rollback,'NOT_PROVED');
  assert.equal(built.ownerUat,'OPEN');
 }finally{await a.cleanup()}
});
test('reject unexpected file added to otherwise valid release',async()=>{
 const a=await fixture();
 try{
  await createOfflineRelease(a.params);
  await writeFile(join(a.params.outputDir,'source','payload.mjs'),'export const p=1;');
  await assert.rejects(verifyOfflineRelease(a.params.outputDir),/FILE_COUNT_MISMATCH/);
 }finally{await a.cleanup()}
});
test('reject unexpected top-level release file',async()=>{
 const a=await fixture();
 try{
  await createOfflineRelease(a.params);
  await writeFile(join(a.params.outputDir,'deploy.sh'),'echo hello');
  await assert.rejects(verifyOfflineRelease(a.params.outputDir),/UNEXPECTED_ARTIFACT_CONTENT/);
 }finally{await a.cleanup()}
});

test('allow pinned package manifest pair without installing dependencies',async()=>{
 const a=await fixture();
 try{
  await writeFile(join(a.params.sourceDir,'package.json'),JSON.stringify({name:'aicc-test',version:'1.0.0',type:'module'}));
  await writeFile(join(a.params.sourceDir,'package-lock.json'),JSON.stringify({name:'aicc-test',version:'1.0.0',lockfileVersion:3,packages:{}}));
  const result=await createOfflineRelease(a.params);
  assert.equal(result.fileCount,3);
  assert.equal(result.agentCanary,'STOP');
  assert.equal((await verifyOfflineRelease(a.params.outputDir)).integrityVerified,true);
 }finally{await a.cleanup()}
});
test('refuse unpinned package dependencies',async()=>{
 const a=await fixture();
 try{
  await writeFile(join(a.params.sourceDir,'package.json'),JSON.stringify({name:'aicc-test',version:'1.0.0'}));
  await assert.rejects(createOfflineRelease(a.params),/UNPINNED_PACKAGE_DEPENDENCIES/);
 }finally{await a.cleanup()}
});
