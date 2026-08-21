import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  finalizeCanonicalResult,
  parseEvent,
  persistRemoteRuntimeFacts,
  readCanonicalResult,
  readCanonicalResultAsync,
  readCanonicalResultScoped,
  readRuntimeByRunIdReadOnly,
  readRuntimeScoped,
  stopRuntime,
  stopRuntimeWithGrace,
  updateCanonicalResultReturn,
  updateCanonicalResultReturnScoped,
  invalidateRuntimeProjectionSnapshot,
  initializeRuntimeProjectionSnapshot,
  type RuntimeState,
} from './runtimeManager.ts';
import {resolveAiccStateDir} from './stateDirectory.ts';

const stateDir = resolveAiccStateDir();
const scopeA = {projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter'} as const;
const scopeB = {projectId:'erpbeyourlovercom',repositoryIdentity:'beyourlovercom/erpbeyourlovercom'} as const;
const sharedRunId = 'run-raw-id-fail-closed-001';

const make = (scope:{projectId:string;repositoryIdentity:string}):RuntimeState => ({
  runId:sharedRunId,projectId:scope.projectId,repositoryIdentity:scope.repositoryIdentity,repositoryPath:'/does/not/matter',
  workPackageId:null,authorizationId:'pass-through',authoritySha:'NOT_APPLICABLE',branch:'main',startingHeadSha:'head',
  pid:null,threadId:null,phase:'RUNNING',currentTask:'running',latestEvent:'turn.started',
  startedAt:'2026-08-21T00:00:00.000Z',lastActivityAt:'2026-08-21T00:01:00.000Z',events:[],passThrough:true,
  instructionId:`instruction-${scope.projectId}`,originConversationId:`conversation-${scope.projectId}`,
  originMessageId:`message-${scope.projectId}`,originBlockId:`block-${scope.projectId}`,
});

const runtimeA = make(scopeA);
const runtimeB = make(scopeB);

// Persist both under the same raw runId across two distinct projects.
parseEvent('{"type":"item.started","item":{"type":"command_execution"}}', runtimeA);
parseEvent('{"type":"item.started","item":{"type":"command_execution"}}', runtimeB);

// Scoped APIs remain authoritative: each project resolves its own record.
assert.equal(readRuntimeScoped(scopeA, sharedRunId)?.projectId, 'aicc', 'scoped lookup A resolves');
assert.equal(readRuntimeScoped(scopeB, sharedRunId)?.projectId, 'erpbeyourlovercom', 'scoped lookup B resolves');

// Raw runId-only readCanonicalResult must fail closed (ambiguous scope, currently no canonical result yet either way).
assert.equal(readCanonicalResult(sharedRunId), null, 'raw readCanonicalResult fails closed pre-terminal (no canonical result yet)');

// Drive both to terminal, canonical-result-bearing state.
runtimeA.phase='COMPLETED'; runtimeA.finalAgentMessage='A_RESULT';
finalizeCanonicalResult(runtimeA, 'done-a');
parseEvent('{}', runtimeA);

runtimeB.phase='COMPLETED'; runtimeB.finalAgentMessage='B_RESULT';
finalizeCanonicalResult(runtimeB, 'done-b');
parseEvent('{}', runtimeB);

// Now both scopes hold a canonical result under the identical raw runId: raw-only APIs must fail closed.
assert.equal(readCanonicalResult(sharedRunId), null, 'raw readCanonicalResult fails closed when >1 scoped identity shares the raw runId');
assert.equal(updateCanonicalResultReturn(sharedRunId, {returnState:'RETURNED_TO_GPT'}), null, 'raw updateCanonicalResultReturn fails closed on ambiguous raw runId');

// Neither project's canonical result was mutated by the failed-closed raw update.
assert.notEqual(readCanonicalResultScoped(scopeA, sharedRunId)?.canonicalResult?.returnState, 'RETURNED_TO_GPT', 'ambiguous raw update never mutates project A');
assert.notEqual(readCanonicalResultScoped(scopeB, sharedRunId)?.canonicalResult?.returnState, 'RETURNED_TO_GPT', 'ambiguous raw update never mutates project B');

// Scoped APIs remain authoritative and unaffected by the ambiguity.
assert.equal(readCanonicalResultScoped(scopeA, sharedRunId)?.canonicalResult?.rawResult, 'A_RESULT');
assert.equal(readCanonicalResultScoped(scopeB, sharedRunId)?.canonicalResult?.rawResult, 'B_RESULT');
const scopedUpdateA = updateCanonicalResultReturnScoped(scopeA, sharedRunId, {returnState:'RETURNED_TO_GPT'});
assert.equal(scopedUpdateA?.canonicalResult?.returnState, 'RETURNED_TO_GPT', 'scoped update still resolves and mutates only project A');
assert.notEqual(readCanonicalResultScoped(scopeB, sharedRunId)?.canonicalResult?.returnState, 'RETURNED_TO_GPT', 'project B remains untouched after project A scoped update');

// readCanonicalResultAsync (projection-snapshot backed) must also fail closed on ambiguous raw runId.
await initializeRuntimeProjectionSnapshot();
const asyncResult = await readCanonicalResultAsync(sharedRunId);
assert.equal(asyncResult, null, 'async raw canonical result read fails closed on ambiguous raw runId');

// readRuntimeByRunIdReadOnly must fail closed on ambiguous raw runId.
const readOnlyResult = await readRuntimeByRunIdReadOnly(sharedRunId);
assert.equal(readOnlyResult, null, 'readRuntimeByRunIdReadOnly fails closed on ambiguous raw runId');

// stopRuntime/stopRuntimeWithGrace (raw runId only) must fail closed -> NO_ACTIVE_RUN, never pick first.
assert.throws(() => stopRuntime(sharedRunId), /NO_ACTIVE_RUN/, 'stopRuntime fails closed on ambiguous raw runId');
await assert.rejects(() => stopRuntimeWithGrace(sharedRunId), /NO_ACTIVE_RUN/, 'stopRuntimeWithGrace fails closed on ambiguous raw runId');

// persistRemoteRuntimeFacts requires explicit scope: foreign remote facts must never mutate the other project's record.
const beforeB = readRuntimeScoped(scopeB, sharedRunId);
const foreignMutationAttempt = persistRemoteRuntimeFacts(scopeA, sharedRunId, {state:'FAILED', result:'HIJACKED_BY_FOREIGN_FACTS'});
assert.equal(foreignMutationAttempt?.projectId, 'aicc', 'scoped remote facts persist only against the caller-specified scope');
const afterB = readRuntimeScoped(scopeB, sharedRunId);
assert.equal(afterB?.canonicalResult?.rawResult, beforeB?.canonicalResult?.rawResult, 'foreign remote facts scoped to project A never mutate project B');
assert.notEqual(afterB?.finalAgentMessage, 'HIJACKED_BY_FOREIGN_FACTS', 'project B final agent message is untouched by project-A-scoped remote facts');

// Single-scope legacy compatibility: an unambiguous raw runId still resolves via raw-only APIs.
const unambiguousRunId = 'run-raw-id-unambiguous-001';
const unambiguous = make(scopeA);
unambiguous.runId = unambiguousRunId;
unambiguous.instructionId = 'instruction-unambiguous';
parseEvent('{"type":"item.started","item":{"type":"command_execution"}}', unambiguous);
unambiguous.phase='COMPLETED'; unambiguous.finalAgentMessage='UNAMBIGUOUS_RESULT';
finalizeCanonicalResult(unambiguous, 'done-unambiguous');
parseEvent('{}', unambiguous);
assert.equal(readCanonicalResult(unambiguousRunId)?.canonicalResult?.rawResult, 'UNAMBIGUOUS_RESULT', 'unambiguous single-scope raw runId still resolves (legacy compatibility)');

assert.equal(readFileSync(`${stateDir}/runtime-history.json`, 'utf8').length > 0, true);

console.log('raw runtime id fail-closed batch3-b1-r2 passed');
