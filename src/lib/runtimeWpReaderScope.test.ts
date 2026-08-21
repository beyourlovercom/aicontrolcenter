import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {resolveAiccStateDir} from './stateDirectory.ts';
import {invalidateRuntimeProjectionSnapshot,readRuntime,runtimeBelongsToProject} from './runtimeManager.ts';

const aicc={projectId:'aicc',repositoryIdentity:'repo-a',repositoryPath:'/repo-a'};
const erp={projectId:'erpbeyourlovercom',repositoryIdentity:'repo-b',repositoryPath:'/repo-b'};
const runtime=(scope:typeof aicc,runId:string)=>({runId,projectId:scope.projectId,repositoryIdentity:scope.repositoryIdentity,repositoryPath:scope.repositoryPath,workPackageId:'SAME_WP',entityType:'work_package',entityId:'SAME_WP',authorizationId:'auth',authoritySha:'sha',branch:'main',startingHeadSha:'sha',pid:null,threadId:null,phase:'RUNNING',currentTask:'test',latestEvent:'test',startedAt:'2026-08-21T00:00:00.000Z',lastActivityAt:'2026-08-21T00:00:00.000Z'} as any);
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
