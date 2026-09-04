import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveCanonicalTaskBranch} from './bridgeCore.ts';

const runId='shared-branch-run';
const taskA={branch:'UNAVAILABLE',executionId:runId,runId,projectId:'project-a',repositoryIdentity:'repo/a'} as any;
const runtimeA={runId,projectId:'project-a',repositoryIdentity:'repo/a',branch:'branch/a'};
const runtimeB={runId,projectId:'project-b',repositoryIdentity:'repo/b',branch:'branch/b'};

assert.equal(resolveCanonicalTaskBranch(taskA,[],[runtimeB,runtimeA]),'branch/a','scoped Task branch resolves only same-project runtime evidence');
assert.equal(resolveCanonicalTaskBranch(taskA,[],[runtimeB]),'NOT_AVAILABLE','foreign-project same-runId branch evidence is ignored');
assert.equal(resolveCanonicalTaskBranch({...taskA,branch:'task/persisted'},[],[runtimeB]),'task/persisted','persisted Task branch keeps precedence');
assert.equal(resolveCanonicalTaskBranch({branch:'UNAVAILABLE',executionId:runId,runId} as any,[],[{runId,branch:'legacy/branch'}]),'legacy/branch','legacy unscoped Task keeps raw-run compatibility');

const source=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');
assert.match(source,/taskRunBranchEvidenceKey\(runtime:TaskRunBranchEvidence\)/,'branch evidence readers share a scoped key');
assert.match(source,/item\.projectId===record\.projectId&&item\.repositoryIdentity===record\.repositoryIdentity/,'Task branch fallback requires same Project identity');
console.log('task branch evidence project scope regression passed');
