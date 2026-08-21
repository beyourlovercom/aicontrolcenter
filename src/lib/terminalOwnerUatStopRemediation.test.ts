import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {bindControlLoop, claimFeedback, classifyControlContract, completeFeedback, consumeGptControl, enableControlLoop, markFeedbackInserted, markFeedbackInserting, markFeedbackSubmitted, markFeedbackSubmitting, parseControlContract, projectAutoLoopStatus, readControlLoop, readExpectedControlTurn} from './gptAutoControlLoop.ts';
import type {InboxItem} from './bridgeCore.ts';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const wpId = 'AICC-V2-GPT-CODEX-BRIDGE-001';
const projectId = 'project-terminal-owner-uat-stop-remediation';
const repositoryIdentity = 'repo-terminal-owner-uat-stop-remediation';
let submitCount = 0;
let launchCount = 0;
const submit = (): InboxItem => { submitCount += 1; throw new Error('TERMINAL_CONTROL_MUST_NOT_SUBMIT'); };
const launch = (): InboxItem => { launchCount += 1; throw new Error('TERMINAL_CONTROL_MUST_NOT_LAUNCH'); };

function expectedRoundThreeTurn(kind: string) {
  const conversationId = `terminal-${kind}-${suffix}`;
  const controlLoopId = `terminal-loop-${kind}-${suffix}`;
  bindControlLoop({control_loop_id: controlLoopId, projectId, repositoryIdentity, formal_wp_id: wpId, conversation_id: conversationId});
  enableControlLoop(controlLoopId, true);
  const feedback = claimFeedback({control_loop_id: controlLoopId, projectId, repositoryIdentity, formal_wp_id: wpId, conversation_id: conversationId, execution_id: `execution-round-3-${kind}-${suffix}`, run_id: `run-round-3-${kind}-${suffix}`, result_id: `result-round-3-${kind}-${suffix}`, result_hash: `hash-round-3-${kind}-${suffix}`, execution_result: 'ROUND_3 = PASS'}).record!;
  markFeedbackInserting(controlLoopId, feedback.feedback_key);
  markFeedbackInserted(controlLoopId, feedback.feedback_key);
  markFeedbackSubmitting(controlLoopId, feedback.feedback_key);
  markFeedbackSubmitted(controlLoopId, feedback.feedback_key);
  completeFeedback(controlLoopId, feedback.feedback_key, `feedback-message-round-3-${kind}-${suffix}`);
  return {conversationId, controlLoopId, expectedTurn: readExpectedControlTurn(conversationId)!};
}

assert.equal(classifyControlContract('AICC_EXECUTION_V1'), 'EXECUTABLE_CONTROL');
assert.equal(classifyControlContract('AICC_OWNER_UAT_V1'), 'TERMINAL_OWNER_UAT');
assert.equal(classifyControlContract('AICC_WP_COMPLETE_V1'), 'TERMINAL_COMPLETE');
assert.equal(classifyControlContract('AICC_BLOCKED_V1'), 'TERMINAL_BLOCKED');

const owner = expectedRoundThreeTurn('owner-uat');
const ownerResponse = 'AICC_OWNER_UAT_V1\nCONTROL_LOOP_TEST: PASS\nREASON: THREE_AUTOMATIC_ROUNDS_COMPLETED';
const ownerResult = consumeGptControl({conversation_id: owner.conversationId, assistant_message_id: `assistant-owner-${suffix}`, response: ownerResponse}, submit, launch);
assert.equal(ownerResult.ok, true);
assert.equal(ownerResult.contract?.class, 'TERMINAL_OWNER_UAT');
assert.equal(ownerResult.expected_turn?.feedback_key, owner.expectedTurn.feedback_key, 'terminal response correlates to the exact preceding feedback turn');
assert.equal(ownerResult.expected_turn?.state, 'CONSUMED');
assert.equal(readExpectedControlTurn(owner.conversationId), null, 'consumed terminal turn is no longer pending');
assert.equal(readControlLoop(owner.controlLoopId)?.status, 'WAITING_OWNER_UAT');
assert.equal(projectAutoLoopStatus(readControlLoop(owner.controlLoopId)).state, 'WAITING_OWNER_UAT');
assert.equal(submitCount, 0); assert.equal(launchCount, 0, 'Owner UAT creates no Inbox, Task, Execution, Run, or fourth Luna launch');

const replay = consumeGptControl({conversation_id: owner.conversationId, assistant_message_id: `assistant-owner-${suffix}`, response: ownerResponse}, submit, launch);
assert.equal(replay.ok, true); assert.equal(replay.duplicate, true); assert.equal(replay.contract?.type, 'AICC_OWNER_UAT_V1');
const rerenderReplay = consumeGptControl({conversation_id: owner.conversationId, assistant_message_id: `assistant-owner-rerender-${suffix}`, response: ownerResponse}, submit, launch);
assert.equal(rerenderReplay.ok, true); assert.equal(rerenderReplay.duplicate, true, 'message hash is exactly once across rerender identity drift');
const fourthExecution = `AICC_EXECUTION_V1\nINSTRUCTION_ID: forbidden-round-4-${suffix}\nENTITY_TYPE: WORK_PACKAGE\nENTITY_ID: ${wpId}\nEXECUTION_TYPE: READ_ONLY_AUDIT\nREPOSITORY: /Users/a/AI/007/AIcontrolcenter\nBRANCH: rebuild/aicc-v2\nSANDBOX: read-only\nREQUIRES_AUTHORIZATION: false\n\nINSTRUCTION_BEGIN\nForbidden fourth run.\nINSTRUCTION_END`;
assert.equal(consumeGptControl({conversation_id: owner.conversationId, assistant_message_id: `assistant-fourth-${suffix}`, response: fourthExecution}, submit, launch).code, 'AUTO_LOOP_STOPPED');
assert.equal(submitCount, 0); assert.equal(launchCount, 0);

const complete = expectedRoundThreeTurn('complete');
const completeResult = consumeGptControl({conversation_id: complete.conversationId, assistant_message_id: `assistant-complete-${suffix}`, response: 'AICC_WP_COMPLETE_V1\nRESULT: PASS'}, submit, launch);
assert.equal(completeResult.contract?.class, 'TERMINAL_COMPLETE');
assert.equal(completeResult.expected_turn?.state, 'CONSUMED');
assert.equal(readControlLoop(complete.controlLoopId)?.status, 'COMPLETE');

const blocked = expectedRoundThreeTurn('blocked');
const blockedResult = consumeGptControl({conversation_id: blocked.conversationId, assistant_message_id: `assistant-blocked-${suffix}`, response: 'AICC_BLOCKED_V1\nBLOCKER_CODE: OWNER_DECISION_REQUIRED'}, submit, launch);
assert.equal(blockedResult.contract?.class, 'TERMINAL_BLOCKED');
assert.equal(blockedResult.expected_turn?.state, 'CONSUMED');
assert.equal(readControlLoop(blocked.controlLoopId)?.status, 'BLOCKED');
assert.equal(readControlLoop(blocked.controlLoopId)?.blocker_code, 'OWNER_DECISION_REQUIRED');

for (const contract of [ownerResponse, 'AICC_WP_COMPLETE_V1\nRESULT: PASS', 'AICC_BLOCKED_V1\nBLOCKER_CODE: OWNER_DECISION_REQUIRED']) assert.equal(parseControlContract(contract).ok, true);
assert.equal(submitCount, 0); assert.equal(launchCount, 0);

const content = readFileSync(join(process.cwd(), 'web-adapter/chrome-extension-current/content.js'), 'utf8');
const consumeUi = content.match(/async function consumeNewAssistantControl\(\)[\s\S]*?(?=\n  async function sendInstruction)/)?.[0] ?? '';
assert.match(consumeUi, /parsed\.class === 'EXECUTABLE_CONTROL' && !followsExpectedFeedbackTurn/, 'terminal controls reach canonical server correlation despite unstable DOM identity');
assert.doesNotMatch(consumeUi, /if \(!followsExpectedFeedbackTurn\(current\.message, status\.expected_turn\)\)/, 'terminal controls cannot trigger the historical false correlation failure');
assert.match(consumeUi, /clearStatus\(\); lastErrorSignature = ''/, 'successful terminal consumption clears stale failure presentation');
assert.match(content, /data-aicc-runtime-auto-loop/); assert.match(content, /data-aicc-runtime-gpt-return/);
assert.match(content, /terminalState \? 'CONFIRMED' : ''/, 'unified Runtime Result projects confirmed GPT terminal return');

console.log('M8.2.1.8.9 terminal Owner UAT stop remediation regression passed');
