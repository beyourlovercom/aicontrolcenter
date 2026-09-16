import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {conversationFromUrl,createOriginBinding,parseNextStepDecision,recoveryAction,sameConversation,settleWithTimeout} from '../browser-bridge/core.mjs';
import {createCoordinator} from '../browser-bridge/coordinator.mjs';

const root=join(fileURLToPath(new URL('..',import.meta.url)));
function memoryStorage(){
  const values={};return {
    values,
    async get(key){return values[key]===undefined?undefined:structuredClone(values[key]);},
    async set(key,value){values[key]=structuredClone(value);}
  };
}
function ids(){
  const values=['10000000-0000-4000-8000-000000000001','10000000-0000-4000-8000-000000000002','10000000-0000-4000-8000-000000000003'];
  return {uuid:()=>values.shift()};
}
function baseApi(){
  return {
    async createRequest(body){return {request:{...body,runId:'run-1'},run:{runId:'run-1'}};},
    async getRequest(){return {state:{deliveryState:'WAITING_RESULT'}};},
    async claim(){throw new Error('unexpected claim');},
    async receipt(){throw new Error('unexpected receipt');}
  };
}
test('conversation binding is explicit from chatgpt.com /c/ identity only',()=>{
  assert.equal(conversationFromUrl('https://chatgpt.com/c/conv-123?x=1').conversationId,'conv-123');
  assert.equal(conversationFromUrl('https://chatgpt.com/g/g-test/c/conv-456').conversationId,'conv-456');
  assert.equal(sameConversation('conv-123','https://chatgpt.com/c/conv-123'),true);
  assert.equal(sameConversation('conv-123','https://chatgpt.com/c/other'),false);
  assert.throws(()=>conversationFromUrl('https://example.com/c/conv-123'),e=>e.code==='BRIDGE_CONVERSATION_ID_UNAVAILABLE');
  const action=createOriginBinding({url:'https://chatgpt.com/c/conv-123',taskId:'task-1',taskTitle:'Task 1',instruction:'exact\n'},ids());
  assert.equal(action.requestId,'10000000-0000-4000-8000-000000000001');assert.equal(action.originTurnId,'10000000-0000-4000-8000-000000000002');
  assert.equal(action.instruction,'exact\n');
});

test('automatic origin binding carries Assistant WP/Task titles while manual exact Task remains supported',()=>{
  const auto=createOriginBinding({url:'https://chatgpt.com/c/conv-auto',workPackageTitle:'WP Auto',taskTitle:'Task Auto',instruction:'auto exact'},ids());
  assert.equal(auto.taskId,null);assert.equal(auto.workPackageTitle,'WP Auto');assert.equal(auto.taskTitle,'Task Auto');
  const manual=createOriginBinding({url:'https://chatgpt.com/c/conv-manual',taskId:'task-existing',taskTitle:'Existing Task',instruction:'manual exact'},ids());
  assert.equal(manual.taskId,'task-existing');assert.equal(manual.workPackageTitle,null);assert.equal(manual.taskTitle,'Existing Task');
  assert.throws(()=>createOriginBinding({url:'https://chatgpt.com/c/conv-manual',taskId:'task-existing',instruction:'manual exact'},ids()),e=>e.code==='BRIDGE_TASK_TITLE_REQUIRED');
});

test('strict next-step protocol allows EXECUTE or STOP_GATE only',()=>{
  const execute=parseNextStepDecision(`AICC_NEXT_STEP_V1\nAICC_DECISION: EXECUTE\nAICC_ACTION_CLASS: TEST_ONLY\nAICC_PROVIDER: CODEX\nAICC_PROVIDER_ROUTING_REASON: deterministic test verification\nAICC_WORK_PACKAGE: V5.4 Closed Loop\nAICC_TASK: Wire exact next step\nAICC_INSTRUCTION_BEGIN\nImplement only the exact task.\nRun tests.\nAICC_INSTRUCTION_END\nAICC_GATE_REASON: NONE`);
  assert.equal(execute.decision,'EXECUTE');assert.equal(execute.taskTitle,'Wire exact next step');assert.match(execute.instruction,/Run tests/);assert.equal(execute.provider,'CODEX');assert.equal(execute.providerRoutingReason,'deterministic test verification');
  const stop=parseNextStepDecision(`AICC_NEXT_STEP_V1\nAICC_DECISION: STOP_GATE\nAICC_ACTION_CLASS: STOP_GATE\nAICC_WORK_PACKAGE:\nAICC_TASK:\nAICC_INSTRUCTION_BEGIN\n\nAICC_INSTRUCTION_END\nAICC_GATE_REASON: Owner merge approval required`);
  assert.deepEqual(stop,{decision:'STOP_GATE',gateReason:'Owner merge approval required'});
  assert.throws(()=>parseNextStepDecision('AICC_NEXT_STEP_V1\nAICC_DECISION: EXECUTE\nAICC_TASK: missing wp'),e=>e.code==='NEXT_STEP_DECISION_INVALID');
});

test('next-step planning transport settles to UNCERTAIN fallback instead of hanging forever',async()=>{
  const never=new Promise(()=>{});
  const fallback={outcome:'UNCERTAIN',reason:'NEXT_STEP_PLAN_TRANSPORT_TIMEOUT'};
  const started=Date.now();
  const value=await settleWithTimeout(never,20,fallback);
  assert.deepEqual(value,fallback);
  assert.ok(Date.now()-started>=15);
  assert.equal(await settleWithTimeout(Promise.resolve('ok'),100,fallback),'ok');
});

test('enqueueAction ACKs from durable ledger before any network submission',async()=>{
  const storage=memoryStorage();let networkCalls=0;
  const api={...baseApi(),async createRequest(){networkCalls++;throw new Error('network must not run during enqueue');}};
  const coordinator=createCoordinator({storage,api,destination:{deliver:async()=>({outcome:'DELIVERED'})},ids:ids()});
  const queued=await coordinator.enqueueAction({url:'https://chatgpt.com/c/conv-ack',tabId:11,taskId:'task-1',taskTitle:'Task 1',instruction:'ack first'});
  assert.equal(networkCalls,0);assert.equal(queued.ledger.status,'SUBMIT_PENDING');assert.ok(storage.values.aiccBridgeRequestsV1?.[queued.ledger.requestId]);
});

test('terminal Run without Canonical Result becomes local RUN_FAILED instead of polling forever',async()=>{
  const storage=memoryStorage();
  const api={...baseApi(),async getRequest(){return {run:{runId:'run-failed',state:'EXITED',exitCode:1},delivery:null,state:{deliveryState:'WAITING_RESULT'}};}};
  const coordinator=createCoordinator({storage,api,destination:{deliver:async()=>({outcome:'DELIVERED'})},ids:ids()});
  const queued=await coordinator.enqueueAction({url:'https://chatgpt.com/c/conv-failed',tabId:12,taskId:'task-1',taskTitle:'Task 1',instruction:'fail exact'});
  const map=storage.values.aiccBridgeRequestsV1;map[queued.ledger.requestId]={...map[queued.ledger.requestId],status:'WAITING_RESULT',runId:'run-failed'};
  const result=await coordinator.pollOne(queued.ledger.requestId);
  assert.equal(result.ledger.status,'RUN_FAILED');assert.equal(result.ledger.lastError,'BRIDGE_RUN_FAILED');
});

test('remote Claude FAILED, UNCERTAIN and invalid completed result become terminal local ledger states',async()=>{
  for(const [projection,expectedStatus,expectedError] of [
    [{remoteExecution:{state:'FAILED'},delivery:null,state:{deliveryState:'WAITING_RESULT'}},'RUN_FAILED','BRIDGE_REMOTE_EXECUTION_FAILED'],
    [{remoteExecution:{state:'UNCERTAIN'},delivery:null,state:{deliveryState:'WAITING_RESULT'}},'RUN_UNCERTAIN','BRIDGE_REMOTE_EXECUTION_UNCERTAIN'],
    [{remoteExecution:{state:'COMPLETED'},remoteErrorCode:'BRIDGE_REMOTE_RESULT_INVALID',delivery:null,state:{deliveryState:'WAITING_RESULT'}},'RUN_FAILED','BRIDGE_REMOTE_RESULT_INVALID']
  ]){
    const storage=memoryStorage();const api={...baseApi(),async getRequest(){return projection;}};
    const coordinator=createCoordinator({storage,api,destination:{deliver:async()=>({outcome:'DELIVERED'})},ids:ids()});
    const queued=await coordinator.enqueueAction({url:'https://chatgpt.com/c/conv-remote-terminal',tabId:13,taskId:'task-1',taskTitle:'Task 1',instruction:'remote exact'});
    storage.values.aiccBridgeRequestsV1[queued.ledger.requestId]={...storage.values.aiccBridgeRequestsV1[queued.ledger.requestId],status:'WAITING_RESULT',runId:'remote-run-1'};
    const first=await coordinator.pollOne(queued.ledger.requestId);assert.equal(first.ledger.status,expectedStatus);assert.equal(first.ledger.lastError,expectedError);
    const second=await coordinator.pollOne(queued.ledger.requestId);assert.equal(second.ledger.status,expectedStatus);
  }
});

test('requestId and originTurnId are persisted before first network submission',async()=>{
  const storage=memoryStorage();let seen=null;
  const api={...baseApi(),async createRequest(body){
    const ledger=storage.values.aiccBridgeRequestsV1?.[body.requestId];
    assert.ok(ledger);assert.equal(ledger.status,'SUBMITTING');assert.equal(ledger.originTurnId,body.originTurnId);seen=body.requestId;
    return {request:{...body,runId:'run-1'},run:{runId:'run-1'}};
  }};
  const coordinator=createCoordinator({storage,api,destination:{deliver:async()=>({outcome:'DELIVERED'})},ids:ids()});
  const result=await coordinator.submitAction({url:'https://chatgpt.com/c/conv-1',tabId:7,taskId:'task-1',taskTitle:'Task 1',instruction:'do exact thing'});
  assert.equal(seen,result.ledger.requestId);assert.equal(result.ledger.status,'WAITING_RESULT');assert.equal(result.ledger.runId,'run-1');
  assert.equal(result.ledger.submitAttempts,1);
});
test('claim writes sendAttempted ledger before destination side effect and delivers exact receipt',async()=>{
  const storage=memoryStorage();let projection={state:{deliveryState:'WAITING_RESULT'}};let receiptBody=null;
  const api={...baseApi(),
    async getRequest(){return projection;},
    async claim(_requestId,body){assert.ok(body.bridgeInstanceId);return {claim:{claimId:'claim-1'},delivery:{deliveryId:'delivery-1',conversationId:'conv-1',content:'RESULT\n',contentSha256:'hash-1'}};},
    async receipt(_requestId,body){receiptBody=body;projection={state:{deliveryState:'DELIVERED'}};return {state:{deliveryState:'DELIVERED'}};}
  };
  let delivered=0;
  const destination={async deliver(){
    delivered++;const map=storage.values.aiccBridgeRequestsV1;const ledger=Object.values(map)[0];
    assert.equal(ledger.claimId,'claim-1');assert.equal(ledger.sendAttempted,true);return {outcome:'DELIVERED'};
  }};
  const coordinator=createCoordinator({storage,api,destination,ids:ids()});
  const submitted=await coordinator.submitAction({url:'https://chatgpt.com/c/conv-1',tabId:7,taskId:'task-1',taskTitle:'Task 1',instruction:'do it'});
  projection={state:{deliveryState:'READY'}};const final=await coordinator.pollOne(submitted.ledger.requestId);
  assert.equal(delivered,1);assert.equal(final.ledger.status,'DELIVERED');
  assert.deepEqual(receiptBody,{claimId:'claim-1',outcome:'DELIVERED',conversationId:'conv-1',contentSha256:'hash-1'});
});

test('lost receipt response retries receipt only and never repeats ChatGPT send',async()=>{
  const storage=memoryStorage();let projection={state:{deliveryState:'WAITING_RESULT'}};let receiptCalls=0;let sendCalls=0;
  const api={...baseApi(),async getRequest(){return projection;},
    async claim(){projection={state:{deliveryState:'CLAIMED',activeClaim:{claimId:'claim-loss'}}};return {claim:{claimId:'claim-loss'},delivery:{deliveryId:'delivery-loss',conversationId:'conv-loss',content:'EXACT',contentSha256:'hash-loss'}};},
    async receipt(_id,body){receiptCalls++;assert.equal(body.outcome,'DELIVERED');if(receiptCalls===1){const error=new Error('network lost');error.code='BRIDGE_AICC_UNREACHABLE';throw error;}projection={state:{deliveryState:'DELIVERED'}};return {state:{deliveryState:'DELIVERED'}};}
  };
  const destination={async deliver(){sendCalls++;return {outcome:'DELIVERED'};}};
  const coordinator=createCoordinator({storage,api,destination,ids:ids()});
  const submitted=await coordinator.submitAction({url:'https://chatgpt.com/c/conv-loss',tabId:9,taskId:'task-1',taskTitle:'Task 1',instruction:'exact'});projection={state:{deliveryState:'READY'}};
  await assert.rejects(()=>coordinator.pollOne(submitted.ledger.requestId));assert.equal(sendCalls,1);assert.equal(receiptCalls,1);
  const ledgerAfterLoss=await coordinator.getLedger(submitted.ledger.requestId);assert.equal(ledgerAfterLoss.sendAttempted,true);assert.equal(ledgerAfterLoss.pendingReceipt.outcome,'DELIVERED');
  const recovered=await coordinator.pollOne(submitted.ledger.requestId);assert.equal(recovered.ledger.status,'DELIVERED');assert.equal(sendCalls,1);assert.equal(receiptCalls,2);
});
test('claimed crash recovery aborts only before send and becomes uncertain after send attempt',async()=>{
  assert.equal(recoveryAction({state:{deliveryState:'CLAIMED',activeClaim:{claimId:'c1'}}},{claimId:'c1',sendAttempted:false}),'ABORT_RECEIPT');
  assert.equal(recoveryAction({state:{deliveryState:'CLAIMED',activeClaim:{claimId:'c1'}}},{claimId:'c1',sendAttempted:true}),'UNCERTAIN_RECEIPT');
  assert.equal(recoveryAction({state:{deliveryState:'CLAIMED',activeClaim:{claimId:'other'}}},{claimId:'c1',sendAttempted:false}),'UNCERTAIN_RECEIPT');
});

test('extension manifest and source keep credential privileged and forbid active/latest fallback',()=>{
  const manifest=JSON.parse(readFileSync(join(root,'browser-bridge/manifest.json'),'utf8'));
  assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.host_permissions,['https://chatgpt.com/*','http://127.0.0.1:1420/*']);
  assert.equal(manifest.permissions.includes('activeTab'),false);assert.equal(manifest.permissions.includes('scripting'),true);assert.equal(manifest.host_permissions.includes('<all_urls>'),false);
  const background=readFileSync(join(root,'browser-bridge/background.js'),'utf8');
  const options=readFileSync(join(root,'browser-bridge/options.js'),'utf8');
  assert.match(options,new RegExp(`EXPECTED_VERSION='${manifest.version.replaceAll('.', '\\.')}';`));
  const content=readFileSync(join(root,'browser-bridge/content.js'),'utf8');
  const pairing=readFileSync(join(root,'scripts/copy-bridge-pairing-token.mjs'),'utf8');
  assert.match(content,/Task Name/);assert.equal(content.includes('AICC_NEXT_STEP_POLL'),false,'content script must not poll Next-Step per tab');assert.match(content,/Task Name is required\. Submission blocked\./);assert.match(content,/dataset\.taskTitle/);assert.match(background,/BRIDGE_TASK_TITLE_MISMATCH/);
  assert.match(background,/TRUSTED_CONTEXTS/);assert.match(background,/x-aicc-bridge-token/);assert.match(background,/api\/bridge\/bootstrap/);assert.match(background,/autoPair/);assert.match(background,/chrome\.scripting\.executeScript/);assert.match(background,/reinjectOpenChatgptTabs/);assert.match(background,/AICC_LIST_TASKS/);
  assert.match(background,/snapshotOpenChatgptTabs/);assert.match(background,/chrome\.tabs\.query\(\{url:'https:\/\/chatgpt\.com\/\*'\}\)/);assert.equal(background.includes("chrome.tabs.query({url:'https://chatgpt.com/c/*'})"),false,'snapshot discovery must include Project conversation URLs');
  assert.equal(background.split('\n').some(line=>line.length>0&&!/^\s/.test(line)&&/\bawait\b/.test(line)),false,'MV3 service-worker event registration must not be delayed by top-level await');
  assert.match(options,/api\/bridge\/bootstrap/);assert.match(options,/chrome\.storage\.local\.set/);assert.match(options,/aiccBridgeTokenV1/);assert.equal(options.includes('console.log'),false);
  assert.equal(/chrome\.tabs\.query\(\{\s*active\s*:/.test(background),false);assert.equal(background.includes('currentWindow:true'),false);
  assert.equal(content.includes('x-aicc-bridge-token'),false);assert.equal(content.includes('aiccBridgeTokenV1'),false);assert.equal(content.includes('chrome.storage'),false);assert.match(content,/__AICC_V3_BRIDGE_CONTENT_VERSION__/);assert.match(content,/BRIDGE_BACKGROUND_TIMEOUT/);assert.match(content,/chrome\.runtime\.sendMessage\(\{type,\.\.\.payload\},response=>/);assert.match(background,/AbortController/);assert.match(content,/__AICC_V3_BRIDGE_CLEANUP__/);assert.match(content,/ui\.go\.textContent='Submitted'/);assert.match(content,/ui\.task\.disabled=true/);assert.match(content,/Exact instruction frozen for this request\./);
  assert.ok((content.match(/conversationId\(\)!==message\.conversationId/g)||[]).length>=2);assert.match(content,/function userTurnCount/);assert.match(content,/composer-submit-button/);assert.match(content,/type'\)\|\|''\)\.toLowerCase\(\)==='submit'/);assert.match(content,/clearComposer\(box,message\.content\)/);assert.equal(content.includes('function exactUserCount'),false);assert.match(content,/userTurnCount\(\)>before&&composerValue\(box\)!==message\.content/);
  assert.match(content,/data-message-author-role="assistant"/);assert.match(content,/✦ AICC/);
  assert.match(content,/function actionRowFromCopy/);assert.match(content,/function sourceTextForRow/);assert.match(content,/copy-turn-action-button/);assert.match(content,/document\.querySelectorAll\('button'\)\]\.filter\(isCopyButton\)/);assert.match(content,/row\.appendChild\(button\)/);
  assert.equal(content.includes('container.appendChild(button)'),false);assert.equal(content.includes("margin:'8px 0'"),false);
  assert.equal(pairing.includes('console.log(token)'),false);assert.match(pairing,/pbcopy/);
});


test('concurrent Room enqueue preserves both durable ledgers and planner permits four in-flight Rooms',async()=>{
  const storage=memoryStorage();const coordinator=createCoordinator({storage,api:baseApi(),destination:{deliver:async()=>({outcome:'DELIVERED'})},ids:{uuid:(()=>{let n=0;return()=>`10000000-0000-4000-8000-${String(++n).padStart(12,'0')}`;})()}});
  const [a,b]=await Promise.all([
    coordinator.enqueueAction({url:'https://chatgpt.com/c/room-a',workPackageTitle:'WP A',taskTitle:'Task A',instruction:'A'}),
    coordinator.enqueueAction({url:'https://chatgpt.com/c/room-b',workPackageTitle:'WP B',taskTitle:'Task B',instruction:'B'})
  ]);
  assert.notEqual(a.ledger.requestId,b.ledger.requestId);assert.equal((await coordinator.ledgers()).length,2);
  const background=readFileSync(join(root,'browser-bridge/background.js'),'utf8');assert.match(background,/NEXT_STEP_MAX_CONCURRENCY=4/);assert.match(background,/const nextStepInFlight=new Set\(\)/);assert.equal(background.includes('let nextStepPollRunning=false'),false);
});
