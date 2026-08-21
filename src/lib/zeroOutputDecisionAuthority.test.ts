import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildGptReturnEnvelope} from './gptReturn.ts';
import {createEmptyGlobalStateReadModel} from './globalStateReadModel.ts';
import type {RuntimeRecord} from './model/entityTypes.ts';
import {finalizeCanonicalResult,type RuntimeState} from './runtimeManager.ts';
import {projectRuntimeFeedback} from './runtimeLiveProjection.ts';
import {projectPhase5Lifecycle} from './runtimeResultFeedbackControlLoopProjection.ts';
import {projectTaskResult} from './taskResultProjection.ts';

const emptyContext={projectId:'aicc-fixture',repositoryIdentity:'fixture/zero-output-decision-authority',projectContextRevision:0} as const;
const base=(runId='run-1787219966167-3nte5k',phase:RuntimeState['phase']='FAILED'):RuntimeState=>({runId,projectId:'aicc-fixture',repositoryIdentity:'fixture/zero-output-decision-authority',workPackageId:'AICC_ZERO_OUTPUT_DECISION_AUTHORITY_V1',authorizationId:'owner-authorized',authoritySha:'NOT_APPLICABLE',branch:'rebuild/aicc-v2',startingHeadSha:'head',pid:null,threadId:null,phase,currentTask:'technical runtime state',latestEvent:'process.exit',startedAt:'2026-08-20T00:00:00.000Z',lastActivityAt:'2026-08-20T00:01:00.000Z',events:[]});
const pass='PHASE_RESULT = PASS\nexact Codex evidence';
const fail='PHASE_RESULT = FAIL\nexact Codex evidence';

// TEST_01 / TEST_02 / historical exact-run canary: payload semantics are never parsed or rewritten.
const canary=finalizeCanonicalResult({...base(),finalAgentMessage:pass});
const failedPayload=finalizeCanonicalResult({...base('run-fail'),finalAgentMessage:fail});
assert.equal(canary.canonicalResult?.rawResult,pass);
assert.equal(failedPayload.canonicalResult?.rawResult,fail);
assert.equal(canary.canonicalResult?.codexResult,undefined);
assert.equal(failedPayload.canonicalResult?.codexReason,undefined);

// TEST_03 / TEST_04: absent exit/close facts and a non-terminal phase cannot gate persistence.
const incompleteFacts=finalizeCanonicalResult({...base('run-missing-facts','RUNNING'),exitCode:undefined,processCloseObserved:false,finalAgentMessage:pass});
assert.equal(incompleteFacts.canonicalResult?.rawResult,pass);

// TEST_05: result absence is explicit and has no invented failure reason.
const absent=finalizeCanonicalResult(base('run-absent'));
assert.equal(absent.canonicalResult,undefined);
const absentProjection=projectRuntimeFeedback(absent as RuntimeRecord,emptyContext);
assert.deepEqual(absentProjection,{state:'RUNNING',title:'Codex Result',message:'NOT_AVAILABLE',code:'CODEX_RESULT_NOT_AVAILABLE',terminal:true});

// TEST_06 / TEST_07 / TEST_08: feedback body stays exact and status cannot override it.
assert.equal(buildGptReturnEnvelope(canary.canonicalResult!),pass);
const resultDespiteFailure=projectRuntimeFeedback({...canary,phase:'FAILED',failure:'PROCESS_EXIT_NONZERO'} as RuntimeRecord,emptyContext);
assert.deepEqual(resultDespiteFailure,{state:'RUNNING',title:'Codex Result',message:pass,code:'CODEX_RESULT_AVAILABLE',terminal:true});

// TEST_09: raw process facts stay available as evidence.
const factRuntime={...canary,pid:42,pidAlive:false,processAlive:false,processExitObserved:true,processCloseObserved:false,exitCode:null} as RuntimeRecord;
const factProjection=projectPhase5Lifecycle(createEmptyGlobalStateReadModel(emptyContext),{runs:[factRuntime]});
assert.equal(factProjection.runs[0]?.processFacts.exitCode,null);
assert.equal(factProjection.runs[0]?.processFacts.processCloseObserved,false);

// TEST_10: the read model only projects result availability from the actual payload.
const noResultModel=projectPhase5Lifecycle(createEmptyGlobalStateReadModel(emptyContext),{runs:[absent as RuntimeRecord]});
assert.equal(noResultModel.results.length,0);
const exactTask=projectTaskResult({task:{taskId:'task-canary',runId:canary.runId,executionId:canary.runId,status:'FAILED'},runtime:canary as RuntimeRecord});
assert.equal(exactTask.state,'RESULT_AVAILABLE');
assert.equal(exactTask.result?.rawResult,pass);

const manager=readFileSync(new URL('./runtimeManager.ts',import.meta.url),'utf8');
const feedback=readFileSync(new URL('./runtimeLiveProjection.ts',import.meta.url),'utf8');
assert.doesNotMatch(manager,/explicitCodexResult|explicitCodexReason|aiccStatus:/);
assert.doesNotMatch(feedback,/codexResult===|codexReason|RESULT_RECEIVED_(?:PASS|FAIL|BLOCKED)/);
console.log('AICC zero output decision authority matrix passed');
