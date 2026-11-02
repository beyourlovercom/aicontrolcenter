import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,realpathSync,mkdirSync,writeFileSync,readFileSync,symlinkSync,chmodSync} from 'node:fs';
import {join} from 'node:path';
import {createTask,createWorkPackage,projectStateKey} from '../lib/work-store.mjs';
import {dcAdapterDevStatus,planDcMock,executeDcMock,readDcMockReceipt,reconcileDcMock} from '../lib/dc-auto-adapter-dev.mjs';
import {assertDcAutomaticDispatchAllowed} from '../lib/dc-primary-gate-v3.mjs';
import {createAiccV3Server} from '../server.mjs';

const HEAD='6cd4101e5e418388a145185022340140e1070aed';
let seq=0;
function fixture(){
 const root=mkdtempSync(join(realpathSync('/tmp'),'aicc-v3b-test-'));
 const env={AICC_EXECUTOR_GOVERNANCE_V3_ENABLED:'1',AICC_DC_AUTO_ADAPTER_DEV_MOCK:'1',
  AICC_V3_HOME:join(root,'state'),AICC_V3B_MOCK_ROOT:join(root,'mock')};
 const context={project:{id:'v3b-demo'},repository:{identity:'beyourlovercom/aicontrolcenter',
  path:join(root,'worktree'),branch:'feat/aicc-v3b',head:HEAD,dirty:false}};
 const wp=createWorkPackage(context,{title:'V3-B authorized Dev WP',status:'ACTIVE'},env).workPackage;
 const task=createTask(context,{title:'Mock DC Adapter tests',workPackageId:wp.id,status:'TODO'},env).task;
 const input={requestId:'request_'+String(++seq).padStart(8,'0'),taskId:task.id,workPackageId:wp.id,
  provider:'SELF_HOSTED_DC',repositoryIdentity:context.repository.identity,worktree:context.repository.path,
  branch:context.repository.branch,expectedHead:HEAD,deviceId:'us-macmini',
  executionClass:'TEST_ONLY',operation:'SCOPED_TEST_SUITE',suiteId:'V3_ADAPTER_TESTS',timeoutMs:500};
 const options={verifySyntheticGrant:(p)=>({issuer:'SYNTHETIC_TEST_AUTHORITY',
  requestId:p.requestId,planHash:p.planHash,deviceId:p.deviceId,nonce:'nonce_'+p.requestId,expiresAtMs:Date.now()+60000}),
  readSyntheticHealth:(id)=>({source:'SYNTHETIC_SIGNED_HEALTH',deviceId:id,online:true,verified:true}),
  mockTransport:{kind:'SYNTHETIC_MOCK',execute:async(p)=>({requestId:p.requestId,
   deviceId:p.deviceId,planHash:p.planHash,ok:true,resultDigest:'a'.repeat(40)})}};
 return {root,env,context,input,options};
}
function errorCode(fn,code){assert.throws(fn,e=>e?.code===code);}
async function rejectsCode(fn,code){await assert.rejects(fn,e=>e?.code===code);}

test('default OFF / independent real dispatch STOP even when mock enabled',()=>{
 assert.equal(dcAdapterDevStatus({}).adapterMode,'OFF');
 assert.equal(dcAdapterDevStatus({AICC_DC_AUTO_ADAPTER_DEV_MOCK:'1'}).adapterMode,'OFF');
 const f=fixture();
 assert.equal(dcAdapterDevStatus(f.env).adapterMode,'ISOLATED_DEV_MOCK');
 assert.equal(dcAdapterDevStatus(f.env).realDispatch,'STOP');
 errorCode(()=>assertDcAutomaticDispatchAllowed(),'DC_AUTO_DISPATCH_NOT_AUTHORIZED');
 errorCode(()=>planDcMock(f.context,f.input,{...f.env,AICC_DC_AUTO_ADAPTER_DEV_MOCK:'0'}),'DC_MOCK_FLAG_OFF');
 errorCode(()=>planDcMock(f.context,f.input,{...f.env,AICC_V3B_MOCK_ROOT:'/Users/a/.aicc-v3'}),'DC_MOCK_ISOLATION_REQUIRED');
});
test('typed plan binds task, work package, repository, exact head and device',()=>{
 const f=fixture(),p=planDcMock(f.context,f.input,f.env);
 assert.equal(p.head,HEAD);assert.equal(p.workPackageId,f.input.workPackageId);
 assert.equal(p.planHash.length,64);assert.equal(p.deviceId,'us-macmini');
 assert.equal(p.operation,'SCOPED_TEST_SUITE');
});
test('all permission and authority drifts STOP before writing receipt',()=>{
 const cases=[
  [{provider:'CLAUDE_CODE'},'DC_MOCK_PROVIDER_DENIED'],
  [{provider:'CODEX'},'DC_MOCK_PROVIDER_DENIED'],
  [{deviceId:'unknown'},'DC_MOCK_DEVICE_DENIED'],
  [{deviceId:'007windows-evil'},'DC_MOCK_DEVICE_DENIED'],
  [{operation:'ARBITRARY_SHELL'},'DC_MOCK_OPERATION_DENIED'],
  [{operation:'REVIEWED_PATCH_BUNDLE',executionClass:'CODE_CHANGE'},'DC_MOCK_ARGUMENTS_DENIED'],
  [{suiteId:'npm run deploy'},'DC_MOCK_ARGUMENTS_DENIED'],
  [{worktree:'/other/repo'},'DC_MOCK_REPOSITORY_DRIFT'],
  [{branch:'main'},'DC_MOCK_AUTHORITY_DRIFT'],
  [{expectedHead:'b'.repeat(40)},'DC_MOCK_AUTHORITY_DRIFT'],
  [{taskId:'not_found_task'},'DC_MOCK_WORK_BINDING_DENIED'],
  [{workPackageId:'missing_wpid'},'DC_MOCK_WORK_BINDING_DENIED'],
  [{executionClass:'CODE_CHANGE',operation:'REPOSITORY_STATUS'},'DC_MOCK_OPERATION_DENIED'],
  [{timeoutMs:1200,artifactSha256:'b'.repeat(40)},'DC_MOCK_ARGUMENTS_DENIED']
 ];
 for(const [change,code] of cases){const f=fixture();errorCode(()=>planDcMock(f.context,{...f.input,...change},f.env),code);}
 const f=fixture();f.context.repository.dirty=true;
 errorCode(()=>planDcMock(f.context,f.input,f.env),'DC_MOCK_DIRTY_WORKTREE');
 f.context.repository.dirty=false;f.context.repository.branch='main';
 errorCode(()=>planDcMock(f.context,{...f.input,branch:'main'},f.env),'DC_MOCK_AUTHORITY_DRIFT');
});
test('fake ownerApproved cannot authorize; expired, revoked, unsigned READY reject',async()=>{
 const f=fixture();
 await rejectsCode(()=>executeDcMock(f.context,{...f.input,ownerApproved:true},f.env,
  {...f.options,verifySyntheticGrant:undefined}),'DC_MOCK_INDEPENDENT_AUTH_REQUIRED');
 await rejectsCode(()=>executeDcMock(f.context,f.input,f.env,{...f.options,verifySyntheticGrant:()=>({issuer:'USER',ownerApproved:true})}),'DC_MOCK_INDEPENDENT_AUTH_REQUIRED');
 await rejectsCode(()=>executeDcMock(f.context,f.input,f.env,{...f.options,verifySyntheticGrant:p=>({...f.options.verifySyntheticGrant(p),expiresAtMs:Date.now()-10})}),'DC_MOCK_INDEPENDENT_AUTH_REQUIRED');
 await rejectsCode(()=>executeDcMock(f.context,f.input,f.env,{...f.options,isRevoked:()=>true}),'DC_MOCK_AUTH_REVOKED');
 await rejectsCode(()=>executeDcMock(f.context,f.input,f.env,{...f.options,readSyntheticHealth:()=>({state:'READY'})}),'DC_MOCK_HEALTH_UNVERIFIED');
 assert.equal(readDcMockReceiptSafe(f),null);
});
function readDcMockReceiptSafe(f){try{return readDcMockReceipt(f.context,f.input.requestId,f.env);}catch(e){if(e?.code==='DC_MOCK_RECEIPT_NOT_FOUND')return null;throw e;}}
test('synthetic E2E receipt, readback and duplicate exactly once',async()=>{
 const f=fixture();let dispatched=0;
 f.options.mockTransport.execute=async p=>{dispatched++;return {requestId:p.requestId,deviceId:p.deviceId,
  planHash:p.planHash,ok:true,resultDigest:'a'.repeat(40)};};
 const result=await executeDcMock(f.context,f.input,f.env,f.options);
 assert.equal(result.state,'COMPLETED');assert.equal(result.approvalSource,'SYNTHETIC_TEST_AUTHORITY');
 assert.equal(result.receipt.mode,'SYNTHETIC_MOCK');assert.equal(result.receipt.resultDigest,'a'.repeat(40));
 assert.equal(result.repositoryIdentity,'beyourlovercom/aicontrolcenter');
 assert.equal(result.instruction,undefined);assert.equal(result.token,undefined);
 const again=await executeDcMock(f.context,f.input,f.env,f.options);
 assert.deepEqual(again,result);assert.equal(dispatched,1);
 assert.deepEqual(readDcMockReceipt(f.context,f.input.requestId,f.env),result);
 await rejectsCode(()=>executeDcMock(f.context,{...f.input,deviceId:'china-mac'},f.env,f.options),'DC_MOCK_IDEMPOTENCY_CONFLICT');
});
test('mock CODE_CHANGE only accepts reviewed digest, no live writer',async()=>{
 const f=fixture();
 const i={...f.input,executionClass:'CODE_CHANGE',operation:'REVIEWED_PATCH_BUNDLE',artifactSha256:'b'.repeat(40),suiteId:undefined};
 assert.equal((await executeDcMock(f.context,i,f.env,f.options)).state,'COMPLETED');
});
test('nonce is single use across different requests',async()=>{
 const f=fixture();
 const o={...f.options,verifySyntheticGrant:p=>({...f.options.verifySyntheticGrant(p),nonce:'reused_nonce_123'})};
 await executeDcMock(f.context,f.input,f.env,o);
 await rejectsCode(()=>executeDcMock(f.context,{...f.input,requestId:'request_replay_2'},f.env,o),'DC_MOCK_NONCE_REPLAY');
});
test('timeout is UNCERTAIN_STOP with no retry, bad receipt and errors STOP',async()=>{
 const f=fixture();let calls=0;
 const opts={...f.options,mockTransport:{kind:'SYNTHETIC_MOCK',execute:()=>{calls++;return new Promise(()=>{});}}};
 const x=await executeDcMock(f.context,{...f.input,timeoutMs:100},f.env,opts);
 assert.equal(x.state,'UNCERTAIN_STOP');assert.equal(x.errorCode,'DC_MOCK_TIMEOUT');
 assert.equal((await executeDcMock(f.context,{...f.input,timeoutMs:100},f.env,opts)).state,'UNCERTAIN_STOP');
 assert.equal(calls,1);
 const g=fixture();
 g.options.mockTransport.execute=async()=>({ok:true});
 const y=await executeDcMock(g.context,g.input,g.env,g.options);
 assert.equal(y.state,'STOPPED');assert.equal(y.errorCode,'DC_MOCK_RECEIPT_INVALID');
 const h=fixture();h.options.mockTransport.execute=()=>{throw new Error('offline');};
 assert.equal((await executeDcMock(h.context,h.input,h.env,h.options)).state,'STOPPED');
});
test('restart recovery converts incomplete mock dispatch to UNCERTAIN_STOP',()=>{
 const f=fixture(),p=planDcMock(f.context,f.input,f.env);
 const path=join(f.env.AICC_V3B_MOCK_ROOT,projectStateKey(f.context),'requests',p.requestId+'.json');
 mkdirSync(join(f.env.AICC_V3B_MOCK_ROOT,projectStateKey(f.context),'requests'),{recursive:true});
 writeFileSync(path,JSON.stringify({requestId:p.requestId,planHash:p.planHash,state:'DISPATCHING'})+'\n');
 const changed=reconcileDcMock(f.context,f.env);
 assert.equal(changed.length,1);assert.equal(changed[0].state,'UNCERTAIN_STOP');
 assert.equal(readDcMockReceipt(f.context,p.requestId,f.env).errorCode,'DC_MOCK_RECOVERY_UNCERTAIN');
 assert.deepEqual(reconcileDcMock(f.context,f.env),[]);
});
test('read-only HTTP Dev status and no automatic POST endpoint',async()=>{
 const f=fixture();const server=createAiccV3Server({env:f.env});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{
  const url='http://127.0.0.1:'+server.address().port;
  const response=await fetch(url+'/api/dc-adapter/status');
  assert.equal(response.status,200);
  const status=await response.json();
  assert.equal(status.adapterMode,'ISOLATED_DEV_MOCK');
  assert.equal(status.realDispatch,'STOP');
  const denied=await fetch(url+'/api/dc-adapter/dispatch',{method:'POST',
    headers:{'content-type':'application/json'},body:JSON.stringify({ownerApproved:true})});
  assert.equal(denied.status,404);
  const old=await fetch(url+'/api/runs',{method:'POST',headers:{'content-type':'application/json'},body:'{}'});
  assert.equal(old.status,403);
  assert.equal((await old.json()).errorCode,'EXECUTOR_V3_DIRECT_RUN_NOT_AUTHORIZED');
 }finally{await new Promise(resolve=>server.close(resolve));}
});

test('symlink mock-root escape is blocked before work-store access',()=>{
 const f=fixture();
 symlinkSync(f.env.AICC_V3_HOME,f.env.AICC_V3B_MOCK_ROOT,'dir');
 errorCode(()=>planDcMock(f.context,f.input,f.env),'DC_MOCK_ISOLATION_REQUIRED');
});
test('project-level single writer blocks different request IDs concurrently',async()=>{
 const f=fixture();let started,release;
 const entered=new Promise(resolve=>{started=resolve;});
 const held=new Promise(resolve=>{release=resolve;});
 const options={...f.options,mockTransport:{kind:'SYNTHETIC_MOCK',execute:async p=>{
  started();await held;return {requestId:p.requestId,deviceId:p.deviceId,planHash:p.planHash,
  ok:true,resultDigest:'a'.repeat(40)};
 }}};
 const first=executeDcMock(f.context,f.input,f.env,options);
 await entered;
 await rejectsCode(()=>executeDcMock(f.context,{...f.input,requestId:'request_second_99'},f.env,options),'DC_MOCK_PROJECT_LEASE_ACTIVE');
 await rejectsCode(()=>executeDcMock(f.context,f.input,f.env,options),'DC_MOCK_IN_PROGRESS_STOP');
 release();
 assert.equal((await first).state,'COMPLETED');
 const next=await executeDcMock(f.context,{...f.input,requestId:'request_after_99'},f.env,options);
 assert.equal(next.state,'COMPLETED');
});
test('grant TTL expiry during dispatch aborts and quarantines lease',async()=>{
 const f=fixture();let aborted=false;
 const options={...f.options,verifySyntheticGrant:p=>({...f.options.verifySyntheticGrant(p),expiresAtMs:Date.now()+70}),
  mockTransport:{kind:'SYNTHETIC_MOCK',execute:(_,{signal})=>{
   signal.addEventListener('abort',()=>{aborted=true;},{once:true});
   return new Promise(()=>{});
  }}};
 const r=await executeDcMock(f.context,f.input,f.env,options);
 assert.equal(r.state,'UNCERTAIN_STOP');
 assert.equal(r.errorCode,'DC_MOCK_AUTH_EXPIRED_IN_FLIGHT');
 assert.equal(aborted,true);
 await rejectsCode(()=>executeDcMock(f.context,{...f.input,requestId:'request_after_ttl'},f.env,f.options),'DC_MOCK_PROJECT_LEASE_ACTIVE');
 assert.equal(reconcileDcMock(f.context,f.env).length,0);
 const next=await executeDcMock(f.context,{...f.input,requestId:'request_after_ttl'},f.env,f.options);
 assert.equal(next.state,'COMPLETED');
});
test('Dev server startup quarantines unfinished synthetic receipts',()=>{
 const f=fixture(),plan=planDcMock(f.context,f.input,f.env);
 const folder=join(f.env.AICC_V3B_MOCK_ROOT,projectStateKey(f.context),'requests');
 mkdirSync(folder,{recursive:true});
 writeFileSync(join(folder,plan.requestId+'.json'),JSON.stringify({requestId:plan.requestId,
  planHash:plan.planHash,state:'DISPATCHING'})+'\n');
 const repoRoot=new URL('../../',import.meta.url).pathname;
 writeFileSync(join(f.env.AICC_V3_HOME,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',
  id:f.context.project.id,name:'isolated test project',repositoryIdentity:f.context.repository.identity,
  repositoryPath:repoRoot})+'\n');
 const server=createAiccV3Server({env:f.env});server.close();
 assert.equal(readDcMockReceipt(f.context,plan.requestId,f.env).state,'UNCERTAIN_STOP');
});

test('mock state parent must be a private user-owned directory',()=>{
 const f=fixture();chmodSync(f.root,0o755);
 errorCode(()=>planDcMock(f.context,f.input,f.env),'DC_MOCK_ISOLATION_REQUIRED');
 chmodSync(f.root,0o700);
});
test('startup scans every isolated mock project, not just the active project',()=>{
 const f=fixture();
 const other={project:{id:'another_project'},repository:{...f.context.repository}};
 const entries=[[f.context,f.input.requestId],[other,'request_another_123']];
 for(const [context,id] of entries){
  const folder=join(f.env.AICC_V3B_MOCK_ROOT,projectStateKey(context),'requests');
  mkdirSync(folder,{recursive:true});
  writeFileSync(join(folder,id+'.json'),JSON.stringify({requestId:id,
   planHash:'c'.repeat(64),state:'DISPATCHING'})+'\n');
 }
 const server=createAiccV3Server({env:f.env});server.close();
 for(const [context,id] of entries)
  assert.equal(readDcMockReceipt(context,id,f.env).state,'UNCERTAIN_STOP');
});
