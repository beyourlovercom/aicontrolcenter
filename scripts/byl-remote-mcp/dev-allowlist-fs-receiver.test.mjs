import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,symlink,rm,stat} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {createHash} from 'node:crypto';
import {createDevFilesystemReceiver} from './dev-allowlist-fs-receiver.mjs';
import {manifestDigest} from './dev-allowlist-contract.mjs';
const hash=v=>createHash('sha256').update(v).digest('hex');
const path='wp-content/plugins/yby-core/admin/class-yby-project-studio.php';
const before=Buffer.from("<?php echo 'before';");
const after=Buffer.from("<?php echo 'after';");
async function setup({lint=true,badArtifact=false}={}){
 const base=await mkdtemp(join(tmpdir(),'dc-receiver-v1-'));
 const siteRoot=join(base,'domains','dev.beyourlover.com','public_html');
 const backupRoot=join(base,'protected','backups');
 const live=join(siteRoot,path);
 await mkdir(dirname(live),{recursive:true});
 await writeFile(live,before);
 const m={schema:1,environment:'dev',project:'byl-wordpress-core',
 releaseId:'release-test-001',requestId:'request-test-001',
 github:{repo:'beyourlovercom/YBY-Core',commitSha:'c'.repeat(40),prNumber:103,ciRunId:123},
 artifact:{id:'artifact-test-001',sha256:'d'.repeat(64)},
 files:[{path,operation:'replace',beforeSha256:hash(before),afterSha256:hash(after)}],
 authorizationReceipt:'owner-test-20261014'};
 const receiver=createDevFilesystemReceiver({siteRoot,backupRoot,phpLint:async()=>lint,
 artifactResolver:{loadVerified:async()=>({sha256:m.artifact.sha256,files:{[path]:badArtifact?before:after}})}});
 const cleanup=()=>rm(base,{recursive:true,force:true});
 return {receiver,m,digest:manifestDigest(m),siteRoot,backupRoot,live,cleanup};
}
test('verified Dev fixture prepare stage + backup outside Web, apply, rollback',async()=>{
 const f=await setup();
 try{
  const rec=await f.receiver.prepare({manifest:f.m,manifestSha256:f.digest});
  assert.equal(rec.verified,true);
  assert.equal((await f.receiver.inspect({project:f.m.project,files:f.m.files}))[path].sha256,hash(before));
  assert.equal((await stat(f.backupRoot)).isDirectory(),true);
  await f.receiver.apply({manifest:f.m,manifestSha256:f.digest,backupId:rec.backupId});
  assert.deepEqual(await readFile(f.live),after);
  assert.equal((await f.receiver.restore({manifest:f.m,backupId:rec.backupId,strictIdentity:true})).restored,true);
  assert.deepEqual(await readFile(f.live),before);
 }finally{await f.cleanup();}
});
test('PHP lint denial occurs before Dev live write',async()=>{
 const f=await setup({lint:false});
 try{
  const rec=await f.receiver.prepare({manifest:f.m,manifestSha256:f.digest});
  await assert.rejects(f.receiver.apply({manifest:f.m,manifestSha256:f.digest,backupId:rec.backupId}),{message:'PHP_LINT_DENIED'});
  assert.deepEqual(await readFile(f.live),before);
 }finally{await f.cleanup();}
});
test('mismatching artifact digest fails before running file mutation',async()=>{
 const f=await setup({badArtifact:true});
 try{
  await assert.rejects(f.receiver.prepare({manifest:f.m,manifestSha256:f.digest}),{message:'STAGED_FILE_HASH_DENIED'});
  assert.deepEqual(await readFile(f.live),before);
 }finally{await f.cleanup();}
});
test('drift after preparation denies live apply',async()=>{
 const f=await setup();
 try{
  const rec=await f.receiver.prepare({manifest:f.m,manifestSha256:f.digest});
  await writeFile(f.live,Buffer.from('external-modification'));
  await assert.rejects(f.receiver.apply({manifest:f.m,manifestSha256:f.digest,backupId:rec.backupId}),{message:'RECEIVER_PREIMAGE_DRIFT'});
 }finally{await f.cleanup();}
});
test('external file after apply refuses destructive rollback',async()=>{
 const f=await setup();
 try{
  const rec=await f.receiver.prepare({manifest:f.m,manifestSha256:f.digest});
  await f.receiver.apply({manifest:f.m,manifestSha256:f.digest,backupId:rec.backupId});
  await writeFile(f.live,Buffer.from('some-other-owner-change'));
  await assert.rejects(f.receiver.restore({manifest:f.m,backupId:rec.backupId,strictIdentity:true}),{message:'RESTORE_EXTERNAL_DRIFT_DENIED'});
 }finally{await f.cleanup();}
});
test('symlink target is rejected by inspected receiver',async()=>{
 const f=await setup();
 try{
  const other=join(dirname(f.siteRoot),'external.php');await writeFile(other,before);
  await rm(f.live);await symlink(other,f.live);
  await assert.rejects(f.receiver.inspect({project:f.m.project,files:f.m.files}),{message:'PATH_SYMLINK_OR_TYPE_DENIED'});
 }finally{await f.cleanup();}
});
test('WWW path and unsafe backup-root containment blocked at configuration',async()=>{
 const f=await setup();
 try{
  assert.throws(()=>createDevFilesystemReceiver({siteRoot:f.siteRoot.replace('dev.beyourlover.com','www.beyourlover.com'),
  backupRoot:f.backupRoot,artifactResolver:{loadVerified(){}},phpLint:()=>true}),{message:'RECEIVER_CONFIG_DENIED'});
  assert.throws(()=>createDevFilesystemReceiver({siteRoot:f.siteRoot,backupRoot:join(f.siteRoot,'backup'),
  artifactResolver:{loadVerified(){}},phpLint:()=>true}),{message:'RECEIVER_CONFIG_DENIED'});
 }finally{await f.cleanup();}
});
test('strict restore receipt required; no silent recovery without backing',async()=>{
 const f=await setup();
 try{
  const rec=await f.receiver.prepare({manifest:f.m,manifestSha256:f.digest});
  await assert.rejects(f.receiver.restore({manifest:f.m,backupId:rec.backupId,strictIdentity:false}),{message:'STRICT_RESTORE_REQUIRED'});
 }finally{await f.cleanup();}
});
