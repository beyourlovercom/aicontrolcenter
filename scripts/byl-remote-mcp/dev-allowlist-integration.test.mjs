
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {dirname,join} from 'node:path';
import {createHash} from 'node:crypto';
import {createDevReleaseService} from './dev-allowlist-controller.mjs';
import {createDurableReleaseStore} from './dev-allowlist-durable-store.mjs';
import {createDevFilesystemReceiver} from './dev-allowlist-fs-receiver.mjs';
import {createTrustedDevAuthority} from './dev-allowlist-trusted-authority.mjs';
import {manifestDigest} from './dev-allowlist-contract.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const P=[
 'wp-content/plugins/yby-core/admin/class-yby-andy-os-navigation.php',
 'wp-content/plugins/yby-core/admin/class-yby-project-studio.php',
 'wp-content/plugins/yby-core/inc/class-yby-core.php'
];
const CI=['Release Package Validation','Andy Core Regression',
 'Newsletter M1 Disposable WordPress MySQL',
 'Inquiry Inbox WordPress MySQL Validation'];
const old=Buffer.from("<?php echo 'old';");
const updated=Buffer.from("<?php echo 'updated';");
const newFile=Buffer.from("<?php echo 'new nav';");
const sha40='c'.repeat(40);
const clock=()=>1_800_000_000_000;
async function setup(){
 const root=await mkdtemp(join(tmpdir(),'dc-allowlist-integration-'));
 const siteRoot=join(root,'domains','dev.beyourlover.com','public_html');
 const backupRoot=join(root,'private','backups');
 const journalRoot=join(root,'private','dev-release-journal');
 for(const p of P.slice(1)){
  const file=join(siteRoot,p);
  await mkdir(dirname(file),{recursive:true});
  await writeFile(file,old);
 }
 const manifest={
  schema:1,environment:'dev',project:'byl-wordpress-core',releaseId:'release-20261014-e2e',
  requestId:'request-20261014-e2e',
  authorizationReceipt:'owner-20261014-e2e',
  github:{repo:'beyourlovercom/YBY-Core',commitSha:sha40,prNumber:103,ciRunId:999},
  artifact:{id:'artifact-20261014-e2e',sha256:'d'.repeat(64)},
  files:P.map((path,i)=>({
   path,operation:i===0?'add':'replace',
   beforeSha256:i===0?null:sha(old),afterSha256:sha(i===0?newFile:updated)
  }))
 };
 const digest=manifestDigest(manifest);
 const artifacts=Object.fromEntries(P.map((p,i)=>[p,i===0?newFile:updated]));
 const evidence={
  receipt:{id:manifest.authorizationReceipt,environment:'dev',project:manifest.project,
   repo:manifest.github.repo,commitSha:sha40,releaseId:manifest.releaseId,
   manifestSha256:digest,issuedAtMs:clock()-1,expiresAtMs:clock()+3600000,
   actions:['prepare','apply','rollback'],approvedPaths:[...P]},
  pr:{repo:manifest.github.repo,number:manifest.github.prNumber,headSha:sha40,
   merged:false,base:'feature/business-os-b1-1-content-consolidation'},
  workflow:{id:999,headSha:sha40,status:'completed',conclusion:'success'},
  checks:CI.map(name=>({name,headSha:sha40,status:'completed',conclusion:'success'})),
  artifact:{repo:manifest.github.repo,commitSha:sha40,id:manifest.artifact.id,
   sha256:manifest.artifact.sha256,immutable:true,paths:[...P]}
 };
 const authority=createTrustedDevAuthority({clock,
  github:{getPullRequest:async()=>evidence.pr,getWorkflowRun:async()=>evidence.workflow,
   listCommitChecks:async()=>evidence.checks},
  approvals:{getReceipt:async()=>evidence.receipt,canView:async()=>true},
  artifacts:{getImmutableArtifact:async()=>evidence.artifact}
 });
 const receiver=createDevFilesystemReceiver({siteRoot,backupRoot,
  artifactResolver:{loadVerified:async()=>({
   sha256:manifest.artifact.sha256,files:artifacts
  })},
  phpLint:async()=>true});
 const store=createDurableReleaseStore({root:journalRoot});
 const service=createDevReleaseService({authority,receiver,store});
 return {root,siteRoot,backupRoot,journalRoot,store,service,manifest,evidence,
  cleanup:()=>rm(root,{recursive:true,force:true})};
}
test('all layers: three exact Dev paths, immutable artifact, backup, apply, replay, rollback',async()=>{
 const f=await setup();
 try{
  const prepared=await f.service.prepare(f.manifest);
  assert.equal(prepared.state,'PREPARED');
  assert.equal((await f.store.get(f.manifest.project,f.manifest.releaseId)).state,'PREPARED');
  await assert.rejects(readFile(join(f.siteRoot,P[0])),{code:'ENOENT'});
  for(const p of P.slice(1))assert.deepEqual(await readFile(join(f.siteRoot,p)),old);
  const applied=await f.service.apply(f.manifest);
  assert.equal(applied.state,'APPLIED');
  assert.deepEqual(await readFile(join(f.siteRoot,P[0])),newFile);
  for(const p of P.slice(1))assert.deepEqual(await readFile(join(f.siteRoot,p)),updated);
  assert.equal((await f.service.apply(f.manifest)).state,'APPLIED');
  const restartedStore=createDurableReleaseStore({root:f.journalRoot});
  assert.equal((await restartedStore.get(f.manifest.project,f.manifest.releaseId)).state,'APPLIED');
  assert.equal((await f.service.rollback(f.manifest)).state,'ROLLED_BACK');
  await assert.rejects(readFile(join(f.siteRoot,P[0])),{code:'ENOENT'});
  for(const p of P.slice(1))assert.deepEqual(await readFile(join(f.siteRoot,p)),old);
 }finally{await f.cleanup();}
});
test('fresh GitHub HEAD drift after verified prepare prevents any apply',async()=>{
 const f=await setup();
 try{
  await f.service.prepare(f.manifest);
  f.evidence.pr.headSha='e'.repeat(40);
  await assert.rejects(f.service.apply(f.manifest),{message:'PR_EXACT_HEAD_DENIED'});
  assert.equal((await f.store.get(f.manifest.project,f.manifest.releaseId)).state,'PREPARED');
  for(const p of P.slice(1))assert.deepEqual(await readFile(join(f.siteRoot,p)),old);
 }finally{await f.cleanup();}
});
test('crash-recovered APPLYING intent fails closed with no implicit replay',async()=>{
 const f=await setup();
 try{
  await f.service.prepare(f.manifest);
  const prepared=await f.store.get(f.manifest.project,f.manifest.releaseId);
  await f.store.withProjectLock(f.manifest.project,()=>f.store.put({...prepared,state:'APPLYING'}));
  const fresh=createDevReleaseService({authority:createTrustedDevAuthority({clock,
   github:{getPullRequest:async()=>f.evidence.pr,getWorkflowRun:async()=>f.evidence.workflow,
    listCommitChecks:async()=>f.evidence.checks},
   approvals:{getReceipt:async()=>f.evidence.receipt,canView:async()=>true},
   artifacts:{getImmutableArtifact:async()=>f.evidence.artifact}}),
    receiver:createDevFilesystemReceiver({siteRoot:f.siteRoot,backupRoot:f.backupRoot,
     artifactResolver:{loadVerified:async()=>{throw Error('NO_DOWNLOAD');}},phpLint:async()=>true}),
    store:createDurableReleaseStore({root:f.journalRoot})});
  await assert.rejects(fresh.apply(f.manifest),{message:'RELEASE_STATE_DENIED'});
 }finally{await f.cleanup();}
});
