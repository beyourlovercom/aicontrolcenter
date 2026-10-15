/**
 * Dev-only filesystem receiver CANDIDATE: not a service, no SSH/network/tools.
 * This module may be installed on Dev only after independent Owner/operator approval.
 * Trust anchors (siteRoot, backupRoot, artifactResolver, phpLint) are server-owned.
 */
import {mkdir,readFile,writeFile,lstat,realpath,rename,unlink,chmod} from 'node:fs/promises';
import {isAbsolute,resolve,join,sep,dirname} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {DEV_PROJECTS,validateDevManifest,manifestDigest} from './dev-allowlist-contract.mjs';

function deny(code){throw Object.assign(new Error(code),{code});}
const hash=data=>createHash('sha256').update(data).digest('hex');
const fileKey=path=>hash(Buffer.from(path));
const digest=/^[a-f0-9]{64}$/;
function checkPaths(project,files){
 if(project!=='byl-wordpress-core'||!Array.isArray(files)||files.length===0||
    files.length>DEV_PROJECTS[project].files.length)deny('RECEIVER_SCOPE_DENIED');
 const allowed=DEV_PROJECTS[project].files, seen=new Set();
 for(const f of files){
  if(!f||typeof f.path!=='string'||!allowed.includes(f.path)||seen.has(f.path))
    deny('RECEIVER_PATH_DENIED');
  seen.add(f.path);
 }
}
export function createDevFilesystemReceiver({siteRoot,backupRoot,site='dev.beyourlover.com',
  artifactResolver,phpLint}={}){
 const expected=join('domains','dev.beyourlover.com','public_html');
 if(site!=='dev.beyourlover.com'||typeof siteRoot!=='string'||!isAbsolute(siteRoot)||
    !resolve(siteRoot).endsWith(sep+expected)||typeof backupRoot!=='string'||
    !isAbsolute(backupRoot)||resolve(backupRoot)===resolve(siteRoot)||
    resolve(backupRoot).startsWith(resolve(siteRoot)+sep)||
    resolve(backupRoot).split(sep).some(part=>['domains','public_html','wp-content'].includes(part))||
    typeof artifactResolver?.loadVerified!=='function'||typeof phpLint!=='function')
    deny('RECEIVER_CONFIG_DENIED');
 const base=resolve(siteRoot),backupBase=resolve(backupRoot);
 async function safeBase(){
  if(await realpath(base)!==base)deny('SITE_ROOT_SYMLINK_DENIED');
  if(await realpath(backupBase).catch(()=>backupBase)!==backupBase)deny('BACKUP_ROOT_SYMLINK_DENIED');
 }
 async function target(path){
  let cursor=base;
  const parts=path.split('/');
  for(let i=0;i<parts.length;i++){
   cursor=join(cursor,parts[i]);
   try {
    const info=await lstat(cursor);
    if(info.isSymbolicLink()||(!info.isDirectory()&&i!==parts.length-1))
      deny('PATH_SYMLINK_OR_TYPE_DENIED');
    if(i===parts.length-1&&!info.isFile())deny('TARGET_NOT_FILE');
   } catch(e){
    if(e.code==='ENOENT'&&i===parts.length-1)return cursor;
    throw e;
   }
  }
  return cursor;
 }
 async function state(files){
  await safeBase();const out={};
  for(const f of files){
   const file=await target(f.path);
   let bytes=null;
   try{bytes=await readFile(file);}catch(e){if(e.code!=='ENOENT')throw e;}
   out[f.path]={site,realpathSafe:true,symlinkFree:true,sha256:bytes===null?null:hash(bytes)};
  }
  return out;
 }
 async function atomicWrite(dest,bytes,mode){
  const temp=join(dirname(dest),'.dc-dev-'+randomBytes(12).toString('hex'));
  try{
   await writeFile(temp,bytes,{flag:'wx',mode:0o600});
   await chmod(temp,mode);
   await rename(temp,dest);
  }finally{await unlink(temp).catch(()=>{});}
 }
 async function checked(m,backupId){
  validateDevManifest(m);
  if(backupId!==('backup-'+m.releaseId))deny('BACKUP_ID_DENIED');
  const wd=join(backupBase,'release-'+m.releaseId);
  const meta=JSON.parse(await readFile(join(wd,'receipt.json'),'utf8'));
  if(meta.digest!==manifestDigest(m)||meta.backupId!==backupId)
    deny('STAGED_MANIFEST_MISMATCH');
  return {wd,meta};
 }
 async function preimage(files){
  const got=await state(files);
  for(const f of files)if(got[f.path].sha256!==f.beforeSha256)deny('RECEIVER_PREIMAGE_DRIFT');
 }
 return Object.freeze({
  async inspect({project,files}={}){checkPaths(project,files);return state(files);},
  async prepare({manifest:m,manifestSha256}={}){
   validateDevManifest(m);checkPaths(m.project,m.files);
   if(manifestDigest(m)!==manifestSha256)deny('MANIFEST_HASH_DENIED');
   await safeBase();await mkdir(backupBase,{recursive:true,mode:0o700});
   await safeBase();
   await preimage(m.files);
   const artifact=await artifactResolver.loadVerified({id:m.artifact.id,sha256:m.artifact.sha256,
     repo:m.github.repo,commitSha:m.github.commitSha});
   if(!artifact||artifact.sha256!==m.artifact.sha256||!artifact.files||
      Object.keys(artifact.files).sort().join('|')!==m.files.map(f=>f.path).sort().join('|'))
      deny('ARTIFACT_VERIFICATION_DENIED');
   const wd=join(backupBase,'release-'+m.releaseId);
   await mkdir(wd,{mode:0o700});
   const modes={};
   for(const f of m.files){
    const bytes=artifact.files[f.path];
    if(!Buffer.isBuffer(bytes)||bytes.length<1||bytes.length>2*1024*1024||
       hash(bytes)!==f.afterSha256)deny('STAGED_FILE_HASH_DENIED');
    const live=await target(f.path);
    let mode=0o644,prior=null;
    try{
     const s=await lstat(live);mode=s.mode&0o777;prior=await readFile(live);
    }catch(e){if(e.code!=='ENOENT')throw e;}
    if(hash(prior??Buffer.alloc(0))!==f.beforeSha256 && !(prior===null&&f.beforeSha256===null))
      deny('RECEIVER_PREIMAGE_DRIFT');
    modes[f.path]=mode;
    const stagedPath=join(wd,'staged-'+fileKey(f.path));
    await writeFile(stagedPath,bytes,{flag:'wx',mode:0o600});
    if(hash(await readFile(stagedPath))!==f.afterSha256)deny('STAGED_VERIFY_FAILED');
    if(prior!==null){
      const backupPath=join(wd,'backup-'+fileKey(f.path));
      await writeFile(backupPath,prior,{flag:'wx',mode:0o600});
      if(hash(await readFile(backupPath))!==f.beforeSha256)deny('BACKUP_VERIFY_FAILED');
    }
   }
   await preimage(m.files);
   const backupId='backup-'+m.releaseId;
   await writeFile(join(wd,'receipt.json'),JSON.stringify({digest:manifestSha256,backupId,modes}),
     {flag:'wx',mode:0o600});
   return {backupId,verified:true};
  },
  async apply({manifest:m,manifestSha256,backupId}={}){
   const {wd,meta}=await checked(m,backupId);
   if(manifestSha256!==meta.digest)deny('APPLY_MANIFEST_MISMATCH');
   await preimage(m.files);
   // PHP lint is a FIXED trusted operator hook. No user-provided shell.
   for(const f of m.files){
    const staged=join(wd,'staged-'+fileKey(f.path));
    const bytes=await readFile(staged);
    if(hash(bytes)!==f.afterSha256)deny('STAGED_FILE_HASH_DENIED');
    if(f.path.endsWith('.php')&&(await phpLint({filePath:staged}))!==true)
      deny('PHP_LINT_DENIED');
   }
   for(const f of m.files){
    const current=(await state([f]))[f.path].sha256;
    if(current!==f.beforeSha256)deny('RECEIVER_PREIMAGE_DRIFT');
    await atomicWrite(await target(f.path),await readFile(join(wd,'staged-'+fileKey(f.path))),
      meta.modes[f.path]);
   }
  },
  async restore({manifest:m,backupId,strictIdentity}={}){
   if(strictIdentity!==true)deny('STRICT_RESTORE_REQUIRED');
   const {wd,meta}=await checked(m,backupId);
   const current=await state(m.files);
   for(const f of m.files){
    const observed=current[f.path].sha256;
    if(observed!==f.beforeSha256&&observed!==f.afterSha256)deny('RESTORE_EXTERNAL_DRIFT_DENIED');
   }
   for(const f of m.files){
    const live=await target(f.path);
    if(f.operation==='add'){
      if(current[f.path].sha256!==null)await unlink(live);
    }else{
      const original=await readFile(join(wd,'backup-'+fileKey(f.path)));
      if(hash(original)!==f.beforeSha256)deny('BACKUP_HASH_DENIED');
      await atomicWrite(live,original,meta.modes[f.path]);
    }
   }
   const after=await state(m.files);
   for(const f of m.files)if(after[f.path].sha256!==f.beforeSha256)deny('RESTORE_VERIFY_FAILED');
   return {restored:true};
  }
 });
}
