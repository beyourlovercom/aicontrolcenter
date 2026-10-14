import test from 'node:test';
import assert from 'node:assert/strict';
import {validateDevManifest,manifestDigest} from './dev-allowlist-contract.mjs';
import {createDevReleaseService} from './dev-allowlist-controller.mjs';
const a='a'.repeat(64),b='b'.repeat(64);
const target='wp-content/plugins/yby-core/admin/class-yby-project-studio.php';
const added='wp-content/plugins/yby-core/admin/class-yby-andy-os-navigation.php';
const base=()=>({
 schema:1,environment:'dev',project:'byl-wordpress-core',
 releaseId:'dev-20261014-001',requestId:'request-20261014-001',
 github:{repo:'beyourlovercom/YBY-Core',commitSha:'c'.repeat(40),prNumber:103,ciRunId:1234},
 artifact:{id:'github-artifact-1234',sha256:'d'.repeat(64)},
 files:[{path:target,operation:'replace',beforeSha256:a,afterSha256:b}],
 authorizationReceipt:'owner-approval-20261014-01'
});
const clone=v=>structuredClone(v);
function fixture(){
 const data=new Map([[target,a],[added,null]]);
 const records=new Map();
 const flags={ci:'success',allowed:true,failApply:false,failRestore:false,backupVerified:true,invalidSnapshot:false,head:null,wrongPaths:false,stageMutates:false,canView:true};
 const calls={prepare:0,apply:0,restore:0,attest:[],inspect:0};
 let held=false;
 const authority={
  async attest({action,manifest,manifestSha256}){
   calls.attest.push(action);
   return {allowed:flags.allowed,manifestSha256,headSha:flags.head||manifest.github.commitSha,
    ciRunId:manifest.github.ciRunId,ciConclusion:flags.ci,
    ownerReceiptId:manifest.authorizationReceipt,artifactSha256:manifest.artifact.sha256,
    approvedPaths:flags.wrongPaths?['wp-config.php']:manifest.files.map(f=>f.path)};
  },
  async canView(){return flags.canView;}
 };
 const receiver={
  async inspect({files}){
   calls.inspect++;
   return Object.fromEntries(files.map(f=>[f.path,{
    sha256:data.get(f.path),site:flags.invalidSnapshot?'www.beyourlover.com':'dev.beyourlover.com',
    realpathSafe:true,symlinkFree:true
   }]));
  },
  async prepare({manifest}){
   calls.prepare++;
   if(flags.stageMutates)data.set(manifest.files[0].path,b);
   return {backupId:'backup-20261014-001',verified:flags.backupVerified};
  },
  async apply({manifest}){
   calls.apply++;
   for(const f of manifest.files)data.set(f.path,f.afterSha256);
   if(flags.failApply)throw Error('FAKE_PARTIAL_FAILURE');
  },
  async restore({manifest}){
   calls.restore++;
   if(flags.failRestore)throw Error('FAKE_RESTORE_FAILURE');
   for(const f of manifest.files)data.set(f.path,f.beforeSha256);
   return {restored:true};
  }
 };
 const store={
  async withProjectLock(_project,fn){
   if(held)throw Error('DEPLOY_LOCK_BUSY');
   held=true;
   try{return await fn();}finally{held=false;}
  },
  async get(project,releaseId){return records.get(project+':'+releaseId);},
  async put(rec){records.set(rec.project+':'+rec.releaseId,rec);}
 };
 return {service:createDevReleaseService({authority,receiver,store}),flags,calls,data,records,store};
}
async function rejection(request,code){
 const f=fixture();
 await assert.rejects(f.service.prepare(request),{message:code});
 assert.equal(f.calls.apply,0);
}
test('prepare validates, backs up, and does not alter live file',async()=>{
 const f=fixture();const r=await f.service.prepare(base());
 assert.equal(r.state,'PREPARED');assert.equal(f.data.get(target),a);
 assert.equal(f.calls.prepare,1);assert.equal(f.calls.apply,0);
});
test('apply requires prepared receipt and rechecks authority',async()=>{
 const f=fixture();await f.service.prepare(base());const r=await f.service.apply(base());
 assert.equal(r.state,'APPLIED');assert.equal(f.data.get(target),b);
 assert.deepEqual(f.calls.attest,['prepare','apply']);
});
test('same release id is idempotent after apply',async()=>{
 const f=fixture();await f.service.prepare(base());await f.service.apply(base());
 assert.equal((await f.service.apply(base())).state,'APPLIED');
 assert.equal((await f.service.prepare(base())).state,'APPLIED');
 assert.equal(f.calls.apply,1);
});
test('explicit authorized rollback restores verified preimage',async()=>{
 const f=fixture();await f.service.prepare(base());await f.service.apply(base());
 assert.equal((await f.service.rollback(base())).state,'ROLLED_BACK');
 assert.equal(f.data.get(target),a);assert.equal(f.calls.restore,1);
});
test('apply failure invokes verified rollback without declaring PASS',async()=>{
 const f=fixture();await f.service.prepare(base());f.flags.failApply=true;
 await assert.rejects(f.service.apply(base()),{message:'APPLY_FAILED_ROLLED_BACK'});
 assert.equal(f.data.get(target),a);assert.equal(f.calls.restore,1);
 assert.equal((await f.service.status({project:base().project,releaseId:base().releaseId})).state,'ROLLED_BACK');
});
test('rollback failure marks manual recovery required',async()=>{
 const f=fixture();await f.service.prepare(base());f.flags.failApply=true;f.flags.failRestore=true;
 await assert.rejects(f.service.apply(base()),{message:'APPLY_FAILED_MANUAL_RECOVERY'});
 assert.equal((await f.service.status({project:base().project,releaseId:base().releaseId})).state,'MANUAL_RECOVERY_REQUIRED');
});
test('non Dev environments and extra executable commands denied',async()=>{
 const v=base();v.environment='www';await rejection(v,'ENVIRONMENT_DENIED');
 for(const key of ['command','shell','script','arbitrary_path','sudo','restart_service','production_target']){
  const q=base();q[key]='x';await rejection(q,'FIELDS_DENIED');
 }
});
test('exact file allowlist, traversal, symlinks-as-path and Commerce scope denied',async()=>{
 for(const path of ['../../wp-config.php','wp-content/plugins/andy-commerce/a.php',
 'wp-content/plugins/yby-core/.env','/home/u/test.php',
 'wp-content/plugins/yby-core/admin/../../wp-config.php']){
  const v=base();v.files[0].path=path;await rejection(v,'PATH_DENIED');
 }
});
test('reject unapproved project and repo identity',async()=>{
 let v=base();v.project='byl-wordpress-commerce';await rejection(v,'PROJECT_DENIED');
 v=base();v.github.repo='some/other';await rejection(v,'GITHUB_REF_DENIED');
});
test('reject forged receipt/invalid artifact SHA and unknown file field',async()=>{
 let v=base();v.authorizationReceipt='x';await rejection(v,'OWNER_RECEIPT_REQUIRED');
 v=base();v.artifact.sha256='bad';await rejection(v,'ARTIFACT_DENIED');
 v=base();v.files[0].php='unsafe';await rejection(v,'FIELDS_DENIED');
});
test('reject duplicate files or invalid add preimage',async()=>{
 let v=base();v.files.push(clone(v.files[0]));await rejection(v,'PATH_DENIED');
 v=base();v.files[0].operation='add';await rejection(v,'PREIMAGE_DENIED');
});
test('reject CI failure, approval denial, HEAD change and manifest mismatch',async()=>{
 for(const [k,val] of [['ci','failure'],['allowed',false],['head','e'.repeat(40)],['wrongPaths',true]]){
  const f=fixture();f.flags[k]=val;await assert.rejects(f.service.prepare(base()),{message:'ATTESTATION_DENIED'});
  assert.equal(f.calls.prepare,0);
 }
});
test('detect backup failure and mutation between stage and commit',async()=>{
 let f=fixture();f.flags.backupVerified=false;await assert.rejects(f.service.prepare(base()),{message:'BACKUP_NOT_VERIFIED'});
 f=fixture();f.flags.stageMutates=true;await assert.rejects(f.service.prepare(base()),{message:'FILE_DRIFT_DENIED'});
});
test('site spoof/realpath safety fails closed',async()=>{
 const f=fixture();f.flags.invalidSnapshot=true;
 await assert.rejects(f.service.prepare(base()),{message:'SITE_IDENTITY_OR_PATH_DENIED'});
});
test('reject changing runtime since prepare',async()=>{
 const f=fixture();await f.service.prepare(base());f.data.set(target,'f'.repeat(64));
 await assert.rejects(f.service.apply(base()),{message:'FILE_DRIFT_DENIED'});
 assert.equal(f.calls.apply,0);
});
test('reject changing release manifest with same release ID',async()=>{
 const f=fixture();await f.service.prepare(base());const v=base();v.github.commitSha='e'.repeat(40);
 await assert.rejects(f.service.prepare(v),{message:'RELEASE_REPLAY_CONFLICT'});
});
test('rollback requires currently approved postimage',async()=>{
 const f=fixture();await f.service.prepare(base());await f.service.apply(base());f.data.set(target,a);
 await assert.rejects(f.service.rollback(base()),{message:'FILE_DRIFT_DENIED'});
});
test('read-only status requires independent authorization',async()=>{
 const f=fixture();f.flags.canView=false;
 await assert.rejects(f.service.status({project:base().project,releaseId:base().releaseId}),{message:'STATUS_AUTH_DENIED'});
});
test('unauthorized apply after prepare is blocked',async()=>{
 const f=fixture();await f.service.prepare(base());f.flags.allowed=false;
 await assert.rejects(f.service.apply(base()),{message:'ATTESTATION_DENIED'});
 assert.equal(f.calls.apply,0);
});
test('unprepared apply rejected',async()=>{
 const f=fixture();await assert.rejects(f.service.apply(base()),{message:'RELEASE_REPLAY_CONFLICT'});
});
test('manifest digest sorts paths independent of caller ordering',()=>{
 const v=base();v.files.push({path:added,operation:'add',beforeSha256:null,afterSha256:b});
 const other=clone(v);other.files.reverse();
 assert.equal(manifestDigest(v),manifestDigest(other));
});
test('invalid controller configuration fails before any deployment',()=>{
 assert.throws(()=>createDevReleaseService(),{message:'ADAPTER_NOT_CONFIGURED'});
});

test('lock rejects concurrent release attempts without duplicate receiver invocation',async()=>{
 const f=fixture();let unlock;const pending=f.store.withProjectLock('byl-wordpress-core',
   ()=>new Promise(resolve=>{unlock=resolve;}));
 await assert.rejects(f.service.prepare(base()),{message:'DEPLOY_LOCK_BUSY'});
 assert.equal(f.calls.prepare,0);unlock();await pending;
 const receipt=await f.service.prepare(base());assert.equal(receipt.state,'PREPARED');
});
test('idempotent apply does not falsely report success after runtime changes',async()=>{
 const f=fixture();await f.service.prepare(base());await f.service.apply(base());
 f.data.set(target,'f'.repeat(64));
 await assert.rejects(f.service.apply(base()),{message:'FILE_DRIFT_DENIED'});
 assert.equal(f.calls.apply,1);
});
test('a second release cannot reuse same approved manifest with different immutable artifact',async()=>{
 const f=fixture();await f.service.prepare(base());const v=base();
 v.artifact.sha256='e'.repeat(64);
 await assert.rejects(f.service.apply(v),{message:'RELEASE_REPLAY_CONFLICT'});
});
