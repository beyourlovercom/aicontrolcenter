import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {resolveAiccStateDir} from './stateDirectory.ts';
import {bindControlLoop, enableControlLoop, readControlLoop, readFeedback} from './gptAutoControlLoop.ts';

const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
const wpId = 'AICC-V2-GPT-CODEX-BRIDGE-001';
const rawControlLoopId = `legacy-raw-loop-${suffix}`;
const projectA = {projectId: `project-a-${suffix}`, repositoryIdentity: `repo-a-${suffix}`};

const scopedLoop = bindControlLoop({control_loop_id: rawControlLoopId, ...projectA, formal_wp_id: wpId, conversation_id: `conversation-a-${suffix}`});
enableControlLoop(rawControlLoopId, true, projectA);

const stateDir = resolveAiccStateDir();
const stateFile = join(stateDir, 'gpt-auto-control-loop.json');
mkdirSync(stateDir, {recursive: true});
const state = JSON.parse(readFileSync(stateFile, 'utf8'));

const legacyLoop = {...state.loops.find((loop: {control_loop_id: string; projectId?: string}) => loop.control_loop_id === rawControlLoopId && loop.projectId === projectA.projectId)};
delete legacyLoop.projectId;
delete legacyLoop.repositoryIdentity;
legacyLoop.conversation_id = `legacy-conversation-${suffix}`;
state.loops.push(legacyLoop);

const legacyFeedback = {control_loop_id: rawControlLoopId, feedback_id: `legacy-feedback-${suffix}`, feedback_key: `legacy-feedback-key-${suffix}`, conversation_id: legacyLoop.conversation_id, binding_epoch: legacyLoop.binding_epoch, execution_id: `legacy-exec-${suffix}`, run_id: `legacy-run-${suffix}`, result_id: `legacy-result-${suffix}`, result_hash: `legacy-hash-${suffix}`, execution_result: 'LEGACY = PASS', lifecycle: 'FEEDBACK_CLAIMED', delivery_attempts: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString()};
state.feedback.push(legacyFeedback);
const scopedFeedbackRecord = {...projectA, control_loop_id: rawControlLoopId, feedback_id: `scoped-feedback-${suffix}`, feedback_key: `scoped-feedback-key-${suffix}`, conversation_id: scopedLoop.conversation_id, binding_epoch: scopedLoop.binding_epoch, execution_id: `scoped-exec-${suffix}`, run_id: `scoped-run-${suffix}`, result_id: `scoped-result-${suffix}`, result_hash: `scoped-hash-${suffix}`, execution_result: 'SCOPED = PASS', lifecycle: 'FEEDBACK_CLAIMED', delivery_attempts: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString()};
state.feedback.push(scopedFeedbackRecord);
writeFileSync(stateFile, JSON.stringify(state, null, 2));

assert.throws(() => readControlLoop(rawControlLoopId), /AMBIGUOUS_CONTROL_LOOP_ID/, 'raw-only lookup fails closed when LEGACY and a scoped project share the same raw control_loop_id');
const scopedRead = readControlLoop(rawControlLoopId, projectA);
assert.equal(scopedRead?.projectId, projectA.projectId, 'exact scoped lookup still resolves correctly despite LEGACY collision');
assert.equal(scopedLoop.control_loop_id, rawControlLoopId);

assert.throws(() => readFeedback(rawControlLoopId), /AMBIGUOUS_FEEDBACK_IDENTITY/, 'raw-only readFeedback fails closed when LEGACY and a scoped project share the same raw control_loop_id');
const scopedFeedback = readFeedback(rawControlLoopId, projectA);
assert.equal(scopedFeedback.length, 1, 'exact scoped readFeedback returns only the project-scoped record');
assert.equal(scopedFeedback[0]!.feedback_id, scopedFeedbackRecord.feedback_id);
assert.ok(!scopedFeedback.some(record => record.feedback_id === legacyFeedback.feedback_id), 'exact scoped readFeedback never returns LEGACY records');

console.log('D0A_2B_BATCH3B2A_R2 legacy raw-id ambiguity regression passed');
