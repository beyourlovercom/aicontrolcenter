import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {feedbackPresentationKey} from './globalFeedbackInteraction.ts';
import {projectRuntimeFeedback} from './runtimeLiveProjection.ts';
import type {RuntimeRecord} from './model/entityTypes.ts';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const island=readFileSync(new URL('../components/GlobalFeedbackIsland.svelte',import.meta.url),'utf8');
const base=(runId:string,phase:string):RuntimeRecord=>({runId,workPackageId:null,authorizationId:'auth',authoritySha:'sha',branch:'branch',startingHeadSha:'sha',pid:1,threadId:'thread',phase,currentTask:'task',latestEvent:'event',startedAt:'2026-08-19T00:00:00.000Z',lastActivityAt:'2026-08-19T00:00:01.000Z'});
const success={...base('run-a','COMPLETED'),canonicalResult:{version:'AICC_EXECUTION_RESULT_V1' as const,executionId:'run-a',aiccStatus:'RESULT_RECEIVED' as const,rawResult:'package-name',receivedAt:'now',resultId:'result-a',resultHash:'hash',returnState:'RESULT_READY' as const}};
const failure={...base('run-a','FAILED'),failure:'PROCESS_EXIT_NONZERO'};

assert.deepEqual(projectRuntimeFeedback(base('run-a','RUNNING')),{state:'RUNNING',title:'正在执行',message:'run-a',code:'CODEX_RUNNING',terminal:false});
assert.deepEqual(projectRuntimeFeedback(success),{state:'SUCCESS',title:'运行成功',message:'run-a 已完成',code:'RESULT_RECEIVED',terminal:true});
assert.deepEqual(projectRuntimeFeedback(failure),{state:'ERROR',title:'运行失败',message:'run-a · PROCESS_EXIT_NONZERO',code:'PROCESS_EXIT_NONZERO',terminal:true});
assert.equal(feedbackPresentationKey(projectRuntimeFeedback(base('run-a','RUNNING'))),feedbackPresentationKey(projectRuntimeFeedback(base('run-a','STOPPING'))),'hidden internal code changes cannot spam duplicate Running feedback');
assert.notEqual(feedbackPresentationKey(projectRuntimeFeedback(base('run-a','RUNNING'))),feedbackPresentationKey(projectRuntimeFeedback(success)),'completion replaces Running feedback');

assert.match(app,/composerSubmittedRunId=readComposerRunBinding/,'Composer owns one persisted exact Run identity');
assert.match(app,/function beginRuntimeFeedbackBridge\(runId:string/,'accepted execution starts one exact-run feedback bridge');
assert.match(app,/function restorePersistedRuntimeFeedbackBridge\(\)\{if\(composerSubmittedRunId\)beginRuntimeFeedbackBridge\(composerSubmittedRunId,'ENTITY'\)\}/,'page recovery rebuilds the existing exact-run bridge from the persisted Composer binding');
assert.match(app,/onMount\(\(\)=>\{recordAppMount\(\);restorePersistedRuntimeFeedbackBridge\(\)/,'exact-run ownership is restored before bootstrap requests can publish competing feedback');
assert.match(app,/if\(!runtimeFeedbackRunId\|\|runtime\?\.runId!==runtimeFeedbackRunId\)return/,'concurrent Run B cannot steal Run A feedback');
assert.match(app,/const feedbackOwnerRunId=runtimeFeedbackRunId\?\?selectedRunId;const incoming=[\s\S]*item\.runId===feedbackOwnerRunId/,'bridge notifications defer to the action-owned exact Run before selected-run UI state');
assert.match(app,/request\(`\/api\/codex\/runtime\?runId=\$\{encodeURIComponent\(runId\)\}`\)/,'bridge resolves the exact canonical Runtime by Run ID');
assert.match(app,/composerExactRuntime=response\.runtime;publishRuntimeFeedback\(response\.runtime\)/,'exact Composer runtime publication is wired after live lookup');
assert.match(app,/runtimeFeedbackLastPresentation=feedbackPresentationKey\(accepted\)/,'accepted state seeds exactly-once presentation deduplication');
assert.match(app,/Date\.now\(\)-runtimeFeedbackAcceptedAt<400/,'accepted feedback receives a bounded visible paint window without delaying Runtime');
assert.match(app,/if\(presentation!==runtimeFeedbackLastPresentation\)/,'polling publishes only meaningful presentation transitions');
assert.match(app,/setFeedback\(next,'EXACT_RUN'\)/,'exact runtime lifecycle publishes through the existing global authority');
assert.match(app,/source==='GENERAL'&&runtimeLifecycleFeedback&&value!==runtimeLifecycleFeedback&&value\.state!=='IDLE'/,'all transient general feedback yields back to exact-run lifecycle authority');
assert.match(app,/const current=runtimeLifecycleFeedback\?\?fallback/,'transient overlays restore the current lifecycle, not a stale snapshot');
assert.match(app,/if\(feedback!==overlay\)return/,'a terminal transition during Copy Success prevents stale Running restoration');
assert.equal((app.match(/function setFeedback\(/g)??[]).length,1,'one global feedback authority remains');
assert.equal((app.match(/<GlobalFeedbackIsland/g)??[]).length,1,'one global feedback renderer remains');
assert.doesNotMatch(island,/feedback\.code/,'internal status/debug codes are not visible');
assert.doesNotMatch(island,/\{presentation\}|global-feedback-state/,'internal feedback state enum is not visible');
assert.doesNotMatch(app,/feedbackCopyStore|copyToast|copyIsland|clipboardNotice/i,'no second feedback store or renderer was introduced');
console.log('exact-run runtime feedback bridge regression passed');
