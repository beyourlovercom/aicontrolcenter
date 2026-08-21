import assert from 'node:assert/strict';
import {bindControlLoop,claimFeedback,completeFeedback,consumeGptControl,enableControlLoop,markFeedbackInserted,markFeedbackInserting,markFeedbackSubmitted,markFeedbackSubmitting,projectControlLoopFeedback,canonicalControlLoopReadModel,rebindControlLoop,readControlLoop,readExpectedControlTurn,recoverFeedbackCorrelation} from './gptAutoControlLoop.ts';
import type {InboxItem} from './bridgeCore.ts';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const wp = 'AICC-V2-GPT-CODEX-BRIDGE-001';
const projectId = 'project-auto-loop-feedback-correlation-uat';
const repositoryIdentity = 'repo-auto-loop-feedback-correlation-uat';
const submit = (instruction: any): InboxItem => ({id: `inbox-${instruction.instructionId}`, state: 'READY', instruction, gates: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()} as unknown as InboxItem);
let launches = 0;
const launch = (id: string): InboxItem => ({id, state: 'LAUNCHED', runId: `run-${++launches}-${suffix}`, executionId: `execution-${launches}-${suffix}`, gates: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()} as unknown as InboxItem);

function feedback(loopId: string, conversationId: string, round: string) {
  const loop = readControlLoop(loopId)!;
  const record = claimFeedback({control_loop_id: loopId, projectId, repositoryIdentity, formal_wp_id: wp, conversation_id: conversationId, binding_epoch: loop.binding_epoch, execution_id: `execution-${round}-${suffix}`, run_id: `run-${round}-${suffix}`, result_id: `result-${round}-${suffix}`, result_hash: `hash-${round}-${suffix}`, execution_result: `${round} = PASS`}).record!;
  markFeedbackInserting(loopId, record.feedback_key); markFeedbackInserted(loopId, record.feedback_key); markFeedbackSubmitting(loopId, record.feedback_key); markFeedbackSubmitted(loopId, record.feedback_key); completeFeedback(loopId, record.feedback_key, `feedback-message-${round}-${suffix}`);
  return {record, expected: readExpectedControlTurn({conversation_id: conversationId, control_loop_id: loopId, binding_epoch: loop.binding_epoch})!};
}

const conversation = `normal-${suffix}`;
const loopId = `normal-loop-${suffix}`;
bindControlLoop({control_loop_id: loopId, projectId, repositoryIdentity, formal_wp_id: wp, conversation_id: conversation}); enableControlLoop(loopId, true);
const round1 = feedback(loopId, conversation, 'round-1');
const execution = `AICC_EXECUTION_V1\nINSTRUCTION_ID: next-${suffix}\nENTITY_TYPE: WORK_PACKAGE\nENTITY_ID: ${wp}\nEXECUTION_TYPE: READ_ONLY_AUDIT\nREPOSITORY: /Users/a/AI/007/AIcontrolcenter\nBRANCH: rebuild/aicc-v2\nSANDBOX: read-only\nREQUIRES_AUTHORIZATION: false\n\nINSTRUCTION_BEGIN\nContinue the canonical loop.\nINSTRUCTION_END`;
const consumed = consumeGptControl({conversation_id: conversation, assistant_message_id: `assistant-1-${suffix}`, response: execution, expected_gpt_turn_id: round1.expected.expected_gpt_turn_id}, submit, launch);
assert.equal(consumed.ok, true); assert.equal(consumed.claim?.expected_gpt_turn_id, round1.expected.expected_gpt_turn_id); assert.equal(launches, 1);
assert.equal(consumeGptControl({conversation_id: conversation, assistant_message_id: `assistant-1-remount-${suffix}`, response: execution, expected_gpt_turn_id: round1.expected.expected_gpt_turn_id}, submit, launch).duplicate, true); assert.equal(launches, 1);

const staleLoop = `stale-loop-${suffix}`;
bindControlLoop({control_loop_id: staleLoop, projectId, repositoryIdentity, formal_wp_id: wp, conversation_id: `stale-old-${suffix}`}); enableControlLoop(staleLoop, true);
const staleBefore = readControlLoop(staleLoop)!;
const staleFeedback = feedback(staleLoop, staleBefore.conversation_id, 'stale');
rebindControlLoop({control_loop_id: staleLoop, projectId, repositoryIdentity, formal_wp_id: wp, conversation_id: `stale-new-${suffix}`});
assert.equal(claimFeedback({control_loop_id: staleLoop, projectId, repositoryIdentity, formal_wp_id: wp, conversation_id: staleBefore.conversation_id, binding_epoch: staleBefore.binding_epoch, execution_id: 'late-execution', run_id: 'late-run', result_id: 'late-result', result_hash: 'late-hash', execution_result: 'late'}).code, 'CROSS_CONVERSATION_ISOLATION');
assert.equal(readExpectedControlTurn({conversation_id: staleBefore.conversation_id, control_loop_id: staleLoop, binding_epoch: staleBefore.binding_epoch}), null);
assert.equal(staleFeedback.expected.binding_epoch, staleBefore.binding_epoch);

const recoveryLoop = `recovery-loop-${suffix}`;
const recoveryConversation = `recovery-${suffix}`;
bindControlLoop({control_loop_id: recoveryLoop, projectId, repositoryIdentity, formal_wp_id: wp, conversation_id: recoveryConversation}); enableControlLoop(recoveryLoop, true);
const recovery = feedback(recoveryLoop, recoveryConversation, 'recovery');
const recoveryLoopRecord = readControlLoop(recoveryLoop)!;
const bad = consumeGptControl({conversation_id: recoveryConversation, assistant_message_id: `assistant-recovery-${suffix}`, response: execution, expected_gpt_turn_id: 'wrong-turn'}, submit, launch);
assert.equal(bad.code, 'EXPECTED_FEEDBACK_TURN_CORRELATION_FAILED');
assert.equal(readControlLoop(recoveryLoop)?.feedback_delivery_status, 'CORRELATION_FAILED');
assert.equal(recoverFeedbackCorrelation(recoveryLoop, recovery.expected.expected_gpt_turn_id).recoveryGranted, true);
assert.equal(recoverFeedbackCorrelation(recoveryLoop, recovery.expected.expected_gpt_turn_id).recoveryGranted, false);
assert.equal(readControlLoop(recoveryLoop)?.control_loop_status, 'WAITING_NEXT_CONTROL');

const terminalLoop = `terminal-loop-${suffix}`;
const terminalConversation = `terminal-${suffix}`;
bindControlLoop({control_loop_id: terminalLoop, projectId, repositoryIdentity, formal_wp_id: wp, conversation_id: terminalConversation}); enableControlLoop(terminalLoop, true);
const terminal = feedback(terminalLoop, terminalConversation, 'terminal');
const owner = consumeGptControl({conversation_id: terminalConversation, assistant_message_id: `owner-${suffix}`, response: 'AICC_OWNER_UAT_V1\nWORK_PACKAGE: AICC_AUTO_LOOP_FEEDBACK_TURN_CORRELATION_REMEDIATION_V1', expected_gpt_turn_id: terminal.expected.expected_gpt_turn_id}, submit, launch);
assert.equal(owner.ok, true); assert.equal(readControlLoop(terminalLoop)?.control_loop_status, 'WAITING_OWNER_UAT');

const projection = canonicalControlLoopReadModel(readControlLoop(recoveryLoop));
assert.equal(projection?.execution_status, 'COMPLETED'); assert.equal(projection?.feedback_delivery_status, 'DELIVERED'); assert.equal(projection?.control_loop_status, 'WAITING_NEXT_CONTROL');
assert.equal(projectControlLoopFeedback(readControlLoop(loopId)).state, 'RUNNING');
assert.equal(projectControlLoopFeedback(readControlLoop(recoveryLoop)).state, 'RUNNING');
assert.equal(projectControlLoopFeedback(readControlLoop(terminalLoop)).code, 'WAITING_OWNER_UAT');
assert.equal(recoveryLoopRecord.binding_epoch, readControlLoop(recoveryLoop)?.binding_epoch);
console.log('AICC auto-loop feedback correlation UAT passed');
