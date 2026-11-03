import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile,readFile,stat,symlink} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createDurableReleaseStore} from './dev-allowlist-durable-store.mjs';
const sample=()=>({project:'byl-wordpress-core',releaseId:'release-20261014-01',
 digest:'a'.repeat(64),ownerReceipt:'owner-20261014-01',backupId:'backup-20261014-01',
 state:'PREPARED'});
async function fixture(){
 const base=await mkdtemp(join(tmpdir(),'dc-dev-journal-v1-'));
 const root=join(base,'dev-release-journal');
 const store=createDurableReleaseStore({root});
 return {base,root,store,cleanup:()=>rm(base,{recursive:true,force:true})};
}
test('durably journals receipt and recovers across store instances',async()=>{
 const f=await fixture();
 try{
  await f.store.withProjectLock(sample().project,async()=>{
   await f.store.put(sample());
  });
  const next=createDurableReleaseStore({root:f.root});
  assert.deepEqual(await next.get(sample().project,sample().releaseId),sample());
  assert.equal((await stat(join(f.root,sample().project,sample().releaseId+'.json'))).mode&0o077,0);
 }finally{await f.cleanup();}
});
test('project lock exclusively rejects overlapping work',async()=>{
 const f=await fixture();
 try{
  let release;const block=new Promise(r=>{release=r;});
  let acquired;
  const entered=new Promise(r=>{acquired=r;});
  const running=f.store.withProjectLock('byl-wordpress-core',async()=>{acquired();await block;});
  await entered;
  await assert.rejects(f.store.withProjectLock('byl-wordpress-core',async()=>{}),{message:'DEPLOY_LOCK_BUSY'});
  release();await running;
  assert.equal(await f.store.withProjectLock('byl-wordpress-core',async()=>42),42);
 }finally{await f.cleanup();}
});
test('locked journal remains blocked after simulated interrupted process',async()=>{
 const f=await fixture();
 try{
  await mkdir(join(f.root,'byl-wordpress-core'),{recursive:true,mode:0o700});
  await mkdir(join(f.root,'byl-wordpress-core','.exclusive.lock'));
  await assert.rejects(f.store.withProjectLock('byl-wordpress-core',async()=>{}),{message:'DEPLOY_LOCK_BUSY'});
 }finally{await f.cleanup();}
});
test('no untrusted project, out-of-scope root, or path traversal',async()=>{
 const f=await fixture();
 try{
  assert.throws(()=>createDurableReleaseStore({root:join(f.base,'domains','www.beyourlover.com','public_html','dev-release-journal')}),{message:'STORE_ROOT_DENIED'});
  await assert.rejects(f.store.get('../www','release-20261014-01'),{message:'STORE_PROJECT_DENIED'});
  await assert.rejects(f.store.get('byl-wordpress-core','../secret'),{message:'STORE_ID_DENIED'});
 }finally{await f.cleanup();}
});
test('corrupted receipts fail closed and cannot be silently replaced in reads',async()=>{
 const f=await fixture();
 try{
  await f.store.put(sample());
  const file=join(f.root,sample().project,sample().releaseId+'.json');
  await writeFile(file,'{"broken"');
  await assert.rejects(f.store.get(sample().project,sample().releaseId),{message:'STORE_CORRUPT'});
 }finally{await f.cleanup();}
});
test('root symlink rejected',async()=>{
 const f=await fixture();
 try{
  const actual=join(f.base,'other');await mkdir(actual,{recursive:true,mode:0o700});
  await symlink(actual,f.root);
  await assert.rejects(f.store.get(sample().project,sample().releaseId),{message:'STORE_ROOT_UNSAFE'});
 }finally{await f.cleanup();}
});
test('receipt rejects unknown fields and illegal states',async()=>{
 const f=await fixture();
 try{
  await assert.rejects(f.store.put({...sample(),cmd:'echo bad'}),{message:'STORE_RECEIPT_DENIED'});
  await assert.rejects(f.store.put({...sample(),state:'SUCCESS'}),{message:'STORE_RECEIPT_DENIED'});
 }finally{await f.cleanup();}
});
