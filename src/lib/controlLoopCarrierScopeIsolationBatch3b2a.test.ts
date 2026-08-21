import assert from 'node:assert/strict';
import {bindControlLoop, claimFeedback, completeFeedback, enableControlLoop, markFeedbackInserted, markFeedbackInserting, markFeedbackSubmitted, markFeedbackSubmitting, readControlLoop, readExpectedControlTurns, readFeedback} from './gptAutoControlLoop.ts';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const wpId = 'AICC-V2-GPT-CODEX-BRIDGE-001';
const rawControlLoopId = `same-raw-loop-${suffix}`;
const projectA = {projectId: `project-a-${suffix}`, repositoryIdentity: `repo-a-${suffix}`};
const projectB = {projectId: `project-b-${suffix}`, repositoryIdentity: `repo-b-${suffix}`};

const loopA = bindControlLoop({control_loop_id: rawControlLoopId, ...projectA, formal_wp_id: wpId, conversation_id: `conversation-a-${suffix}`});
const loopB = bindControlLoop({control_loop_id: rawControlLoopId, ...projectB, formal_wp_id: wpId, conversation_id: `conversation-b-${suffix}`});
assert.equal(loopA.control_loop_id, rawControlLoopId);
assert.equal(loopB.control_loop_id, rawControlLoopId);
assert.equal(loopA.projectId, projectA.projectId);
assert.equal(loopB.projectId, projectB.projectId);
assert.notEqual(loopA.conversation_id, loopB.conversation_id, 'same raw control_loop_id in two projects must be independent records');

enableControlLoop(rawControlLoopId, true, projectA);
enableControlLoop(rawControlLoopId, true, projectB);
const readLoop = readControlLoop(rawControlLoopId);
assert.ok(readLoop, 'raw-id lookup resolves to some record without cross-project ambiguity crash');

const claimA = claimFeedback({control_loop_id: rawControlLoopId, ...projectA, formal_wp_id: wpId, conversation_id: loopA.conversation_id, binding_epoch: loopA.binding_epoch, execution_id: `execution-a-${suffix}`, run_id: `run-a-${suffix}`, result_id: `result-a-${suffix}`, result_hash: `hash-a-${suffix}`, execution_result: 'PROJECT_A = PASS'});
assert.equal(claimA.claimGranted, true, 'project A can claim feedback under its own scope for the shared raw control_loop_id');

const claimB = claimFeedback({control_loop_id: rawControlLoopId, ...projectB, formal_wp_id: wpId, conversation_id: loopB.conversation_id, binding_epoch: loopB.binding_epoch, execution_id: `execution-b-${suffix}`, run_id: `run-b-${suffix}`, result_id: `result-b-${suffix}`, result_hash: `hash-b-${suffix}`, execution_result: 'PROJECT_B = PASS'});
assert.equal(claimB.claimGranted, true, 'project B can independently claim feedback for the same raw control_loop_id used by project A');
assert.equal(claimA.record!.projectId, projectA.projectId);
assert.equal(claimB.record!.projectId, projectB.projectId);
assert.notEqual(claimA.record!.feedback_id, claimB.record!.feedback_id, 'distinct project scope produces distinct canonical feedback identity even for the same raw control_loop_id');

markFeedbackInserting(rawControlLoopId, claimA.record!.feedback_key);
markFeedbackInserted(rawControlLoopId, claimA.record!.feedback_key);
markFeedbackSubmitting(rawControlLoopId, claimA.record!.feedback_key);
markFeedbackSubmitted(rawControlLoopId, claimA.record!.feedback_key);
completeFeedback(rawControlLoopId, claimA.record!.feedback_key, `feedback-message-a-${suffix}`);

const feedbackForRawId = readFeedback(rawControlLoopId);
const projectATagged = feedbackForRawId.filter(record => record.projectId === projectA.projectId);
const projectBTagged = feedbackForRawId.filter(record => record.projectId === projectB.projectId);
assert.equal(projectATagged.length, 1, 'project A feedback history remains scoped to project A');
assert.equal(projectBTagged.length, 1, 'project B feedback history remains scoped to project B');

const expectedTurns = readExpectedControlTurns().filter(turn => turn.control_loop_id === rawControlLoopId);
assert.ok(expectedTurns.some(turn => turn.projectId === projectA.projectId && turn.feedback_id === claimA.record!.feedback_id), 'expected control turn created from project A feedback inherits project A scope');
assert.ok(!expectedTurns.some(turn => turn.projectId === projectB.projectId && turn.feedback_id === claimA.record!.feedback_id), 'project B never receives project A expected-turn evidence for the shared raw control_loop_id');

console.log('D0A_2B_BATCH3B2A control loop carrier scope isolation regression passed');
