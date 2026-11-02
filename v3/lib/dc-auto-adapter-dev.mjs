/**
 * V3-B mock-only typed DC adapter. This module has no DC client or shell transport.
 * Real dispatch is intentionally not implemented; enabling this flag is NOT authority.
 */
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,openSync,closeSync,readFileSync,writeFileSync,renameSync,readdirSync,realpathSync,lstatSync,unlinkSync} from 'node:fs';
import {isAbsolute,join,resolve,sep,dirname} from 'node:path';
import {readWorkStore,projectStateKey} from './work-store.mjs';
import {DC_CANONICAL_DEVICES} from './dc-primary-gate-v3.mjs';

export const DC_ADAPTER_SCHEMA='aicc.v3b.dc-mock-plan.v1';
export const DC_ADAPTER_KINDS=Object.freeze(['TEST_ONLY','CODE_CHANGE']);
export const DC_ADAPTER_OPERATIONS=Object.freeze({
 TEST_ONLY:Object.freeze(['REPOSITORY_STATUS','SCOPED_TEST_SUITE']),
 CODE_CHANGE:Object.freeze(['REVIEWED_PATCH_BUNDLE'])
});
const SHA=/^[0-9a-f]{40}$/;
const ID=/^[A-Za-z0-9_-]{8,80}$/;
function fail(code){const e=new Error(code);e.code=code;throw e;}
function digest(value){return createHash('sha256').update(JSON.stringify(value)).digest('hex');}
function readJSON(path){try{return JSON.parse(readFileSync(path,'utf8'));}catch{fail('DC_MOCK_AUDIT_CORRUPT');}}
function atomicSave(path,data){
 const temporary=path+'.'+randomUUID()+'.tmp';
 writeFileSync(temporary,JSON.stringify(data,null,2)+'\n',{flag:'wx',mode:0o600});
 renameSync(temporary,path);
}
export function dcAdapterDevStatus(env={}){
 const governance=env.AICC_EXECUTOR_GOVERNANCE_V3_ENABLED==='1';
 const mockFlag=env.AICC_DC_AUTO_ADAPTER_DEV_MOCK==='1';
 return Object.freeze({schema:'aicc.v3b.dc-adapter-status.v1',
  governanceV3:governance,adapterMode:governance&&mockFlag?'ISOLATED_DEV_MOCK':'OFF',
  realDispatch:'STOP',realDispatcherImplemented:false,
  ownerAuthorization:'NOT_AVAILABLE',productionEnabled:false});
}
function assertTempIsolated(raw){
 if(typeof raw!=='string'||!isAbsolute(raw))fail('DC_MOCK_ISOLATION_REQUIRED');
 const base=realpathSync('/tmp'),target=resolve(raw);
 if(!target.startsWith(base+sep)||!target.includes('aicc-v3b-'))fail('DC_MOCK_ISOLATION_REQUIRED');
 const first=target.slice(base.length+1).split(sep)[0];
 if(!first.startsWith('aicc-v3b-'))fail('DC_MOCK_ISOLATION_REQUIRED');
 const top=join(base,first);
 let topStat;try{topStat=lstatSync(top);}catch{fail('DC_MOCK_ISOLATION_REQUIRED');}
 // /tmp sticky parent + private, current-user-owned top-level directory.
 // Other users cannot replace it, and cannot traverse nested mock state.
 if(!topStat.isDirectory()||topStat.isSymbolicLink()||
    topStat.uid!==(process.getuid?.()??topStat.uid)||
    (topStat.mode&0o077)!==0)fail('DC_MOCK_ISOLATION_REQUIRED');
 let cursor=base;
 for(const part of target.slice(base.length+1).split(sep)){
  cursor=join(cursor,part);
  try{if(lstatSync(cursor).isSymbolicLink())fail('DC_MOCK_ISOLATION_REQUIRED');}
  catch(error){if(error?.code!=='ENOENT')throw error;}
 }
 return target;
}
function devRoot(env){
 if(dcAdapterDevStatus(env).adapterMode!=='ISOLATED_DEV_MOCK')fail('DC_MOCK_FLAG_OFF');
 const root=assertTempIsolated(env.AICC_V3B_MOCK_ROOT);
 assertTempIsolated(env.AICC_V3_HOME);
 if(root===resolve(env.AICC_V3_HOME))fail('DC_MOCK_ISOLATION_REQUIRED');
 return root;
}
function isolatedPath(env,...components){
 const root=devRoot(env),target=join(root,...components);
 if(!target.startsWith(root+sep))fail('DC_MOCK_ISOLATION_REQUIRED');
 return assertTempIsolated(target);
}
export function planDcMock(context,input={},env={}){
 devRoot(env);
 const repo=context?.repository||{},project=context?.project||{};
 if(!project.id||!repo.identity||!repo.path)fail('DC_MOCK_CONTEXT_INVALID');
 if(!ID.test(input.requestId||'')||!ID.test(input.taskId||'')||!ID.test(input.workPackageId||''))fail('DC_MOCK_REQUEST_INVALID');
 if(!DC_ADAPTER_KINDS.includes(input.executionClass)||!DC_ADAPTER_OPERATIONS[input.executionClass].includes(input.operation))fail('DC_MOCK_OPERATION_DENIED');
 if(input.provider!=='SELF_HOSTED_DC')fail('DC_MOCK_PROVIDER_DENIED');
 if(!DC_CANONICAL_DEVICES.includes(input.deviceId))fail('DC_MOCK_DEVICE_DENIED');
 if(repo.identity!==input.repositoryIdentity||repo.path!==input.worktree||!isAbsolute(repo.path))fail('DC_MOCK_REPOSITORY_DRIFT');
 if(!SHA.test(input.expectedHead||'')||repo.head!==input.expectedHead||repo.branch!==input.branch||repo.branch==='main')fail('DC_MOCK_AUTHORITY_DRIFT');
 if(repo.dirty!==false)fail('DC_MOCK_DIRTY_WORKTREE');
 const store=readWorkStore(context,env);
 const task=store.tasks.find(t=>t.id===input.taskId&&t.workPackageId===input.workPackageId);
 const wp=store.workPackages.find(w=>w.id===input.workPackageId);
 if(!task||!wp||!['OPEN','ACTIVE'].includes(wp.status)||!['TODO','IN_PROGRESS'].includes(task.status))fail('DC_MOCK_WORK_BINDING_DENIED');
 if(input.operation==='SCOPED_TEST_SUITE'&&!['V3_ADAPTER_TESTS','V3_COMPAT_TESTS'].includes(input.suiteId))fail('DC_MOCK_ARGUMENTS_DENIED');
 if(input.operation==='REVIEWED_PATCH_BUNDLE'&&(!SHA.test(input.artifactSha256||'')||input.artifactSha256==='0'.repeat(40)))fail('DC_MOCK_ARGUMENTS_DENIED');
 if(input.operation==='REPOSITORY_STATUS'&&(input.suiteId!==undefined||input.artifactSha256!==undefined))fail('DC_MOCK_ARGUMENTS_DENIED');
 if(input.operation!=='SCOPED_TEST_SUITE'&&input.suiteId!==undefined)fail('DC_MOCK_ARGUMENTS_DENIED');
 if(input.operation!=='REVIEWED_PATCH_BUNDLE'&&input.artifactSha256!==undefined)fail('DC_MOCK_ARGUMENTS_DENIED');
 const plan=Object.freeze({
  schema:DC_ADAPTER_SCHEMA,requestId:input.requestId,taskId:task.id,workPackageId:wp.id,
  projectId:project.id,repositoryIdentity:repo.identity,worktree:repo.path,
  branch:repo.branch,head:repo.head,deviceId:input.deviceId,
  executionClass:input.executionClass,operation:input.operation,
  suiteId:input.suiteId||null,artifactSha256:input.artifactSha256||null,
  timeoutMs:Math.min(30000,Math.max(100,Number.isInteger(input.timeoutMs)?input.timeoutMs:5000))
 });
 return Object.freeze({...plan,planHash:digest(plan)});
}
function requestPath(context,plan,env){
 return isolatedPath(env,projectStateKey(context),'requests',plan.requestId+'.json');
}
function projectLeasePath(context,env){
 return isolatedPath(env,projectStateKey(context),'active-lease.json');
}
function lockProject(context,plan,env){
 const lease=projectLeasePath(context,env);mkdirSync(dirname(lease),{recursive:true});
 let fd;try{fd=openSync(lease,'wx',0o600);}catch{fail('DC_MOCK_PROJECT_LEASE_ACTIVE');}
 try{writeFileSync(fd,JSON.stringify({requestId:plan.requestId,planHash:plan.planHash})+'\n');}
 finally{closeSync(fd);}
 return lease;
}
function releaseProject(lease,record){
 if(!existsSync(lease))return;
 const current=readJSON(lease);
 if(current.requestId!==record.requestId||current.planHash!==record.planHash)fail('DC_MOCK_PROJECT_LEASE_MISMATCH');
 unlinkSync(lease);
}
function verifySyntheticAuthority(plan,options){
 // The callback is trusted test-harness injection, never request JSON or a browser header.
 if(typeof options.verifySyntheticGrant!=='function')fail('DC_MOCK_INDEPENDENT_AUTH_REQUIRED');
 const a=options.verifySyntheticGrant(plan);
 if(!a||a.issuer!=='SYNTHETIC_TEST_AUTHORITY'||a.requestId!==plan.requestId||
    a.planHash!==plan.planHash||a.deviceId!==plan.deviceId||
    !ID.test(a.nonce||'')||!Number.isSafeInteger(a.expiresAtMs)||
    a.expiresAtMs<=(typeof options.nowMs==='function'?options.nowMs():Date.now()))fail('DC_MOCK_INDEPENDENT_AUTH_REQUIRED');
 if(typeof options.isRevoked==='function'&&options.isRevoked(a.nonce))fail('DC_MOCK_AUTH_REVOKED');
 return a;
}
function validateMockHealth(plan,options){
 // READY is only registration; require separately injected synthetic live attestation.
 const h=options.readSyntheticHealth?.(plan.deviceId);
 if(!h||h.source!=='SYNTHETIC_SIGNED_HEALTH'||h.deviceId!==plan.deviceId||
    h.online!==true||h.verified!==true)fail('DC_MOCK_HEALTH_UNVERIFIED');
}
function saveTerminal(path,record,state,errorCode=null,receipt=null){
 const prior=readJSON(path);
 if(prior.state!=='DISPATCHING'||prior.planHash!==record.planHash)fail('DC_MOCK_TERMINAL_CONFLICT');
 const final={...record,state,errorCode,receipt,updatedAt:new Date().toISOString()};
 atomicSave(path,final);return final;
}
export async function executeDcMock(context,input,env={},options={}){
 const plan=planDcMock(context,input,env);
 const path=requestPath(context,plan,env);
 if(existsSync(path)){
  const current=readJSON(path);
  if(current.planHash!==plan.planHash)fail('DC_MOCK_IDEMPOTENCY_CONFLICT');
  if(current.state==='COMPLETED'||current.state==='STOPPED'||current.state==='UNCERTAIN_STOP')return current;
  fail('DC_MOCK_IN_PROGRESS_STOP');
 }
 const a=verifySyntheticAuthority(plan,options);
 validateMockHealth(plan,options);
 if(options.mockTransport?.kind!=='SYNTHETIC_MOCK'||typeof options.mockTransport.execute!=='function')fail('DC_MOCK_TRANSPORT_REQUIRED');
 const noncePath=isolatedPath(env,projectStateKey(context),'nonces',a.nonce+'.json');
 mkdirSync(dirname(path),{recursive:true});mkdirSync(dirname(noncePath),{recursive:true});
 const lease=lockProject(context,plan,env);
 let nonceHandle;try{nonceHandle=openSync(noncePath,'wx',0o600);}catch{fail('DC_MOCK_NONCE_REPLAY');}
 try{writeFileSync(nonceHandle,JSON.stringify({requestId:plan.requestId,planHash:plan.planHash})+'\n');}
 finally{closeSync(nonceHandle);}
 const record={schema:'aicc.v3b.dc-mock-receipt.v1',requestId:plan.requestId,taskId:plan.taskId,
  workPackageId:plan.workPackageId,projectId:plan.projectId,repositoryIdentity:plan.repositoryIdentity,
  deviceId:plan.deviceId,branch:plan.branch,head:plan.head,operation:plan.operation,
  executionClass:plan.executionClass,timeoutMs:plan.timeoutMs,planHash:plan.planHash,
  approvalSource:'SYNTHETIC_TEST_AUTHORITY',approvalExpiresAtMs:a.expiresAtMs,
  nonceHash:digest(a.nonce),state:'DISPATCHING',
  createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),errorCode:null,receipt:null};
 try{writeFileSync(path,JSON.stringify(record,null,2)+'\n',{flag:'wx',mode:0o600});}
 catch{fail('DC_MOCK_IDEMPOTENCY_CONFLICT');}
 let timer;
 const now=()=>typeof options.nowMs==='function'?options.nowMs():Date.now();
 const controller=new AbortController();
 try{
  const remaining=a.expiresAtMs-now();
  if(remaining<=0)fail('DC_MOCK_AUTH_EXPIRED_IN_FLIGHT');
  const deadline=Math.max(1,Math.min(plan.timeoutMs,remaining));
  const timed=new Promise((_,reject)=>{timer=setTimeout(()=>{
   controller.abort();
   const code=now()>=a.expiresAtMs?'DC_MOCK_AUTH_EXPIRED_IN_FLIGHT':'DC_MOCK_TIMEOUT';
   reject(Object.assign(new Error(code),{code}));
  },deadline);});
  const result=await Promise.race([Promise.resolve().then(()=>options.mockTransport.execute(plan,{signal:controller.signal})),timed]);
  if(now()>=a.expiresAtMs)fail('DC_MOCK_AUTH_EXPIRED_IN_FLIGHT');
  if(typeof options.isRevoked==='function'&&options.isRevoked(a.nonce))fail('DC_MOCK_AUTH_REVOKED_IN_FLIGHT');
  try{validateMockHealth(plan,options);}catch{fail('DC_MOCK_HEALTH_LOST');}
  if(!result||result.requestId!==plan.requestId||result.deviceId!==plan.deviceId||
     result.planHash!==plan.planHash||result.ok!==true||typeof result.resultDigest!=='string'||
     !SHA.test(result.resultDigest))fail('DC_MOCK_RECEIPT_INVALID');
  const completed=saveTerminal(path,record,'COMPLETED',null,{resultDigest:result.resultDigest,mode:'SYNTHETIC_MOCK'});
  releaseProject(lease,record);
  return completed;
 }catch(error){
  controller.abort();
  const code=error?.code||'DC_MOCK_TRANSPORT_FAILED';
  const uncertain=['DC_MOCK_TIMEOUT','DC_MOCK_AUTH_EXPIRED_IN_FLIGHT','DC_MOCK_AUTH_REVOKED_IN_FLIGHT','DC_MOCK_HEALTH_LOST'].includes(code);
  return saveTerminal(path,record,uncertain?'UNCERTAIN_STOP':'STOPPED',code);
 }finally{clearTimeout(timer);}
}
export function readDcMockReceipt(context,requestId,env={}){
 if(!ID.test(requestId||''))fail('DC_MOCK_REQUEST_INVALID');
 const path=isolatedPath(env,projectStateKey(context),'requests',requestId+'.json');
 if(!existsSync(path))fail('DC_MOCK_RECEIPT_NOT_FOUND');
 return readJSON(path);
}
function reconcileProjectKey(key,env){
 if(!/^[a-f0-9]{64}$/.test(key))fail('DC_MOCK_PROJECT_KEY_INVALID');
 const folder=isolatedPath(env,key,'requests'),lease=isolatedPath(env,key,'active-lease.json');
 if(!existsSync(folder)){
  if(existsSync(lease))fail('DC_MOCK_PROJECT_LEASE_ORPHANED');
  return [];
 }
 const changed=[];
 for(const name of readdirSync(folder)){
  if(!name.endsWith('.json'))continue;
  if(!ID.test(name.slice(0,-5)))fail('DC_MOCK_AUDIT_CORRUPT');
  const path=isolatedPath(env,key,'requests',name),record=readJSON(path);
  if(record.state==='DISPATCHING'){
   const x=saveTerminal(path,record,'UNCERTAIN_STOP','DC_MOCK_RECOVERY_UNCERTAIN');
   changed.push({requestId:x.requestId,projectKey:key,state:x.state});
  }
 }
 if(existsSync(lease)){
  const active=readJSON(lease);
  if(!ID.test(active.requestId||''))fail('DC_MOCK_AUDIT_CORRUPT');
  const associated=isolatedPath(env,key,'requests',active.requestId+'.json');
  if(!existsSync(associated))fail('DC_MOCK_PROJECT_LEASE_ORPHANED');
  const record=readJSON(associated);
  if(record.state==='DISPATCHING')fail('DC_MOCK_PROJECT_LEASE_ACTIVE');
  if(['COMPLETED','STOPPED','UNCERTAIN_STOP'].includes(record.state))releaseProject(lease,record);
 }
 return changed;
}
export function reconcileDcMock(context,env={}){
 return reconcileProjectKey(projectStateKey(context),env);
}
export function reconcileAllDcMocks(env={}){
 const root=devRoot(env);
 if(!existsSync(root))return [];
 const changed=[];
 for(const entry of readdirSync(root,{withFileTypes:true})){
  if(!/^[a-f0-9]{64}$/.test(entry.name))continue;
  if(!entry.isDirectory())fail('DC_MOCK_ISOLATION_REQUIRED');
  changed.push(...reconcileProjectKey(entry.name,env));
 }
 return changed;
}