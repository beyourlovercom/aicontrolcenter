import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,statSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadProjectContext} from '../lib/project-context.mjs';
import {createTask,createWorkPackage,readWorkStore} from '../lib/work-store.mjs';
import {appendRunEvent,releaseLease,updateRun} from '../lib/run-store.mjs';
import {credentialFile,ensureBridgeCredential,readBridgeEvents,readBridgeState} from '../lib/bridge-store.mjs';
import {bridgeProjection,claimBridgeDelivery,reconcileBridgeStartup,recordBridgeReceipt,submitBridgeRequest} from '../lib/bridge-runtime.mjs';
import {createAiccV3Server} from '../server.mjs';

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-bridge-'));const repo=join(root,'repo');const home=join(root,'state');
  mkdirSync(repo);mkdirSync(home);git(repo,'init','-b','test/bridge');git(repo,'config','user.email','aicc@example.invalid');git(repo,'config','user.name','AICC Test');
  writeFileSync(join(repo,'README.md'),'bridge\n');git(repo,'add','.');git(repo,'commit','-m','fixture');
  writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',repositoryIdentity:'example/bridge',repositoryPath:repo}));
  const env={AICC_V3_HOME:home,AICC_BRIDGE_ALLOWED_ORIGIN:'chrome-extension://abcdefghijklmnopabcdefghijklmnop'};const context=loadProjectContext(env);
  const wp=createWorkPackage(context,{title:'Bridge WP',status:'ACTIVE'},env).workPackage;
  const task=createTask(context,{workPackageId:wp.id,title:'Bridge Task',status:'TODO'},env).task;
  const executorOptions={preflight:()=>({ready:true,path:'/tmp/fake-codex',version:'fake',model:'fake',authMode:'test'}),spawnWorker:()=>424242,processProbe:()=>true};
  const bridgeOptions={executorOptions,runUuid:()=> '10000000-0000-4000-8000-000000000001',claimUuid:()=> '20000000-0000-4000-8000-000000000001'};
  return {root,repo,home,env,context,wp,task,executorOptions,bridgeOptions};
}
function input(f,overrides={}){return {provider:'chatgpt-web',requestId:'30000000-0000-4000-8000-000000000001',conversationId:'conv-explicit-1',originTurnId:'origin-turn-1',taskId:f.task.id,instruction:'Exact bridge instruction.\n',...overrides};}
function completeRun(f,runId,content='  EXACT RESULT\nline2\n'){
  const raw=JSON.stringify({type:'item.completed',item:{type:'agent_message',text:content}});
  appendRunEvent(f.context,runId,'CODEX_STDOUT','CODEX',{raw},f.env);
  appendRunEvent(f.context,runId,'PROCESS_EXITED','EXECUTOR_WORKER',{exitCode:0},f.env);
  updateRun(f.context,runId,{state:'EXITED',exitCode:0},f.env);releaseLease(f.context,runId,f.env);return {content,raw};
}

test('automatic Bridge binding materializes deterministic WP and Task without Owner selection',()=>{
  const f=fixture();
  const auto={provider:'chatgpt-web',requestId:'30000000-0000-4000-8000-000000000088',conversationId:'conv-auto-1',originTurnId:'origin-auto-1',workPackageTitle:'Assistant planned WP',taskTitle:'Assistant planned Task',instruction:'Execute exact Assistant plan.\n'};
  const first=submitBridgeRequest(f.context,auto,f.env,{...f.bridgeOptions,runUuid:()=> '10000000-0000-4000-8000-000000000088'});
  const store=readWorkStore(f.context,f.env);
  const task=store.tasks.find(item=>item.id===first.request.taskId);const wp=store.workPackages.find(item=>item.id===first.request.workPackageId);
  assert.equal(wp.title,'Assistant planned WP');assert.equal(task.title,'Assistant planned Task');assert.equal(task.workPackageId,wp.id);
  const second=submitBridgeRequest(f.context,auto,f.env,{...f.bridgeOptions,runUuid:()=> '10000000-0000-4000-8000-000000000099'});
  assert.equal(second.created,false);assert.equal(second.request.taskId,first.request.taskId);assert.equal(second.request.workPackageId,first.request.workPackageId);
  const after=readWorkStore(f.context,f.env);assert.equal(after.workPackages.filter(item=>item.id===wp.id).length,1);assert.equal(after.tasks.filter(item=>item.id===task.id).length,1);
  assert.throws(()=>submitBridgeRequest(f.context,{...auto,taskTitle:'Drifted Task'},f.env,f.bridgeOptions),e=>e.code==='BRIDGE_REQUEST_CONFLICT');
});

test('Bridge request is idempotent and cannot drift origin, Task or instruction',()=>{
  const f=fixture();const first=submitBridgeRequest(f.context,input(f),f.env,f.bridgeOptions);
  const second=submitBridgeRequest(f.context,input(f),f.env,{...f.bridgeOptions,runUuid:()=> '10000000-0000-4000-8000-000000000099'});
  assert.equal(first.created,true);assert.equal(second.created,false);assert.equal(second.request.runId,first.request.runId);
  assert.throws(()=>submitBridgeRequest(f.context,input(f,{instruction:'different'}),f.env,f.bridgeOptions),e=>e.code==='BRIDGE_REQUEST_CONFLICT');
  assert.throws(()=>submitBridgeRequest(f.context,input(f,{conversationId:'other-conversation'}),f.env,f.bridgeOptions),e=>e.code==='BRIDGE_REQUEST_CONFLICT');
  assert.deepEqual(readBridgeEvents(f.context,first.request.requestId,f.env).filter(e=>e.type==='RUN_BOUND').length,1);
});

test('exact Task→Run→Result→Delivery content is preserved and terminal receipt is immutable',()=>{
  const f=fixture();const submitted=submitBridgeRequest(f.context,input(f),f.env,f.bridgeOptions);const exact='  RESULT WITH LEADING SPACE\nAND TRAILING\n';
  completeRun(f,submitted.request.runId,exact);const projection=bridgeProjection(f.context,submitted.request.requestId,f.env,f.bridgeOptions);
  assert.equal(projection.state.deliveryState,'READY');assert.equal(projection.delivery.content,exact);assert.equal(projection.delivery.runId,submitted.request.runId);
  const claimed=claimBridgeDelivery(f.context,submitted.request.requestId,{bridgeInstanceId:'bridge-instance-A'},f.env,f.bridgeOptions);
  assert.equal(claimed.state.deliveryState,'CLAIMED');assert.equal(claimed.delivery.content,exact);
  const receiptInput={claimId:claimed.claim.claimId,outcome:'DELIVERED',conversationId:'conv-explicit-1',contentSha256:claimed.delivery.contentSha256,providerMessageId:'provider-msg-1'};
  const delivered=recordBridgeReceipt(f.context,submitted.request.requestId,receiptInput,f.env,f.bridgeOptions);assert.equal(delivered.state.deliveryState,'DELIVERED');
  const duplicate=recordBridgeReceipt(f.context,submitted.request.requestId,receiptInput,f.env,f.bridgeOptions);assert.equal(duplicate.receipt.providerMessageId,'provider-msg-1');
  assert.throws(()=>recordBridgeReceipt(f.context,submitted.request.requestId,{...receiptInput,conversationId:'wrong'},f.env,f.bridgeOptions),e=>e.code==='BRIDGE_RECEIPT_MISMATCH');
});

test('safe pre-send abort permits only two retries after the initial claim',()=>{
  const f=fixture();const submitted=submitBridgeRequest(f.context,input(f),f.env,f.bridgeOptions);completeRun(f,submitted.request.runId);
  for(let attempt=1;attempt<=3;attempt++){
    const claimed=claimBridgeDelivery(f.context,submitted.request.requestId,{bridgeInstanceId:`bridge-${attempt}`},f.env,{...f.bridgeOptions,claimUuid:()=>`20000000-0000-4000-8000-00000000000${attempt}`});
    assert.equal(claimed.claim.attempt,attempt);
    const abortInput={claimId:claimed.claim.claimId,outcome:'ABORTED_BEFORE_SEND'};
    const aborted=recordBridgeReceipt(f.context,submitted.request.requestId,abortInput,f.env,f.bridgeOptions);
    assert.equal(aborted.state.deliveryState,'READY');
    const replay=recordBridgeReceipt(f.context,submitted.request.requestId,abortInput,f.env,f.bridgeOptions);assert.equal(replay.state.deliveryState,'READY');
  }
  assert.equal(readBridgeState(f.context,submitted.request.requestId,f.env).safePreSendRetryCount,2);
  assert.throws(()=>claimBridgeDelivery(f.context,submitted.request.requestId,{bridgeInstanceId:'bridge-4'},f.env,f.bridgeOptions),e=>e.code==='BRIDGE_RETRY_EXHAUSTED');
});

test('UNCERTAIN terminal receipt is idempotent only for the exact same claim/outcome',()=>{
  const f=fixture();const submitted=submitBridgeRequest(f.context,input(f),f.env,f.bridgeOptions);completeRun(f,submitted.request.runId);
  const claimed=claimBridgeDelivery(f.context,submitted.request.requestId,{bridgeInstanceId:'bridge-uncertain'},f.env,f.bridgeOptions);
  const receiptInput={claimId:claimed.claim.claimId,outcome:'UNCERTAIN'};
  const first=recordBridgeReceipt(f.context,submitted.request.requestId,receiptInput,f.env,f.bridgeOptions);assert.equal(first.state.deliveryState,'DELIVERY_UNCERTAIN');
  const replay=recordBridgeReceipt(f.context,submitted.request.requestId,receiptInput,f.env,f.bridgeOptions);assert.equal(replay.state.deliveryState,'DELIVERY_UNCERTAIN');
  assert.throws(()=>recordBridgeReceipt(f.context,submitted.request.requestId,{...receiptInput,claimId:'wrong-claim'},f.env,f.bridgeOptions),e=>e.code==='BRIDGE_RECEIPT_MISMATCH');
});

test('restart converts an unreceipted claimed delivery to DELIVERY_UNCERTAIN and forbids resend',()=>{
  const f=fixture();const submitted=submitBridgeRequest(f.context,input(f),f.env,f.bridgeOptions);completeRun(f,submitted.request.runId);
  const claimed=claimBridgeDelivery(f.context,submitted.request.requestId,{bridgeInstanceId:'bridge-crash'},f.env,f.bridgeOptions);assert.equal(claimed.state.deliveryState,'CLAIMED');
  const reconciled=reconcileBridgeStartup(f.context,f.env,f.bridgeOptions);assert.deepEqual(reconciled,[{requestId:submitted.request.requestId,state:'DELIVERY_UNCERTAIN'}]);
  assert.equal(readBridgeState(f.context,submitted.request.requestId,f.env).deliveryState,'DELIVERY_UNCERTAIN');
  assert.throws(()=>claimBridgeDelivery(f.context,submitted.request.requestId,{bridgeInstanceId:'bridge-again'},f.env,f.bridgeOptions),e=>e.code==='BRIDGE_DELIVERY_UNCERTAIN');
  assert.throws(()=>recordBridgeReceipt(f.context,submitted.request.requestId,{claimId:claimed.claim.claimId,outcome:'DELIVERED',conversationId:'conv-explicit-1',contentSha256:claimed.delivery.contentSha256},f.env,f.bridgeOptions),e=>e.code==='BRIDGE_DELIVERY_UNCERTAIN');
});

test('credential is owner-only and all four Bridge APIs require it without leaking token',async()=>{
  const f=fixture();const token=ensureBridgeCredential(f.env,{token:'test-bridge-token-000000000000000000000000'});assert.equal(statSync(credentialFile(f.env)).mode&0o777,0o600);
  const server=createAiccV3Server({env:f.env,executorOptions:f.executorOptions,bridgeOptions:{executorOptions:f.executorOptions,runUuid:f.bridgeOptions.runUuid,claimUuid:f.bridgeOptions.claimUuid}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;const headers={'content-type':'application/json','x-aicc-bridge-token':token};
  try{
    const denied=await fetch(`${base}/api/bridge/requests`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(input(f))});assert.equal(denied.status,401);
    for(const spec of [
      [`${base}/api/bridge/requests/30000000-0000-4000-8000-000000000001`,{method:'GET'}],
      [`${base}/api/bridge/requests/30000000-0000-4000-8000-000000000001/claim`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}],
      [`${base}/api/bridge/requests/30000000-0000-4000-8000-000000000001/receipt`,{method:'POST',headers:{'content-type':'application/json'},body:'{}'}]
    ])assert.equal((await fetch(spec[0],spec[1])).status,401);
    const createdResponse=await fetch(`${base}/api/bridge/requests`,{method:'POST',headers,body:JSON.stringify(input(f))});const created=await createdResponse.json();assert.equal(createdResponse.status,201);assert.equal(created.request.conversationId,'conv-explicit-1');assert.equal(JSON.stringify(created).includes(token),false);
    completeRun(f,created.request.runId,'API EXACT RESULT\n');
    const readResponse=await fetch(`${base}/api/bridge/requests/${created.request.requestId}`,{headers});const read=await readResponse.json();assert.equal(readResponse.status,200);assert.equal(read.bridge.delivery.content,'API EXACT RESULT\n');
    const claimResponse=await fetch(`${base}/api/bridge/requests/${created.request.requestId}/claim`,{method:'POST',headers,body:JSON.stringify({bridgeInstanceId:'api-bridge'})});const claim=await claimResponse.json();assert.equal(claimResponse.status,200);assert.equal(claim.state.deliveryState,'CLAIMED');
    const receiptResponse=await fetch(`${base}/api/bridge/requests/${created.request.requestId}/receipt`,{method:'POST',headers,body:JSON.stringify({claimId:claim.claim.claimId,outcome:'DELIVERED',conversationId:'conv-explicit-1',contentSha256:claim.delivery.contentSha256})});const receipt=await receiptResponse.json();assert.equal(receiptResponse.status,200);assert.equal(receipt.state.deliveryState,'DELIVERED');assert.equal(JSON.stringify(receipt).includes(token),false);
  }finally{await new Promise(resolve=>server.close(resolve));}
});

test('Browser Bridge CORS is extension-only, non-wildcard, and supports preflight',async()=>{
  const f=fixture();const token=ensureBridgeCredential(f.env,{token:'test-cors-token-00000000000000000000000000'});
  const server=createAiccV3Server({env:f.env,executorOptions:f.executorOptions,bridgeOptions:{executorOptions:f.executorOptions,runUuid:f.bridgeOptions.runUuid,claimUuid:f.bridgeOptions.claimUuid}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const origin='chrome-extension://abcdefghijklmnopabcdefghijklmnop';
  try{
    const preflight=await fetch(`${base}/api/bridge/requests/00000000-0000-4000-8000-000000000000`,{method:'OPTIONS',headers:{origin,'access-control-request-method':'GET','access-control-request-headers':'x-aicc-bridge-token'}});
    assert.equal(preflight.status,204);assert.equal(preflight.headers.get('access-control-allow-origin'),origin);assert.notEqual(preflight.headers.get('access-control-allow-origin'),'*');assert.match(preflight.headers.get('access-control-allow-headers')||'',/x-aicc-bridge-token/);
    const work=await fetch(`${base}/api/work`,{headers:{origin}});assert.equal(work.status,200);assert.equal(work.headers.get('access-control-allow-origin'),origin);
    const bootstrap=await fetch(`${base}/api/bridge/bootstrap`,{method:'POST',headers:{origin}});const boot=await bootstrap.json();assert.equal(bootstrap.status,200);assert.equal(boot.token,token);assert.equal(bootstrap.headers.get('access-control-allow-origin'),origin);
    const wrongExtension=await fetch(`${base}/api/bridge/bootstrap`,{method:'POST',headers:{origin:'chrome-extension://bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'}});assert.equal(wrongExtension.status,403);
    const bridge=await fetch(`${base}/api/bridge/requests/00000000-0000-4000-8000-000000000000`,{headers:{origin,'x-aicc-bridge-token':token}});assert.equal(bridge.status,400);assert.equal(bridge.headers.get('access-control-allow-origin'),origin);
    const denied=await fetch(`${base}/api/bridge/requests/00000000-0000-4000-8000-000000000000`,{method:'OPTIONS',headers:{origin:'https://chatgpt.com','access-control-request-method':'GET'}});assert.equal(denied.status,403);assert.equal(denied.headers.get('access-control-allow-origin'),null);
  }finally{await new Promise(resolve=>server.close(resolve));}
});
