/**
 * D0B_1_EXACT_RUNTIME_TRANSPORT_SCOPE attempt 2 regressions, strengthened in D0B_1 attempt 4:
 * - stopRuntimeWithGraceScoped mutates only the scoped project A; B is untouched.
 * - resumeStoppedExecutionScoped selects only the matching project's inbox item; foreign scope fails closed.
 * - Two different project/repository scopes sharing the same raw resumedFromRunId can BOTH
 *   independently and successfully create resume executions (not merely avoid RESUME_ALREADY_CREATED).
 */
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync, writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {
  parseEvent,
  readRuntimeScoped,
  stopRuntimeWithGraceScoped,
  type RuntimeState,
} from './runtimeManager.ts';
import {
  readInbox,
  persistNewInboxItemForTest,
  resumeStoppedExecutionScoped,
  type InboxItem,
} from './bridgeCore.ts';

/**
 * Fixture setup only (no production code touched): resumeStoppedExecutionScoped's launch path
 * reads docs/10_Planning_Roadmap/04_AICC_PROJECT_REGISTRY.json and validates each entry's
 * repositoryPath against `git rev-parse --show-toplevel`. On this machine the registry stores
 * paths with different casing than git's canonical resolution, so validation throws
 * PROJECT_REPOSITORY_INVALID before the resume logic under test ever runs. Patch the registry's
 * repositoryPath fields to their git-canonical form for the duration of this test only, and
 * restore the original file content afterward regardless of outcome.
 */
const registryFile = join(process.cwd(), 'docs', '10_Planning_Roadmap', '04_AICC_PROJECT_REGISTRY.json');
const originalRegistryContent = readFileSync(registryFile, 'utf8');
function canonicalToplevel(path: string): string | null {
  try { return execFileSync('git', ['-C', path, 'rev-parse', '--show-toplevel'], {encoding: 'utf8'}).trim() || null; }
  catch { return null; }
}
{
  const registry = JSON.parse(originalRegistryContent) as {projects: Array<{repositoryPath: string}>};
  for (const project of registry.projects) {
    const canonical = canonicalToplevel(project.repositoryPath);
    if (canonical) project.repositoryPath = canonical;
  }
  writeFileSync(registryFile, JSON.stringify(registry, null, 2) + '\n');
}

const scopeA = {projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter'} as const;
const scopeB = {projectId:'erpbeyourlovercom',repositoryIdentity:'beyourlovercom/erpbeyourlovercom'} as const;
const sharedRunId = 'run-scoped-stop-resume-001';

function makeRuntime(scope:{projectId:string;repositoryIdentity:string},runId:string):RuntimeState{
  return {
    runId,projectId:scope.projectId,repositoryIdentity:scope.repositoryIdentity,repositoryPath:'/does/not/matter',
    workPackageId:null,authorizationId:'pass-through',authoritySha:'NOT_APPLICABLE',branch:'main',startingHeadSha:'head',
    pid:null,threadId:null,phase:'RUNNING',currentTask:'running',latestEvent:'turn.started',
    startedAt:'2026-08-21T00:00:00.000Z',lastActivityAt:'2026-08-21T00:01:00.000Z',events:[],passThrough:true,
    instructionId:`instruction-${scope.projectId}`,originConversationId:`conversation-${scope.projectId}`,
    originMessageId:`message-${scope.projectId}`,originBlockId:`block-${scope.projectId}`,
  };
}

function makeInboxItem(scope:{projectId:string;repositoryIdentity:string},runId:string,id:string):InboxItem{
  const instruction={
    projectId:scope.projectId,repositoryIdentity:scope.repositoryIdentity,repositoryPath:'/does/not/matter',
    instructionId:`instr-${id}`,instructionBody:'TEST',rawInstruction:'TEST',sourceType:'CLIPBOARD' as const,
    executionType:'STANDARD_IMPLEMENTATION' as const,entityType:'TASK' as const,entityId:'test-entity',
    repository:'test/repo',branch:'main',entityScope:{type:'TASK' as const,id:'test-entity'},
    workPackageId:null,prId:null,sandbox:'NO_SANDBOX' as const,requiresAuthorization:false,
    originContext:{conversationId:`conv-${id}`,runId},
  } as any;
  return {
    id,state:'LAUNCHED' as const,transportState:'SENT' as const,gates:[],
    createdAt:'2026-08-21T00:00:00.000Z',updatedAt:'2026-08-21T00:01:00.000Z',
    projectId:scope.projectId,repositoryIdentity:scope.repositoryIdentity,
    instruction,runId,executionId:runId,runtimeState:'STOPPED',terminalState:'STOPPED',
  };
}

try {

// --- Blocker 1: scoped stop mutates only A, not B ---

const runtimeA = makeRuntime(scopeA, sharedRunId);
const runtimeB = makeRuntime(scopeB, sharedRunId);

// Persist both under the same raw runId across two projects.
parseEvent('{"type":"item.started","item":{"type":"command_execution"}}', runtimeA);
parseEvent('{"type":"item.started","item":{"type":"command_execution"}}', runtimeB);

// Confirm both are visible under their respective scopes.
assert.equal(readRuntimeScoped(scopeA, sharedRunId)?.projectId, 'aicc', 'A persisted');
assert.equal(readRuntimeScoped(scopeB, sharedRunId)?.projectId, 'erpbeyourlovercom', 'B persisted');
assert.equal(readRuntimeScoped(scopeA, sharedRunId)?.phase, 'RUNNING', 'A phase before scoped stop');
assert.equal(readRuntimeScoped(scopeB, sharedRunId)?.phase, 'RUNNING', 'B phase before scoped stop');

// Scoped stop of A: pid is null so it transitions directly to STOPPED.
const stoppedA = await stopRuntimeWithGraceScoped(scopeA, sharedRunId, 0);
assert.equal(stoppedA.projectId, 'aicc', 'scoped stop returns A identity');
assert.equal(stoppedA.phase, 'STOPPED', 'A is stopped after scoped stop');

// B must remain untouched.
assert.equal(readRuntimeScoped(scopeB, sharedRunId)?.phase, 'RUNNING', 'B is still RUNNING after A scoped stop');
assert.notEqual(readRuntimeScoped(scopeB, sharedRunId)?.phase, 'STOPPED', 'B phase never mutated by A scoped stop');

// Missing/foreign scope fails closed.
const foreignRunId = 'run-scoped-stop-resume-002';
await assert.rejects(
  () => stopRuntimeWithGraceScoped(scopeA, foreignRunId, 0),
  /SCOPE_MISMATCH/,
  'stopRuntimeWithGraceScoped fails closed on unknown runId in scope'
);

// --- Blocker 2: scoped resume dedupe is exact to projectId+repositoryIdentity ---
// Both A and B use the SAME raw resume runId, each persisted as STOPPED inbox items under different scopes.

const sharedResumeRunId = 'run-scoped-resume-shared-001';
const itemA = makeInboxItem(scopeA, sharedResumeRunId, `inbox-item-A-${Date.now()}`);
const itemB = makeInboxItem(scopeB, sharedResumeRunId, `inbox-item-B-${Date.now()}`);

persistNewInboxItemForTest(itemA);
persistNewInboxItemForTest(itemB);

// Both items are independently visible under their respective scopes with the same runId.
const inboxItems = readInbox();
const foundA = inboxItems.find(i => i.runId === sharedResumeRunId && i.projectId === scopeA.projectId);
const foundB = inboxItems.find(i => i.runId === sharedResumeRunId && i.projectId === scopeB.projectId);
assert.ok(foundA, 'inbox item A found under scopeA with sharedResumeRunId');
assert.ok(foundB, 'inbox item B found under scopeB with sharedResumeRunId');

// Simulate scope A having already created a resume item for sharedResumeRunId.
// This synthetic record has resumedFromRunId=sharedResumeRunId AND scopeA identity.
const alreadyResumedA = {
  ...itemA,
  id: `resume-already-A-${Date.now()}`,
  resumedFromRunId: sharedResumeRunId,
  state: 'READY' as const,
  transportState: 'QUEUED' as const,
  runId: undefined,
};
persistNewInboxItemForTest(alreadyResumedA as any);

// Scope A: dedupe fires because scope A already has a resume record for sharedResumeRunId.
assert.throws(
  () => resumeStoppedExecutionScoped(scopeA, sharedResumeRunId),
  /RESUME_ALREADY_CREATED/,
  'resumeStoppedExecutionScoped throws RESUME_ALREADY_CREATED for scope A when A already has a resume record'
);

// Scope B: dedupe must NOT fire even though A has a resume record for the same raw runId,
// and the call must fully succeed (a real resume execution is created), not merely avoid
// the RESUME_ALREADY_CREATED error for some other failure reason.
const resumedBDespiteAsResume = resumeStoppedExecutionScoped(scopeB, sharedResumeRunId);
assert.equal(resumedBDespiteAsResume.item.resumedFromRunId, sharedResumeRunId, 'B resume item records the shared raw runId even though A already resumed it');
assert.equal(resumedBDespiteAsResume.item.projectId, scopeB.projectId, 'B resume item is scoped to project B');
assert.equal(resumedBDespiteAsResume.item.state, 'LAUNCHED', 'B resume execution actually launched despite A having a resume record for the same raw runId');

// --- Blocker 3: two different project/repository scopes independently and successfully
// create resume executions from the SAME raw resumedFromRunId. Neither scope has any
// pre-existing resume record for this runId, so dedupe must not fire for either, and
// both calls must actually succeed (not merely avoid RESUME_ALREADY_CREATED).

const bothSucceedRunId = 'run-scoped-resume-both-succeed-001';
const itemC = makeInboxItem(scopeA, bothSucceedRunId, `inbox-item-C-${Date.now()}`);
const itemD = makeInboxItem(scopeB, bothSucceedRunId, `inbox-item-D-${Date.now()}`);
persistNewInboxItemForTest(itemC);
persistNewInboxItemForTest(itemD);

const resumedA = resumeStoppedExecutionScoped(scopeA, bothSucceedRunId);
assert.equal(resumedA.item.resumedFromRunId, bothSucceedRunId, 'A resume item records the shared raw runId');
assert.equal(resumedA.item.projectId, scopeA.projectId, 'A resume item is scoped to project A');
assert.equal(resumedA.item.repositoryIdentity, scopeA.repositoryIdentity, 'A resume item is scoped to repo A');
assert.equal(resumedA.item.state, 'LAUNCHED', 'A resume execution actually launched');
assert.ok(resumedA.item.runId, 'A resume execution was assigned a new runId');

const resumedB = resumeStoppedExecutionScoped(scopeB, bothSucceedRunId);
assert.equal(resumedB.item.resumedFromRunId, bothSucceedRunId, 'B resume item records the shared raw runId');
assert.equal(resumedB.item.projectId, scopeB.projectId, 'B resume item is scoped to project B');
assert.equal(resumedB.item.repositoryIdentity, scopeB.repositoryIdentity, 'B resume item is scoped to repo B');
assert.equal(resumedB.item.state, 'LAUNCHED', 'B resume execution actually launched');
assert.ok(resumedB.item.runId, 'B resume execution was assigned a new runId');

// Two independent resume executions exist: distinct inbox ids and distinct new runIds.
assert.notEqual(resumedA.item.id, resumedB.item.id, 'A and B resume executions are distinct inbox records');
assert.notEqual(resumedA.item.runId, resumedB.item.runId, 'A and B resume executions were launched as distinct runs');

const postResumeInbox = readInbox();
const resumeRecordsForSharedRunId = postResumeInbox.filter(i => i.resumedFromRunId === bothSucceedRunId);
const resumeRecordA = resumeRecordsForSharedRunId.find(i => i.projectId === scopeA.projectId && i.repositoryIdentity === scopeA.repositoryIdentity);
const resumeRecordB = resumeRecordsForSharedRunId.find(i => i.projectId === scopeB.projectId && i.repositoryIdentity === scopeB.repositoryIdentity);
assert.ok(resumeRecordA, 'a persisted resume record for scope A exists for the shared raw runId');
assert.ok(resumeRecordB, 'a persisted resume record for scope B exists for the shared raw runId');
assert.notEqual(resumeRecordA!.id, resumeRecordB!.id, 'persisted resume records for A and B are independent executions');

// Foreign/missing scope fail-closed assertions remain.
// resumeStoppedExecutionScoped with scopeA and a runId that only exists under scopeB must fail closed.
const itemBOnly = makeInboxItem(scopeB, 'run-scoped-resume-B-only-001', `inbox-item-B-only-${Date.now()}`);
persistNewInboxItemForTest(itemBOnly);
assert.throws(
  () => resumeStoppedExecutionScoped(scopeA, 'run-scoped-resume-B-only-001'),
  /RESUME_SOURCE_EXECUTION_NOT_FOUND/,
  'resumeStoppedExecutionScoped fails closed when runId belongs to foreign project scope'
);

// Missing runId in any scope fails closed.
assert.throws(
  () => resumeStoppedExecutionScoped(scopeA, 'run-nonexistent-999'),
  /RESUME_SOURCE_EXECUTION_NOT_FOUND/,
  'resumeStoppedExecutionScoped fails closed on unknown runId'
);

console.log('scoped stop/resume two-project regression passed [D0B_1_EXACT_RUNTIME_TRANSPORT_SCOPE attempt 2 + D0B_1 attempt 4 dual-success proof]');

} finally {
  writeFileSync(registryFile, originalRegistryContent);
}
