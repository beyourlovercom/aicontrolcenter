/**
 * Durable Dev release journal and exclusive local project locks.
 * Deliberately never breaks/removes stale locks automatically.
 * Exact site-specific operator root; no WWW/Public HTML paths.
 */
import {mkdir,lstat,realpath,readFile,writeFile,rename,unlink,rmdir} from 'node:fs/promises';
import {resolve,join,isAbsolute,sep} from 'node:path';
import {randomBytes} from 'node:crypto';

const ID=/^[A-Za-z0-9][A-Za-z0-9._-]{7,127}$/;
const SHA=/^[a-f0-9]{64}$/;
const STATES=new Set(['PREPARED','APPLYING','APPLIED','ROLLING_BACK','ROLLED_BACK','MANUAL_RECOVERY_REQUIRED']);
function deny(code){throw Object.assign(new Error(code),{code});}
const PROJECT='byl-wordpress-core';
function validateProject(project){
 if(project!==PROJECT)deny('STORE_PROJECT_DENIED');
}
function validateId(id){
 if(typeof id!=='string'||!ID.test(id)||id==='.'||id==='..')deny('STORE_ID_DENIED');
}
function validateRecord(rec){
 if(!rec||typeof rec!=='object'||Array.isArray(rec)||
    Object.keys(rec).sort().join(',')!=='backupId,digest,ownerReceipt,project,releaseId,state')
    deny('STORE_RECEIPT_DENIED');
 validateProject(rec.project);
 validateId(rec.releaseId);validateId(rec.backupId);validateId(rec.ownerReceipt);
 if(typeof rec.digest!=='string'||!SHA.test(rec.digest)||!STATES.has(rec.state))
    deny('STORE_RECEIPT_DENIED');
}
export function createDurableReleaseStore({root}={}){
 if(typeof root!=='string'||!isAbsolute(root)||!resolve(root).endsWith(sep+'dev-release-journal')||
    root.includes('public_html')||root.includes('/domains/')||
    root.includes('\\')||root.includes('\0'))
    deny('STORE_ROOT_DENIED');
 const journal=resolve(root);
 async function init(){
  await mkdir(journal,{recursive:true,mode:0o700});
  const info=await lstat(journal);
  if(!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)!==0||
     await realpath(journal)!==journal)deny('STORE_ROOT_UNSAFE');
 }
 function dir(project){validateProject(project);return join(journal,project);}
 async function projectRoot(project){
  await init();
  const sub=dir(project);
  await mkdir(sub,{recursive:true,mode:0o700});
  const info=await lstat(sub);
  if(!info.isDirectory()||info.isSymbolicLink()||(info.mode&0o077)!==0||
     await realpath(sub)!==sub)deny('STORE_PROJECT_UNSAFE');
  return sub;
 }
 const file=(project,releaseId)=>join(dir(project),releaseId+'.json');
 return Object.freeze({
  async withProjectLock(project,fn){
   if(typeof fn!=='function')deny('STORE_TASK_REQUIRED');
   const sub=await projectRoot(project),lock=join(sub,'.exclusive.lock');
   try{await mkdir(lock,{mode:0o700});}
   catch(e){if(e.code==='EEXIST')deny('DEPLOY_LOCK_BUSY');throw e;}
   try{return await fn();}
   finally{
    // If cleanup fails, leave the lock in place. Never continue as unlocked.
    await rmdir(lock).catch(()=>{});
   }
  },
  async get(project,releaseId){
   validateId(releaseId);
   await projectRoot(project);
   let raw;
   try{raw=await readFile(file(project,releaseId),'utf8');}
   catch(e){if(e.code==='ENOENT')return null;throw e;}
   let rec;try{rec=JSON.parse(raw);}catch{deny('STORE_CORRUPT');}
   validateRecord(rec);
   if(rec.project!==project||rec.releaseId!==releaseId)deny('STORE_IDENTITY_MISMATCH');
   return Object.freeze(rec);
  },
  async put(rec){
   validateRecord(rec);
   const sub=await projectRoot(rec.project);
   const path=file(rec.project,rec.releaseId);
   const temporary=join(sub,'.write-'+randomBytes(12).toString('hex'));
   try{
    await writeFile(temporary,JSON.stringify(rec),{flag:'wx',mode:0o600});
    await rename(temporary,path);
   }finally{await unlink(temporary).catch(()=>{});}
  }
 });
}
