import assert from 'node:assert/strict';
import {existsSync,readdirSync,readFileSync} from 'node:fs';
import {finalizeCanonicalResult,parseEvent,readCanonicalResultScoped,readRuntimeHistory,readRuntimeScoped,runtimeStorageKey,updateCanonicalResultReturnScoped,type RuntimeState} from './runtimeManager.ts';
import {resolveAiccStateDir} from './stateDirectory.ts';

const stateDir=resolveAiccStateDir();
const scopeA={projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter'} as const;
const scopeB={projectId:'erpbeyourlovercom',repositoryIdentity:'beyourlovercom/erpbeyourlovercom'} as const;
const sharedRunId='run-shared-collision-001';

const make=(scope:{projectId:string;repositoryIdentity:string}):RuntimeState=>({
  runId:sharedRunId,projectId:scope.projectId,repositoryIdentity:scope.repositoryIdentity,repositoryPath:'/does/not/matter',
  workPackageId:null,authorizationId:'pass-through',authoritySha:'NOT_APPLICABLE',branch:'main',startingHeadSha:'head',
  pid:null,threadId:null,phase:'RUNNING',currentTask:'running',latestEvent:'turn.started',
  startedAt:'2026-08-21T00:00:00.000Z',lastActivityAt:'2026-08-21T00:01:00.000Z',events:[],passThrough:true,
  instructionId:`instruction-${scope.projectId}`,originConversationId:`conversation-${scope.projectId}`,
  originMessageId:`message-${scope.projectId}`,originBlockId:`block-${scope.projectId}`,
});

const runtimeA=make(scopeA);
const runtimeB=make(scopeB);

// Scoped storage key differs across projects for the identical raw runId.
assert.notEqual(runtimeStorageKey(runtimeA),runtimeStorageKey(runtimeB),'scoped storage key differs across projects for same raw runId');

// parseEvent mutates the runtime object in place and persists via the real save()->persistTerminal()
// path; this exercises the production write path (not a hand-rolled file write).
parseEvent('{"type":"item.started","item":{"type":"command_execution"}}',runtimeA);
parseEvent('{"type":"item.started","item":{"type":"command_execution"}}',runtimeB);

// Both pass-through files persist independently on disk despite the runId collision.
const scopedFiles=readdirSync(stateDir).filter(f=>f.startsWith('runtime-run-scoped-'));
assert.equal(scopedFiles.length,2,'two distinct scoped runtime files persist for the same raw runId across projects');

// Drive each to a terminal, canonical-result-bearing state and persist via parseEvent again.
runtimeA.phase='COMPLETED';runtimeA.finalAgentMessage='A_RESULT';
finalizeCanonicalResult(runtimeA,'done-a');
parseEvent('{}',runtimeA);

const historyEntriesAfterA=readRuntimeHistory().filter(item=>item.runId===sharedRunId);
assert.ok(historyEntriesAfterA.some(item=>item.projectId==='aicc'&&item.phase==='COMPLETED'),'project A terminal state reached history');
assert.equal(historyEntriesAfterA.some(item=>item.projectId==='erpbeyourlovercom'&&item.phase==='COMPLETED'),false,'completing project A never marks project B (same raw runId) as completed');

runtimeB.phase='COMPLETED';runtimeB.finalAgentMessage='B_RESULT';
finalizeCanonicalResult(runtimeB,'done-b');
parseEvent('{}',runtimeB);

const historyAfterBoth=readRuntimeHistory().filter(item=>item.runId===sharedRunId);
assert.equal(historyAfterBoth.length,2,'persistTerminal keeps both scoped identities in history; neither overwrites/dedupes the other');
const aInHistory=historyAfterBoth.find(item=>item.projectId==='aicc');
const bInHistory=historyAfterBoth.find(item=>item.projectId==='erpbeyourlovercom');
assert.equal(aInHistory?.canonicalResult?.rawResult,'A_RESULT');
assert.equal(bInHistory?.canonicalResult?.rawResult,'B_RESULT');

// Scoped lookup resolves each project's own record independently for the identical raw runId.
const resolvedA=readRuntimeScoped(scopeA,sharedRunId);
const resolvedB=readRuntimeScoped(scopeB,sharedRunId);
assert.equal(resolvedA?.canonicalResult?.rawResult,'A_RESULT');
assert.equal(resolvedB?.canonicalResult?.rawResult,'B_RESULT');

// Foreign/unrelated scope lookup fails closed.
const missingScope={projectId:'nonexistent-project',repositoryIdentity:'nonexistent/repo'};
assert.equal(readRuntimeScoped(missingScope,sharedRunId),null,'lookup under an unrelated scope fails closed');
assert.equal(readCanonicalResultScoped(missingScope,sharedRunId),null,'canonical result lookup under an unrelated scope fails closed');

// Scoped update mutates only the caller's own project, never the other project's same-runId record.
const updatedA=updateCanonicalResultReturnScoped(scopeA,sharedRunId,{returnState:'RETURNED_TO_GPT',returnedAt:new Date().toISOString()});
assert.equal(updatedA?.canonicalResult?.returnState,'RETURNED_TO_GPT');
const stillPendingB=readCanonicalResultScoped(scopeB,sharedRunId);
assert.notEqual(stillPendingB?.canonicalResult?.returnState,'RETURNED_TO_GPT','updating project A never mutates project B\'s same-runId record');

assert.equal(existsSync(`${stateDir}/runtime-history.json`),true);
const historyOnDisk=JSON.parse(readFileSync(`${stateDir}/runtime-history.json`,'utf8')) as RuntimeState[];
assert.equal(historyOnDisk.filter(item=>item.runId===sharedRunId).length,2,'on-disk history retains both scoped records for the colliding raw runId');

console.log('runtime scoped storage batch3-b1 isolation passed');
