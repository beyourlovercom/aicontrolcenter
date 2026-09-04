import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolveCanonicalTaskBranch} from './bridgeCore.ts';

const executionId='shared-execution-id';
const taskA={branch:'UNAVAILABLE',executionId,runId:'run-a',projectId:'project-a',repositoryIdentity:'repo/a'} as any;
const executionA={execution_id:executionId,projectId:'project-a',repositoryIdentity:'repo/a',branch:'execution/a'};
const executionB={execution_id:executionId,projectId:'project-b',repositoryIdentity:'repo/b',branch:'execution/b'};
const legacyExecution={execution_id:executionId,branch:'legacy/execution'};

assert.equal(resolveCanonicalTaskBranch(taskA,[executionB,executionA],[]),'execution/a','scoped Task accepts only same-project execution branch evidence');
assert.equal(resolveCanonicalTaskBranch(taskA,[executionB],[]),'NOT_AVAILABLE','foreign-project execution evidence is ignored');
assert.equal(resolveCanonicalTaskBranch(taskA,[legacyExecution],[]),'NOT_AVAILABLE','unscoped legacy execution evidence cannot influence a scoped Task');
assert.equal(resolveCanonicalTaskBranch({branch:'UNAVAILABLE',executionId,runId:'legacy-run'} as any,[legacyExecution],[]),'legacy/execution','legacy unscoped Task retains legacy execution evidence compatibility');

const source=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');
assert.match(source,/executionContexts\.find\(item=>item\.execution_id===record\.executionId&&\(!hasScope\|\|\(item\.projectId===record\.projectId&&item\.repositoryIdentity===record\.repositoryIdentity\)\)\)/,'execution branch fallback is project scoped');
console.log('task execution branch evidence project scope regression passed');
