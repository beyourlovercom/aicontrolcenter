import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {resolveAiccStateDir} from './stateDirectory.ts';
import {finalizeCanonicalResult,invalidateRuntimeProjectionSnapshot,readRuntime,readRuntimeByRunIdReadOnly,runtimeBelongsToProject} from './runtimeManager.ts';
import {persistRuntimeTaskState,readProjectTaskResult} from './projectTaskStore.ts';

const aicc={projectId:'aicc',repositoryIdentity:'repo-a',repositoryPath:'/repo-a'};
const erp={projectId:'erpbeyourlovercom',repositoryIdentity:'repo-b',repositoryPath:'/repo-b'};
const runtime=(scope:typeof aicc,runId:string)=>({runId,projectId:scope.projectId,repositoryIdentity:scope.repositoryIdentity,repositoryPath:scope.repositoryPath,workPackageId:'SAME_WP',entityType:'work_package',entityId:'SAME_WP',authorizationId:'auth',authoritySha:'sha',branch:'main',startingHeadSha:'sha',pid:null,threadId:null,phase:'RUNNING',currentTask:'test',latestEvent:'test',startedAt:'2026-08-21T00:00:00.000Z',lastActivityAt:'2026-08-21T00:00:00.000Z',finalAgentMessage:'result-payload'} as any);
const state=resolveAiccStateDir();
writeFileSync(join(state,'runtime-a.json'),JSON.stringify(runtime(aicc,'run-a')));
writeFileSync(join(state,'runtime-b.json'),JSON.stringify(runtime(erp,'run-b')));
invalidateRuntimeProjectionSnapshot();
assert.equal(readRuntime('SAME_WP','work_package',undefined,aicc)?.runId,'run-a');
assert.equal(readRuntime('SAME_WP','work_package',undefined,erp)?.runId,'run-b');
assert.equal(readRuntime('SAME_WP','work_package')?.runId,undefined);
assert.equal(runtimeBelongsToProject(runtime(aicc,'run-a'),aicc),true);
assert.equal(runtimeBelongsToProject(runtime(aicc,'run-a'),erp),false);
console.log('Phase 3 project-scoped WP runtime reader passed');

// D0A_2B_BATCH3B1: same raw run ID across two projects must preserve distinct canonical result scope.
const SAME_RUN_ID='run-same-id';
const runA=runtime(aicc,SAME_RUN_ID);
finalizeCanonicalResult(runA);
writeFileSync(join(state,`runtime-${SAME_RUN_ID}.json`),JSON.stringify(runA));persistRuntimeTaskState(runA);
invalidateRuntimeProjectionSnapshot();
const resultA=readProjectTaskResult(aicc,SAME_RUN_ID)?.canonicalResult;
assert.equal(resultA?.projectId,aicc.projectId);
assert.equal(resultA?.repositoryIdentity,aicc.repositoryIdentity);
const readBackA=await readRuntimeByRunIdReadOnly(SAME_RUN_ID);
assert.equal(readBackA?.projectId,aicc.projectId);
assert.equal(readBackA?.canonicalResult?.projectId,aicc.projectId);

// Same raw run ID reused in a second project's runtime file must keep its own distinct canonical scope, never merge with runA's.
const runB=runtime(erp,SAME_RUN_ID);
finalizeCanonicalResult(runB);
const resultBRaw=JSON.parse(JSON.stringify(runB));
assert.equal(resultBRaw.canonicalResult.projectId,erp.projectId);
persistRuntimeTaskState(runB);assert.notEqual(resultBRaw.canonicalResult.projectId,resultA?.projectId);
assert.equal(readProjectTaskResult(erp,SAME_RUN_ID)?.canonicalResult?.projectId,erp.projectId);
assert.equal(readProjectTaskResult(aicc,SAME_RUN_ID)?.canonicalResult?.projectId,aicc.projectId);
console.log('Phase 3 same raw run ID cross-project canonical result scope passed');

// Legacy persisted unscoped runtime must fail closed for project-scoped reads, never silently attach to current project.
const legacyUnscoped={runId:'run-legacy-unscoped',workPackageId:'SAME_WP',entityType:'work_package',entityId:'SAME_WP',authorizationId:'auth',authoritySha:'sha',branch:'main',startingHeadSha:'sha',pid:null,threadId:null,phase:'RUNNING',currentTask:'test',latestEvent:'test',startedAt:'2026-08-21T00:00:00.000Z',lastActivityAt:'2026-08-21T00:00:00.000Z',worktreePath:aicc.repositoryPath,spawnCwd:aicc.repositoryPath} as any;
writeFileSync(join(state,'runtime-legacy-unscoped.json'),JSON.stringify(legacyUnscoped));
invalidateRuntimeProjectionSnapshot();
assert.equal(runtimeBelongsToProject(legacyUnscoped,aicc),false);
const legacyRead=readRuntime('SAME_WP','work_package',undefined,aicc);
assert.notEqual(legacyRead?.runId,'run-legacy-unscoped');
console.log('Phase 3 legacy unscoped runtime fail-closed passed');
