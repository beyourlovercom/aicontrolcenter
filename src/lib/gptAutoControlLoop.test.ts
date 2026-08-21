import assert from 'node:assert/strict';
import {bindControlLoop, enableControlLoop, readControlLoop, buildFeedbackEnvelope, claimFeedback, markFeedbackInserting, markFeedbackInserted, markFeedbackSubmitting, markFeedbackSubmitted, completeFeedback, consumeGptControl, controlModePrompt, hashControlMessage, parseControlContract, projectAutoLoopStatus} from './gptAutoControlLoop.ts';
import type {InboxItem} from './bridgeCore.ts';

const loopId = 'aicc-v2-final-loop-001';
const wpId = 'AICC-V2-GPT-CODEX-BRIDGE-001';
const conversationId = 'conversation-uat-a';
const loop = bindControlLoop({control_loop_id: loopId, formal_wp_id: wpId, conversation_id: conversationId, current_task: 'aicc-control-loop-uat-round-1'});
assert.equal(loop.enabled, false, 'automatic mode defaults OFF');
assert.equal(loop.conversation_id, conversationId, 'one WP binds one conversation');
enableControlLoop(loopId, true);
assert.equal(readControlLoop(loopId)?.mode, 'ON');

const feedbackInput = {control_loop_id: loopId, formal_wp_id: wpId, conversation_id: conversationId, current_pr_id: null, task_id: 'aicc-control-loop-uat-round-1', instruction_id: 'aicc-auto-loop-uat-round-1', execution_id: 'execution-1', run_id: 'run-1', source: 'GPT_AUTO_CONTROL_LOOP', runtime: 'CODEX_CLI', model: 'luna-test-model', result_id: 'result-1', result_hash: 'hash-1', execution_result: 'AICC_LOOP_ROUND_1 = PASS\nBRANCH = rebuild/aicc-v2\nHEAD = abc'};
const envelope = buildFeedbackEnvelope(feedbackInput);
for (const field of ['AICC_FEEDBACK_V1', 'CONTROL_LOOP_ID:', 'FORMAL_WP_ID:', 'EXECUTION_ID:', 'RUN_ID:', 'RUNTIME: CODEX_CLI', 'MODEL: luna-test-model', 'RESULT_ID:', 'RESULT_HASH:', 'EXECUTION_RESULT_BEGIN', 'CONTROL_INSTRUCTION:']) assert.match(envelope, new RegExp(field.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
assert.doesNotMatch(envelope, /historical conversation/i);
const feedbackClaim = claimFeedback(feedbackInput);
assert.equal(feedbackClaim.claimGranted, true);
assert.equal(claimFeedback(feedbackInput).claimGranted, false, 'feedback submission is exactly once');
assert.equal(markFeedbackInserting(loopId, feedbackClaim.record!.feedback_key).attemptGranted, true);
markFeedbackInserted(loopId, feedbackClaim.record!.feedback_key);
assert.equal(markFeedbackSubmitting(loopId, feedbackClaim.record!.feedback_key).sendGranted, true);
markFeedbackSubmitted(loopId, feedbackClaim.record!.feedback_key);
completeFeedback(loopId, feedbackClaim.record!.feedback_key);
assert.equal(claimFeedback(feedbackInput).alreadyClaimed, true);
const mainControlIdentity = {binding_epoch: readControlLoop(loopId)!.binding_epoch, feedback_key: feedbackClaim.record!.feedback_key, expected_gpt_turn_id: feedbackClaim.record!.expected_gpt_turn_id};

const execution = `AICC_EXECUTION_V1\nINSTRUCTION_ID: aicc-auto-loop-uat-round-2\nENTITY_TYPE: WORK_PACKAGE\nENTITY_ID: ${wpId}\nEXECUTION_TYPE: READ_ONLY_AUDIT\nREPOSITORY: /Users/a/AI/007/AIcontrolcenter\nBRANCH: rebuild/aicc-v2\nSANDBOX: read-only\nREQUIRES_AUTHORIZATION: false\n\nINSTRUCTION_BEGIN\nRead package.json without modifying files.\nINSTRUCTION_END`;
assert.equal(parseControlContract(`\n${execution}`).ok, true, 'canonical control must be first non-whitespace content');
assert.equal(parseControlContract(`${execution}\n很好，继续...`).ok, false, 'execution contracts reject trailing prose');
assert.equal(parseControlContract('很好，下一步执行...').ok, false, 'normal prose is never executable');
assert.equal(parseControlContract(`prose\n${execution}`).ok, false, 'contract after prose is invalid');

let launchCount = 0;
const submitted: string[] = [];
const submit = (instruction: any): InboxItem => { submitted.push(instruction.instructionId); return {id: instruction.instructionId, state: 'READY', instruction, rawInstruction: instruction.rawInstruction, gates: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()} as unknown as InboxItem; };
const launch = (id: string): InboxItem => { launchCount += 1; return {...submitmittedItem(id), state: 'LAUNCHED', runId: `run-${launchCount}`, executionId: `execution-${launchCount}`, model: 'luna-test-model', reasoning_effort: 'medium', model_source: 'CODEX_DEFAULT'} as unknown as InboxItem; };
function submitmittedItem(id: string): InboxItem { return {id, state: 'READY', gates: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()} as unknown as InboxItem; }
function consumedFeedback(controlLoopId:string,conversation:string,suffix:string){const loop=readControlLoop(controlLoopId)!;const record=claimFeedback({...feedbackInput,control_loop_id:controlLoopId,formal_wp_id:loop.formal_wp_id,conversation_id:conversation,binding_epoch:loop.binding_epoch,execution_id:`execution-${suffix}`,run_id:`run-${suffix}`,result_id:`result-${suffix}`,result_hash:`hash-${suffix}`}).record!;markFeedbackInserting(controlLoopId,record.feedback_key);markFeedbackInserted(controlLoopId,record.feedback_key);markFeedbackSubmitting(controlLoopId,record.feedback_key);markFeedbackSubmitted(controlLoopId,record.feedback_key);completeFeedback(controlLoopId,record.feedback_key);return {binding_epoch:loop.binding_epoch,feedback_key:record.feedback_key,expected_gpt_turn_id:record.expected_gpt_turn_id};}

const response = consumeGptControl({control_loop_id: loopId, conversation_id: conversationId, ...mainControlIdentity, assistant_message_id: 'assistant-round-2', response: execution}, submit, launch);
assert.equal(response.ok, true);
assert.equal(response.item?.state, 'LAUNCHED');
assert.equal(launchCount, 1);
assert.equal(response.item?.model_source, 'CODEX_DEFAULT');
assert.deepEqual(consumeGptControl({control_loop_id: loopId, conversation_id: conversationId, ...mainControlIdentity, assistant_message_id: 'assistant-round-2', response: execution}, submit, launch).duplicate, true, 'same assistant response is consumed once after remount');
assert.deepEqual(consumeGptControl({control_loop_id: loopId, conversation_id: conversationId, ...mainControlIdentity, assistant_message_id: 'message-4-after-remount', response: execution}, submit, launch).duplicate, true, 'same response hash is consumed once when DOM fallback identity changes');
assert.equal(launchCount, 1);
assert.equal(consumeGptControl({control_loop_id: loopId, conversation_id: 'conversation-uat-b', ...mainControlIdentity, assistant_message_id: 'assistant-round-3', response: execution}, submit, launch).code, 'CROSS_CONVERSATION_ISOLATION');

const stopIdentity=consumedFeedback(loopId,conversationId,'stop');
const stopContract = (type: string, messageId: string) => consumeGptControl({control_loop_id: loopId, conversation_id: conversationId, ...stopIdentity, assistant_message_id: messageId, response: `${type}\nCONTROL_LOOP_TEST: PASS\nREASON: THREE_AUTOMATIC_ROUNDS_COMPLETED`}, submit, launch);
assert.equal(stopContract('AICC_OWNER_UAT_V1', 'assistant-uat').ok, true);
assert.equal(readControlLoop(loopId)?.status, 'WAITING_OWNER_UAT');
assert.equal(stopContract('AICC_WP_COMPLETE_V1', 'assistant-complete').ok, false, 'owner UAT state stops later automatic execution');
assert.equal(readControlLoop(loopId)?.status, 'WAITING_OWNER_UAT');
const completeLoopId = 'aicc-v2-complete-loop';
bindControlLoop({control_loop_id: completeLoopId, formal_wp_id: wpId, conversation_id: 'conversation-complete'});
enableControlLoop(completeLoopId, true);
assert.equal(consumeGptControl({control_loop_id: completeLoopId, conversation_id: 'conversation-complete', ...consumedFeedback(completeLoopId,'conversation-complete','complete'), assistant_message_id: 'assistant-complete', response: 'AICC_WP_COMPLETE_V1\nCONTROL_LOOP_TEST: PASS'}, submit, launch).ok, true);
assert.equal(readControlLoop(completeLoopId)?.status, 'COMPLETE');
assert.equal(consumeGptControl({control_loop_id: completeLoopId, conversation_id: 'conversation-complete', binding_epoch:readControlLoop(completeLoopId)!.binding_epoch,feedback_key:'stopped', assistant_message_id: 'assistant-fourth', response: execution}, submit, launch).code, 'AUTO_LOOP_STOPPED');

const blockedLoopId = 'aicc-v2-blocked-loop';
bindControlLoop({control_loop_id: blockedLoopId, formal_wp_id: wpId, conversation_id: 'conversation-blocked'});
enableControlLoop(blockedLoopId, true);
assert.equal(consumeGptControl({control_loop_id: blockedLoopId, conversation_id: 'conversation-blocked', ...consumedFeedback(blockedLoopId,'conversation-blocked','blocked'), assistant_message_id: 'assistant-blocked', response: 'AICC_BLOCKED_V1\nBLOCKER_CODE: TEST_BLOCKED'}, submit, launch).ok, true);
assert.equal(readControlLoop(blockedLoopId)?.status, 'BLOCKED');

assert.match(controlModePrompt(wpId), /AICC V2 GPT Control Mode/);
assert.match(controlModePrompt(wpId), /Round 3 result → AICC_OWNER_UAT_V1 and STOP/);
assert.equal(hashControlMessage('  x\r\n'), hashControlMessage('x\n'));
assert.equal(projectAutoLoopStatus(readControlLoop(loopId)).label, 'AUTO LOOP · WAITING OWNER UAT');
assert.equal(readControlLoop(loopId)?.owner_click_count_after_round_1, 0);
console.log('GPT auto control loop contract tests passed');
