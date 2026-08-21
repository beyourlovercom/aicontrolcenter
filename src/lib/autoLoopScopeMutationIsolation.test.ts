import assert from 'node:assert/strict';
import {bindControlLoop, rebindControlLoop, unlockControlLoop, enableControlLoop, stopControlLoopByOwner, readControlLoop, readControlLoopByConversation, claimFeedback, markFeedbackInserting, markFeedbackInserted, markFeedbackSubmitting, markFeedbackSubmitted, completeFeedback, consumeGptControl, recordExecutionResult} from './gptAutoControlLoop.ts';
import type {InboxItem, BridgeReport} from './bridgeCore.ts';

const controlLoopId = 'colliding-control-loop-id';
const conversationId = 'colliding-conversation-id';
const wpId = 'AICC-V2-GPT-CODEX-BRIDGE-001';
const scopeA = {projectId: 'project-scope-isolation-a', repositoryIdentity: 'repo-scope-isolation-a'};
const scopeB = {projectId: 'project-scope-isolation-b', repositoryIdentity: 'repo-scope-isolation-b'};
const executionId = 'colliding-execution-id';
const runId = 'colliding-run-id';
const resultId = 'colliding-result-id';
const resultHash = 'colliding-result-hash';

const loopA = bindControlLoop({control_loop_id: controlLoopId, ...scopeA, formal_wp_id: wpId, conversation_id: conversationId});
const loopB = bindControlLoop({control_loop_id: controlLoopId, ...scopeB, formal_wp_id: wpId, conversation_id: conversationId});
assert.equal(loopA.control_loop_id, loopB.control_loop_id, 'raw control_loop_id collides across projects');
assert.equal(loopA.conversation_id, loopB.conversation_id, 'raw conversation_id collides across projects');
assert.equal(loopA.binding_epoch, loopB.binding_epoch, 'both loops start at the same binding epoch');
enableControlLoop(controlLoopId, true, scopeA);
enableControlLoop(controlLoopId, true, scopeB);
assert.equal(readControlLoop(controlLoopId, scopeA)?.enabled, true, 'A remains enabled after B is separately enabled');
assert.equal(readControlLoop(controlLoopId, scopeB)?.enabled, true, 'B remains enabled after A is separately enabled (cross-project enable must not disable the sibling)');

// Raw-only (unscoped) reads must fail closed rather than silently choosing the first match.
assert.throws(() => readControlLoop(controlLoopId), /AMBIGUOUS_CONTROL_LOOP_ID/);
assert.throws(() => readControlLoopByConversation(conversationId), /AMBIGUOUS_CONVERSATION_ID/);
assert.equal(readControlLoop(controlLoopId, scopeA)?.projectId, scopeA.projectId);
assert.equal(readControlLoop(controlLoopId, scopeB)?.projectId, scopeB.projectId);

const feedbackInputBase = {control_loop_id: controlLoopId, formal_wp_id: wpId, conversation_id: conversationId, current_pr_id: null, task_id: 'task-1', instruction_id: 'instr-1', execution_id: executionId, run_id: runId, source: 'GPT_AUTO_CONTROL_LOOP', runtime: 'CODEX_CLI', model: 'luna', result_id: resultId, result_hash: resultHash, execution_result: 'ROUND_1 = PASS'};
const claimA = claimFeedback({...feedbackInputBase, ...scopeA, binding_epoch: loopA.binding_epoch});
const claimB = claimFeedback({...feedbackInputBase, ...scopeB, binding_epoch: loopB.binding_epoch});
assert.equal(claimA.claimGranted, true);
assert.equal(claimB.claimGranted, true);
assert.equal(claimA.record!.feedback_id, claimB.record!.feedback_id, 'feedback identity collides across projects since it is derived only from raw fields');
assert.equal(claimA.record!.feedback_key, claimB.record!.feedback_key, 'feedback_key collides across projects too');
const feedbackKey = claimA.record!.feedback_key;

// Progress A's feedback lifecycle fully; B's identically-keyed record must be untouched.
markFeedbackInserting(controlLoopId, feedbackKey, scopeA);
markFeedbackInserted(controlLoopId, feedbackKey, scopeA);
markFeedbackSubmitting(controlLoopId, feedbackKey, scopeA);
markFeedbackSubmitted(controlLoopId, feedbackKey, scopeA);
completeFeedback(controlLoopId, feedbackKey, undefined, scopeA);
assert.equal(readControlLoop(controlLoopId, scopeA)?.last_feedback_state, 'FEEDBACK_CONSUMED', 'A feedback is consumed');
assert.notEqual(readControlLoop(controlLoopId, scopeB)?.last_feedback_state, 'FEEDBACK_CONSUMED', 'B feedback lifecycle is unaffected by A completing its identically-keyed feedback');

// Raw-only (unscoped) feedback mutation must fail closed on ambiguity, not silently pick one project.
assert.throws(() => markFeedbackInserting('irrelevant', feedbackKey), /FEEDBACK_NOT_FOUND|AMBIGUOUS_FEEDBACK_IDENTITY/);

// Now progress B's own feedback fully so both loops reach a consumed feedback turn for a control/consume test.
markFeedbackInserting(controlLoopId, feedbackKey, scopeB);
markFeedbackInserted(controlLoopId, feedbackKey, scopeB);
markFeedbackSubmitting(controlLoopId, feedbackKey, scopeB);
markFeedbackSubmitted(controlLoopId, feedbackKey, scopeB);
completeFeedback(controlLoopId, feedbackKey, undefined, scopeB);
assert.equal(readControlLoop(controlLoopId, scopeB)?.last_feedback_state, 'FEEDBACK_CONSUMED', 'B feedback also reaches consumed once B explicitly progresses it');

const execution = `AICC_EXECUTION_V1\nINSTRUCTION_ID: instr-2\nENTITY_TYPE: WORK_PACKAGE\nENTITY_ID: ${wpId}\nEXECUTION_TYPE: READ_ONLY_AUDIT\nREPOSITORY: /Users/a/AI/007/AIcontrolcenter\nBRANCH: rebuild/aicc-v2\nSANDBOX: read-only\nREQUIRES_AUTHORIZATION: false\n\nINSTRUCTION_BEGIN\nRead package.json without modifying files.\nINSTRUCTION_END`;
let launches = 0;
const submit = (instruction: any): InboxItem => ({id: instruction.instructionId, state: 'READY', instruction, rawInstruction: instruction.rawInstruction, gates: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()} as unknown as InboxItem);
const launch = (id: string): InboxItem => { launches += 1; return {id, state: 'LAUNCHED', runId: `run-consume-${launches}`, executionId: `execution-consume-${launches}`, model: 'luna', gates: [], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString()} as unknown as InboxItem; };

const identityA = {control_loop_id: controlLoopId, binding_epoch: loopA.binding_epoch, feedback_key: claimA.record!.feedback_key, expected_gpt_turn_id: claimA.record!.expected_gpt_turn_id};
const identityB = {control_loop_id: controlLoopId, binding_epoch: loopB.binding_epoch, feedback_key: claimB.record!.feedback_key, expected_gpt_turn_id: claimB.record!.expected_gpt_turn_id};

// Raw-only (no scope) consume must fail closed given the colliding conversation/control_loop_id across two active loops.
assert.throws(() => consumeGptControl({conversation_id: conversationId, assistant_message_id: 'assistant-ambiguous', response: execution, ...identityA}, submit, launch), /AMBIGUOUS_ACTIVE_CONTROL_LOOP/);
assert.equal(launches, 0, 'ambiguous raw consume must never launch anything');

const resultA = consumeGptControl({conversation_id: conversationId, assistant_message_id: 'assistant-a', response: execution, ...identityA, projectId: scopeA.projectId, repositoryIdentity: scopeA.repositoryIdentity}, submit, launch);
assert.equal(resultA.ok, true, 'scoped consume resolves exactly project A');
assert.equal(launches, 1);
assert.equal(readControlLoop(controlLoopId, scopeB)?.status, 'WAITING_GPT', 'B was not mutated by A\'s scoped control/consume');

const resultB = consumeGptControl({conversation_id: conversationId, assistant_message_id: 'assistant-b', response: execution, ...identityB, projectId: scopeB.projectId, repositoryIdentity: scopeB.repositoryIdentity}, submit, launch);
assert.equal(resultB.ok, true, 'scoped consume resolves exactly project B, independently of A');
assert.equal(launches, 2);

// stop/unlock scoped mutation must never leak to the sibling project.
stopControlLoopByOwner(controlLoopId, scopeA);
assert.equal(readControlLoop(controlLoopId, scopeA)?.status, 'STOPPED_BY_OWNER');
assert.notEqual(readControlLoop(controlLoopId, scopeB)?.status, 'STOPPED_BY_OWNER', 'stopping A must not stop B');

unlockControlLoop(controlLoopId, scopeB);
assert.equal(readControlLoop(controlLoopId, scopeB)?.binding_active, false);
assert.equal(readControlLoop(controlLoopId, scopeA)?.binding_active, true, 'unlocking B must not unbind A');

// rebind of a still-bound loop must not touch the sibling project's pending expected turns.
const rebound = rebindControlLoop({control_loop_id: controlLoopId, ...scopeA, formal_wp_id: wpId, conversation_id: 'rebound-conversation'});
assert.equal(rebound.binding_epoch, loopA.binding_epoch + 1, 'A rebinds to a new epoch');
assert.equal(readControlLoop(controlLoopId, scopeB)?.conversation_id, conversationId, 'B keeps its original conversation binding after A rebinds');

// recordExecutionResult must resolve loop-by-scope before any project validation, and fail closed for a third unrelated project.
const scopeC = {projectId: 'project-scope-isolation-c', repositoryIdentity: 'repo-scope-isolation-c'};
const report: BridgeReport = {inboxId: 'inbox-1', executionId: 'execution-record', runId: 'run-record', entityType: 'work_package', entityId: wpId, workPackageId: wpId, executionType: 'READ_ONLY_AUDIT', branch: 'rebuild/aicc-v2', expectedHead: 'head', currentHead: 'head', worktree: '/tmp', status: 'COMPLETED', canonicalResult: {version: 'AICC_EXECUTION_RESULT_V1', executionId: 'execution-record', projectId: scopeC.projectId, repositoryIdentity: scopeC.repositoryIdentity, rawResult: 'RESULT', receivedAt: new Date().toISOString(), resultId: 'result-record', resultHash: 'hash-record'}};
assert.throws(() => recordExecutionResult(controlLoopId, report), /FOREIGN_EXECUTION_RESULT_PROJECT_SCOPE/, 'a colliding raw control_loop_id owned by A and B must not silently accept a result scoped to project C');
const reportForB: BridgeReport = {...report, canonicalResult: {...report.canonicalResult!, projectId: scopeB.projectId, repositoryIdentity: scopeB.repositoryIdentity}};
const recorded = recordExecutionResult(controlLoopId, reportForB);
assert.equal(recorded?.projectId, scopeB.projectId, 'result scoped to B resolves to B\'s loop, never A\'s, despite the colliding raw control_loop_id');

console.log('Auto-loop scope mutation isolation tests passed');
