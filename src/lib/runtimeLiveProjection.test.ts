import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {projectRuntimeFeedback,shouldContinueRuntimePolling} from './runtimeLiveProjection.ts';
import type {RuntimeRecord} from './model/entityTypes.ts';

const base=(phase:string):RuntimeRecord=>({runId:'run-live-1',projectId:'aicc',repositoryIdentity:'aicc-repo',workPackageId:'WP',authorizationId:'auth',authoritySha:'sha',branch:'branch',startingHeadSha:'sha',pid:1,threadId:'thread',phase,currentTask:'task',latestEvent:'event',startedAt:'2026-08-14T00:00:00.000Z',lastActivityAt:'2026-08-14T00:00:01.000Z'});
assert.equal(projectRuntimeFeedback(base('STARTING')).state,'RUNNING');
assert.equal(projectRuntimeFeedback(base('RUNNING')).code,'CODEX_RUNNING');
assert.equal(projectRuntimeFeedback(base('COMPLETED')).code,'CODEX_RESULT_NOT_AVAILABLE');
assert.deepEqual(projectRuntimeFeedback({...base('COMPLETED'),canonicalResult:{version:'AICC_EXECUTION_RESULT_V1',executionId:'run-live-1',projectId:'aicc',repositoryIdentity:'aicc-repo',rawResult:'package-name',receivedAt:'now',resultId:'result',resultHash:'hash',returnState:'RESULT_READY'}}),{state:'RUNNING',title:'Codex Result',message:'package-name',code:'CODEX_RESULT_AVAILABLE',terminal:true},'canonical result availability is not a success classification');
for(const codexResult of ['PASS','FAIL','BLOCKED','CANCELLED'] as const){
  const runtime={...base('COMPLETED'),canonicalResult:{version:'AICC_EXECUTION_RESULT_V1' as const,executionId:'run-live-1',projectId:'aicc',repositoryIdentity:'aicc-repo',aiccStatus:'RESULT_RECEIVED' as const,codexResult,rawResult:`exact ${codexResult}`,receivedAt:'2026-08-14T00:00:02.000Z',resultId:'result-run-live-1',resultHash:'hash',returnState:'RESULT_READY' as const}};
  assert.deepEqual(projectRuntimeFeedback(runtime),{state:'RUNNING',title:'Codex Result',message:`exact ${codexResult}`,code:'CODEX_RESULT_AVAILABLE',terminal:true});
}
assert.equal(projectRuntimeFeedback({...base('RECOVERY_REQUIRED'),failure:'RUNTIME_TRANSPORT_FAILURE'}).code,'CODEX_RESULT_NOT_AVAILABLE','transport failure is technical evidence, not a Codex semantic result');
assert.equal(projectRuntimeFeedback({...base('FAILED'),failure:'PROCESS_EXIT_NONZERO'}).code,'CODEX_RESULT_NOT_AVAILABLE','runtime technical facts do not invent a Codex result');
assert.equal(projectRuntimeFeedback({...base('FAILED'),failure:'PROCESS_EXIT_NONZERO',canonicalResult:{version:'AICC_EXECUTION_RESULT_V1',executionId:'run-live-1',projectId:'aicc',repositoryIdentity:'aicc-repo',rawResult:'partial output',receivedAt:'now',resultId:'result',resultHash:'hash',returnState:'RESULT_READY'}}).code,'CODEX_RESULT_AVAILABLE','a persisted result is never gated by an AICC runtime failure');
assert.equal(shouldContinueRuntimePolling(base('RUNNING'),false,'run-live-1'),true);
assert.equal(shouldContinueRuntimePolling(base('COMPLETED'),false,'run-live-1'),true,'terminal runtime is followed until canonical result is durable');
assert.equal(shouldContinueRuntimePolling({...base('COMPLETED'),canonicalResult:{version:'AICC_EXECUTION_RESULT_V1',executionId:'run-live-1',projectId:'aicc',repositoryIdentity:'aicc-repo',aiccStatus:'RESULT_RECEIVED',rawResult:'exact',receivedAt:'now',resultId:'result',resultHash:'hash',returnState:'RESULT_READY'}},false,'run-live-1'),false);

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
assert.match(app,/function bindLaunchedExecution[\s\S]*state:'RUNNING'[\s\S]*startRuntimePolling\(\)/,'accepted execution binds exact Run and starts live polling without terminal success');
assert.match(app,/Promise\.allSettled\(\[request\(`\/api\/codex\/runtime/,'runtime projection is not discarded by an Inbox/Outbox read failure');
assert.match(app,/publishRuntimeFeedback\(response\.runtime\)/,'exact Run lookup publishes live canonical lifecycle feedback');
assert.match(app,/selectedRunId\|\|!candidates\.some/,'refresh preserves an exact selected Run when it remains available');
assert.match(app,/const feedbackOwnerRunId=runtimeFeedbackRunId\?\?selectedRunId;const incoming=[\s\S]*!feedbackOwnerRunId\|\|item\.runId===feedbackOwnerRunId/,'an unrelated terminal notification cannot replace the action-owned exact Run projection');
assert.doesNotMatch(app,/title:'指令已导入并自动执行'/,'HTTP acceptance does not project execution success');
assert.doesNotMatch(app,/title:'Bridge 执行已启动'/,'RUN_STARTED does not project execution success');
assert.doesNotMatch(app,/location\.reload|window\.location\.reload/,'live result projection does not require browser refresh');
assert.equal((app.match(/canonicalResult\?\.rawResult/g)??[]).length>=1,true,'copy and display retain the canonical result source');
console.log('runtime live status/result projection matrix passed');
