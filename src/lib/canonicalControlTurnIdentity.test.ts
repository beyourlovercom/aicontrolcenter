import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {bindControlLoop,claimFeedback,completeFeedback,consumeGptControl,enableControlLoop,markFeedbackInserted,markFeedbackInserting,markFeedbackSubmitted,markFeedbackSubmitting,readControlLoop,readControlLoopByConversation,readControlLoops,readExpectedControlTurn,readExpectedControlTurns} from './gptAutoControlLoop.ts';
import type {InboxItem} from './bridgeCore.ts';

const suffix=`${Date.now()}-${Math.random().toString(36).slice(2)}`;
const conversation=`canonical-turn-${suffix}`;
const canonicalLoop=`loop-A-${suffix}`;
const historicalLoop=`loop-B-${suffix}`;
const wpId='AICC-V2-GPT-CODEX-BRIDGE-001';
bindControlLoop({control_loop_id:historicalLoop,formal_wp_id:wpId,conversation_id:conversation});
enableControlLoop(historicalLoop,true);
for(let epoch=1;epoch<23;epoch++){
  const loop=readControlLoop(historicalLoop)!;
  loop.binding_epoch;
}
bindControlLoop({control_loop_id:canonicalLoop,formal_wp_id:wpId,conversation_id:conversation});
enableControlLoop(canonicalLoop,true);
assert.equal(readControlLoop(historicalLoop)?.enabled,false,'historical loop evidence remains durable but inert');
assert.equal(readControlLoopByConversation(conversation)?.control_loop_id,canonicalLoop,'one active canonical loop resolves per conversation');
assert.equal(readControlLoops().filter(loop=>loop.conversation_id===conversation).length,2,'historical loop record remains preserved');

const canonical=readControlLoop(canonicalLoop)!;
const feedback=claimFeedback({control_loop_id:canonicalLoop,formal_wp_id:wpId,conversation_id:conversation,binding_epoch:canonical.binding_epoch,execution_id:`execution-${suffix}`,run_id:`run-${suffix}`,result_id:`result-${suffix}`,result_hash:`hash-${suffix}`,execution_result:'ROUND_1 = PASS'}).record!;
markFeedbackInserting(canonicalLoop,feedback.feedback_key);
markFeedbackInserted(canonicalLoop,feedback.feedback_key);
markFeedbackSubmitting(canonicalLoop,feedback.feedback_key);
markFeedbackSubmitted(canonicalLoop,feedback.feedback_key);
completeFeedback(canonicalLoop,feedback.feedback_key,`feedback-message-${suffix}`);
const expected=readExpectedControlTurn(conversation)!;
assert.deepEqual({control_loop_id:expected.control_loop_id,binding_epoch:expected.binding_epoch,feedback_key:expected.feedback_key,feedback_message_id:expected.feedback_message_id,result_id:expected.result_id,result_hash:expected.result_hash,state:expected.state},{control_loop_id:canonicalLoop,binding_epoch:canonical.binding_epoch,feedback_key:feedback.feedback_key,feedback_message_id:`feedback-message-${suffix}`,result_id:`result-${suffix}`,result_hash:`hash-${suffix}`,state:'PENDING'});

const execution=`AICC_EXECUTION_V1\nINSTRUCTION_ID: canonical-turn-${suffix}\nENTITY_TYPE: WORK_PACKAGE\nENTITY_ID: ${wpId}\nEXECUTION_TYPE: READ_ONLY_AUDIT\nREPOSITORY: /Users/a/AI/007/AIcontrolcenter\nBRANCH: rebuild/aicc-v2\nSANDBOX: read-only\nREQUIRES_AUTHORIZATION: false\n\nINSTRUCTION_BEGIN\nVerify canonical expected turn identity.\nINSTRUCTION_END`;
let submitCount=0,launchCount=0;
const submit=(instruction:any):InboxItem=>{submitCount++;return {id:`inbox-${suffix}`,state:'READY',instruction,gates:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as unknown as InboxItem};
const launch=(id:string):InboxItem=>{launchCount++;return {id,state:'LAUNCHED',runId:`run-2-${suffix}`,executionId:`execution-2-${suffix}`,gates:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()} as unknown as InboxItem};
const consumed=consumeGptControl({conversation_id:conversation,assistant_message_id:`assistant-${suffix}`,response:execution,expected_gpt_turn_id:expected.expected_gpt_turn_id},submit,launch);
assert.equal(consumed.ok,true);
assert.equal(consumed.claim?.control_loop_id,canonicalLoop,'stale panel/default loop can never override expected turn identity');
assert.equal(consumed.claim?.binding_epoch,canonical.binding_epoch);
assert.equal(consumed.claim?.feedback_key,feedback.feedback_key);
assert.equal(consumed.expected_turn?.state,'CONSUMED');
assert.equal(submitCount,1);assert.equal(launchCount,1);
assert.equal(consumeGptControl({conversation_id:conversation,assistant_message_id:`assistant-${suffix}`,response:execution},submit,launch).duplicate,true,'same Assistant control is consumed at most once');
assert.equal(consumeGptControl({conversation_id:conversation,assistant_message_id:`assistant-remount-${suffix}`,response:execution},submit,launch).duplicate,true,'control hash remains exactly-once across remount identity drift');
assert.equal(submitCount,1);assert.equal(launchCount,1);

const rejectedConversation=`rejected-${suffix}`;
const rejectedLoop=`rejected-loop-${suffix}`;
bindControlLoop({control_loop_id:rejectedLoop,formal_wp_id:wpId,conversation_id:rejectedConversation});enableControlLoop(rejectedLoop,true);
const rejected=consumeGptControl({conversation_id:rejectedConversation,assistant_message_id:`rejected-assistant-${suffix}`,response:execution},submit,launch);
assert.equal(rejected.code,'EXPECTED_FEEDBACK_TURN_REQUIRED');
assert.equal(readControlLoop(rejectedLoop)?.status,'PAUSED','terminal identity conflict remains monotonic under polling');
assert.equal(consumeGptControl({conversation_id:rejectedConversation,assistant_message_id:`rejected-assistant-${suffix}`,response:execution},submit,launch).code,'AUTO_LOOP_STOPPED');
assert.equal(submitCount,1);assert.equal(launchCount,1,'rejected control creates no Task, Execution, or Run');
assert.ok(readExpectedControlTurns().some(turn=>turn.feedback_key===feedback.feedback_key),'canonical expected-turn evidence is durable');

const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
const worker=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/service-worker.js'),'utf8');
const consumeUi=content.match(/async function consumeNewAssistantControl\(\)[\s\S]*?(?=\n  async function sendInstruction)/)?.[0]??'';
const consumeWorker=worker.match(/async function autoLoopControl\(message\)[\s\S]*?(?=\nfunction returnEnvelope)/)?.[0]??'';
assert.doesNotMatch(consumeUi,/control_loop_id: status\.loop|binding_epoch: status\.loop|feedback_key: autoLoop/,'panel/default loop identity is absent from control consume');
assert.match(consumeUi,/conversation_id: currentConversationId\(\), assistant_message_id: current\.id, response: current\.text/);
assert.match(consumeWorker,/const evidence = \{ conversation_id: message\.conversation_id, assistant_message_id: message\.assistant_message_id, response: message\.response/);
assert.doesNotMatch(consumeWorker,/body: JSON\.stringify\(message\)/,'worker strips stale UI identity before control consume');
assert.match(worker,/body\.error\?\.code \|\| body\.code/,'canonical top-level server error code is preserved');
assert.match(content,/followsExpectedFeedbackTurn\(current\.message, status\.expected_turn\)/,'Assistant control must follow the exact canonical feedback User turn');
assert.doesNotMatch(content,/data-aicc-auto-loop-id|Control Loop ID/,'control loop ID remains system-managed and non-editable');
console.log('M8.2.1.8.8A canonical control turn identity regression passed');
