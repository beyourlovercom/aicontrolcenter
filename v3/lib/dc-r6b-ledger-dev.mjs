/**
 * R6-B2/B4: Persistent local *synthetic* Dev request ledger.
 * No network, transport, device client, OAuth token, real approvals or execution.
 * A successful synthetic receipt MUST NOT be interpreted as a real device receipt.
 * Assumes a POSIX Dev machine with private owner-controlled /tmp root; same-UID
 * hostile processes are out of scope (not suitable for Production).
 */
import {createHash,randomUUID} from 'node:crypto';
import {realpathSync,lstatSync,mkdirSync,openSync,writeFileSync,readFileSync,
 closeSync,renameSync,unlinkSync,existsSync,readdirSync} from 'node:fs';
import {resolve,join,sep} from 'node:path';
const REF=/^[a-zA-Z0-9_-]{8,80}$/;
const SHA=/^[0-9a-f]{40}$/;
const DIGEST=/^[0-9a-f]{64}$/;
const error=(code)=>Object.assign(new Error(code),{code});
function stop(code){throw error(code);}
function exact(o,keys){return !!o&&typeof o==='object'&&!Array.isArray(o)&&
  Object.keys(o).length===keys.length&&keys.every(k=>Object.hasOwn(o,k));}
function sha(v){return createHash('sha256').update(JSON.stringify(v)).digest('hex');}
function privateDir(path){
 let st;
 try{st=lstatSync(path);}catch{stop('R6B4_PRIVATE_ROOT_REQUIRED');}
 if(!st.isDirectory()||st.isSymbolicLink()||(st.mode&0o077)!==0||
    (typeof process.getuid==='function'&&st.uid!==process.getuid()))
  stop('R6B4_PRIVATE_ROOT_REQUIRED');
}
function rootPath(input){
 if(typeof input!=='string')stop('R6B4_PRIVATE_ROOT_REQUIRED');
 const tmp=realpathSync('/tmp'),root=resolve(input);
 if(!root.startsWith(tmp+sep)||!root.slice(tmp.length+1).startsWith('aicc-v3b-')||
     root.slice(tmp.length+1).includes(sep))stop('R6B4_PRIVATE_ROOT_REQUIRED');
 privateDir(root);
 return root;
}
function layout(root){
 const base=rootPath(root);
 const dir=join(base,'requests');
 mkdirSync(dir,{mode:0o700,recursive:true});privateDir(dir);
 return {base,dir,lease:join(base,'active-dev-lease.json')};
}
function location(root,id){
 if(!REF.test(id||''))stop('R6B4_REQUEST_INVALID');
 const l=layout(root),file=join(l.dir,id+'.json');
 if(existsSync(file)&&lstatSync(file).isSymbolicLink())stop('R6B4_RECORD_UNTRUSTED');
 return {...l,file};
}
function read(file){
 try{const r=JSON.parse(readFileSync(file,'utf8'));
  if(!r||r.schema!=='aicc.v3b.synthetic-request.v1'||!REF.test(r.requestId||''))
    stop('R6B4_RECORD_UNTRUSTED');
  return r;
 }catch(e){if(e.code==='R6B4_RECORD_UNTRUSTED')throw e;stop('R6B4_RECORD_UNTRUSTED');}
}
function save(file,data){
 const tmp=file+'.'+randomUUID()+'.tmp';
 const fd=openSync(tmp,'wx',0o600);
 try{writeFileSync(fd,JSON.stringify(data)+'\n');}finally{closeSync(fd);}
 renameSync(tmp,file);
}
function authorizedSyntheticPlan(p,now){
 if(!exact(p,['requestId','nonce','projectId','workPackageId','taskId',
 'repositoryIdentity','branch','head','deviceId','operation','scopeDigest','expiresAtMs'])||
 !REF.test(p.requestId)||!REF.test(p.nonce)||!REF.test(p.projectId)||
 !REF.test(p.workPackageId)||!REF.test(p.taskId)||!SHA.test(p.head)||
 !DIGEST.test(p.scopeDigest)||p.repositoryIdentity!=='beyourlovercom/aicontrolcenter'||
 !REF.test(p.branch)||p.branch==='main'||p.deviceId!=='us-macmini'||
 p.operation!=='remote_process_selftest'||!Number.isSafeInteger(now)||
 !Number.isSafeInteger(p.expiresAtMs)||p.expiresAtMs<=now||p.expiresAtMs-now>60000)
 stop('R6B4_PLAN_DENIED');
}
/** Reserve exactly once; does not grant real execution, even with valid proofs. */
export function reserveDevRequest(root,plan,nowMs){
 authorizedSyntheticPlan(plan,nowMs);
 const {file,base}=location(root,plan.requestId);
 // Project-wide nonce consumption survives revocation/crash; never reissue.
 const nonceDir=join(base,'nonces');
 mkdirSync(nonceDir,{mode:0o700,recursive:true});privateDir(nonceDir);
 const nonceFile=join(nonceDir,plan.nonce+'.json');
 let nonceFd;
 try{nonceFd=openSync(nonceFile,'wx',0o600);}catch(e){
  if(e.code==='EEXIST')stop('R6B4_NONCE_REPLAY_STOP');throw e;
 }
 try{writeFileSync(nonceFd,JSON.stringify({nonce:plan.nonce,requestId:plan.requestId})+'\n');}
 finally{closeSync(nonceFd);}
 const record={schema:'aicc.v3b.synthetic-request.v1',...plan,
  planDigest:sha(plan),state:'PREPARED_DEV_ONLY',syntheticAttempts:0,
  realDispatch:'STOP',productionEnabled:false,receiptDigest:null,
  errorCode:null};
 let fd;
 try{fd=openSync(file,'wx',0o600);}catch(e){
  if(e.code==='EEXIST')stop('R6B4_DUPLICATE_REQUEST_STOP');throw e;
 }
 try{writeFileSync(fd,JSON.stringify(record)+'\n');}finally{closeSync(fd);}
 return Object.freeze({...record});
}
export function readDevRequest(root,id){
 const {file}=location(root,id);return Object.freeze({...read(file)});
}
export function stageSyntheticAttempt(root,id,nowMs){
 const {file,lease}=location(root,id),r=read(file);
 if(r.state!=='PREPARED_DEV_ONLY'||r.syntheticAttempts!==0||
  !Number.isSafeInteger(nowMs)||nowMs>=r.expiresAtMs)stop('R6B4_STAGE_DENIED');
 let fd;
 try{fd=openSync(lease,'wx',0o600);}catch(e){
  if(e.code==='EEXIST')stop('R6B4_PROJECT_BUSY');throw e;
 }
 try{writeFileSync(fd,JSON.stringify({requestId:id,planDigest:r.planDigest})+'\n');}
 finally{closeSync(fd);}
 // No actual device or mock transport is called. This models an uncertain send window.
 const next={...r,state:'SYNTHETIC_INFLIGHT',syntheticAttempts:1};
 try{save(file,next);}catch(e){stop('R6B4_QUARANTINE_REQUIRED');}
 return Object.freeze({...next});
}
function verifyLease(lease,r){
 if(!existsSync(lease)||lstatSync(lease).isSymbolicLink())stop('R6B4_LEASE_MISMATCH');
 let v;try{v=JSON.parse(readFileSync(lease,'utf8'));}catch{stop('R6B4_LEASE_MISMATCH');}
 if(v.requestId!==r.requestId||v.planDigest!==r.planDigest)stop('R6B4_LEASE_MISMATCH');
}
export function recordSyntheticReceipt(root,id,receipt,nowMs){
 const {file,lease}=location(root,id),r=read(file);
 if(r.state!=='SYNTHETIC_INFLIGHT')stop('R6B4_TERMINAL_STOP');
 verifyLease(lease,r);
 if(!Number.isSafeInteger(nowMs)||nowMs>=r.expiresAtMs||
    !exact(receipt,['source','requestId','nonce','planDigest','deviceId','operation','resultDigest','ok'])||
    receipt.source!=='SYNTHETIC_ONLY'||receipt.requestId!==r.requestId||
    receipt.nonce!==r.nonce||receipt.planDigest!==r.planDigest||
    receipt.deviceId!==r.deviceId||receipt.operation!==r.operation||
    !DIGEST.test(receipt.resultDigest)||receipt.ok!==true){
  const stopped={...r,state:'UNCERTAIN_STOP',errorCode:'R6B4_SYNTHETIC_RECEIPT_UNVERIFIED'};
  save(file,stopped);return Object.freeze({...stopped});
 }
 const next={...r,state:'SYNTHETIC_COMPLETED',receiptDigest:sha(receipt)};
 save(file,next);
 unlinkSync(lease);
 return Object.freeze({...next});
}
export function revokeDevRequest(root,id){
 const {file}=location(root,id),r=read(file);
 if(r.state==='PREPARED_DEV_ONLY'){
  const next={...r,state:'REVOKED_STOP',errorCode:'R6B4_SYNTHETIC_REVOKED'};
  save(file,next);return Object.freeze({...next});
 }
 if(r.state==='SYNTHETIC_INFLIGHT'){
  const next={...r,state:'UNCERTAIN_STOP',errorCode:'R6B4_REVOKED_IN_FLIGHT'};
  save(file,next);return Object.freeze({...next});
 }
 stop('R6B4_TERMINAL_STOP');
}
/** Startup recovery intentionally quarantines all interrupted synthetic attempts. */
export function reconcileDevLedger(root){
 const {dir}=layout(root),changed=[];
 for(const name of readdirSync(dir)){
  if(!/^[A-Za-z0-9_-]{8,80}\.json$/.test(name))stop('R6B4_RECORD_UNTRUSTED');
  const id=name.slice(0,-5),{file}=location(root,id),r=read(file);
  if(r.requestId!==id)stop('R6B4_RECORD_UNTRUSTED');
  if(r.state==='SYNTHETIC_INFLIGHT'){
   const next={...r,state:'UNCERTAIN_STOP',errorCode:'R6B4_CRASH_RECOVERY'};
   save(file,next);changed.push(next.requestId);
  }
 }
 return Object.freeze(changed);
}
export function devLedgerStatus(){
 return Object.freeze({schema:'aicc.v3b.dev-ledger-status.v1',
  mode:'LOCAL_SYNTHETIC_SIMULATOR',decision:'STOP',automaticDispatchAllowed:false,
  liveRemoteReceiptVerified:false,liveRemoteNonceLedger:false,
  productionEnabled:false});
}
