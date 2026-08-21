import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEmptyGlobalStateReadModel} from './globalStateReadModel.ts';
import type {CanonicalExecutionResult,RuntimeRecord} from './model/entityTypes.ts';
import {
  GLOBAL_FEEDBACK_ISLAND_STATE_SOURCE,
  GLOBAL_FEEDBACK_ISLAND_WRITE_AUTHORITY,
  PHASE5_LATEST_RUN_FALLBACK,
  PHASE5_SELECTED_RUN_FALLBACK,
  PHASE5_UI_LOCAL_STATUS_AUTHORITY,
  RUNTIME_MONITOR_STATE_SOURCE,
  RUNTIME_SUMMARY_STATE_SOURCE,
  exactResultForRun,
  exactRunLayer2,
  projectPhase5Lifecycle,
  type Phase5ProjectionInput
} from './runtimeResultFeedbackControlLoopProjection.ts';
import {projectControlLoopFeedbackFromGlobalState,projectFeedbackDeliveryFromGlobalState} from './runtimeLiveProjection.ts';

const result=(hash='hash-1'):CanonicalExecutionResult=>({version:'AICC_EXECUTION_RESULT_V1',executionId:'execution-1',aiccStatus:'RESULT_RECEIVED',codexResult:'PASS',rawResult:'phase 5 complete',receivedAt:'2026-08-20T05:02:00.000Z',resultId:'result-1',resultHash:hash});
const runtime=(phase='COMPLETED'):RuntimeRecord=>({runId:'run-1',workPackageId:'WP-1',authorizationId:'auth-1',authoritySha:'head-1',branch:'rebuild/aicc-v2',startingHeadSha:'head-1',pid:101,pidAlive:false,processAlive:false,threadId:'thread-1',phase,currentTask:'done',latestEvent:'turn.completed',startedAt:'2026-08-20T05:00:00.000Z',lastActivityAt:'2026-08-20T05:02:00.000Z',completedAt:'2026-08-20T05:02:00.000Z',exitCode:0,processExitObserved:true,processCloseObserved:true});
const baseInput=(overrides:Partial<Phase5ProjectionInput>={}):Phase5ProjectionInput=>({
  runs:[runtime()],
  tasks:[{taskId:'task-1',lifecycle:'IN_PROGRESS',executionId:'execution-1',runId:'run-1',updatedAt:'task-r1'}],
  executions:[{executionId:'execution-1',lifecycle:'COMPLETED',taskId:'task-1',runId:'run-1',revision:'execution-r1'}],
  results:[{result:result(),runId:'run-1',revision:'result-r1'}],
  feedback:[{feedback_id:'feedback-1',lifecycle:'FEEDBACK_DELIVERY_FAILED',delivery_status:'DELIVERY_FAILED',control_loop_id:'loop-1',conversation_id:'conversation-1',binding_epoch:4,expected_gpt_turn_id:'turn-1',execution_id:'execution-1',run_id:'run-1',result_id:'result-1',result_hash:'hash-1',updated_at:'feedback-r1',failure_reason:'target unavailable'}],
  controlLoops:[{control_loop_id:'loop-1',conversation_id:'conversation-1',binding_epoch:4,control_loop_status:'WAITING_OWNER',execution_status:'COMPLETED',feedback_delivery_status:'DELIVERY_FAILED',execution_id:'execution-1',run_id:'run-1',expected_gpt_turn_id:'turn-1',updated_at:'loop-r1'}],
  ...overrides
});

const projection=projectPhase5Lifecycle(createEmptyGlobalStateReadModel(),baseInput());
assert.equal(projection.runs[0]?.lifecycle.state==='KNOWN'&&projection.runs[0].lifecycle.value,'COMPLETED');
assert.equal(projection.executions[0]?.lifecycle.state==='KNOWN'&&projection.executions[0].lifecycle.value,'COMPLETED');
assert.equal(projection.results[0]?.availability.state==='KNOWN'&&projection.results[0].availability.value,'AVAILABLE');
assert.equal(projection.feedback[0]?.delivery.state==='KNOWN'&&projection.feedback[0].delivery.value,'DELIVERY_FAILED');
assert.equal(projection.controlLoops[0]?.lifecycle.state==='KNOWN'&&projection.controlLoops[0].lifecycle.value,'WAITING_OWNER');
assert.equal(projectFeedbackDeliveryFromGlobalState(projection,'feedback-1')?.code,'DELIVERY_FAILED','Global Feedback formats the exact feedback delivery dimension');
assert.equal(projectControlLoopFeedbackFromGlobalState(projection,'loop-1')?.code,'WAITING_OWNER','Global Feedback formats the exact Control Loop dimension');
assert.equal(projectFeedbackDeliveryFromGlobalState(projection,'feedback-missing'),null,'Global Feedback does not fabricate missing delivery state');
const taskLifecycle=projection.model.entities.find(item=>item.identity.kind==='TASK')?.dimensions[0]?.projectedValue;
assert.equal(taskLifecycle?.state==='KNOWN'?taskLifecycle.value:null,'IN_PROGRESS','feedback failure does not rewrite Task lifecycle');
assert.equal(projection.runs[0]?.lifecycle.state==='KNOWN'&&projection.runs[0].lifecycle.value,'COMPLETED','feedback failure does not rewrite Run lifecycle');
assert.equal(projection.executions[0]?.lifecycle.state==='KNOWN'&&projection.executions[0].lifecycle.value,'COMPLETED','feedback failure does not rewrite Execution lifecycle');

const completedWithoutResult=projectPhase5Lifecycle(createEmptyGlobalStateReadModel(),{runs:[runtime()],tasks:baseInput().tasks,executions:baseInput().executions});
assert.equal(exactResultForRun(completedWithoutResult,'run-1'),null,'Run COMPLETED does not imply Result AVAILABLE');
const availableWithoutFeedback=projectPhase5Lifecycle(createEmptyGlobalStateReadModel(),{runs:[runtime()],results:[{result:result(),runId:'run-1'}]});
assert.equal(availableWithoutFeedback.results[0]?.availability.state,'KNOWN');
assert.equal(availableWithoutFeedback.feedback.length,0,'Result AVAILABLE does not imply Feedback DELIVERED');
assert.equal(availableWithoutFeedback.controlLoops.length,0,'Run COMPLETED does not imply Control Loop COMPLETE');

const unknownExecution=projectPhase5Lifecycle(createEmptyGlobalStateReadModel(),{tasks:[{taskId:'task-unknown',lifecycle:'IN_PROGRESS',executionId:'execution-unknown'}]});
assert.deepEqual(unknownExecution.executions[0]?.lifecycle,{state:'UNKNOWN',dimension:'execution.lifecycle'},'missing execution authority remains UNKNOWN');
assert.equal(exactRunLayer2(projection,'run-missing'),null,'exact Run lookup has no latest or selected fallback');
assert.equal(PHASE5_LATEST_RUN_FALLBACK,false);
assert.equal(PHASE5_SELECTED_RUN_FALLBACK,false);
const ambiguous=projectPhase5Lifecycle(createEmptyGlobalStateReadModel(),{runs:[runtime()],tasks:[{taskId:'task-a',executionId:'execution-a',runId:'run-1'},{taskId:'task-b',executionId:'execution-b',runId:'run-1'}],results:[{result:result(),runId:'run-1'},{result:{...result('hash-2'),resultId:'result-2'},runId:'run-1'}]});
assert.equal(ambiguous.runs[0]?.executionId,null,'conflicting explicit bindings remain ambiguous instead of choosing latest/selected');
assert.equal(exactResultForRun(ambiguous,'run-1'),null,'multiple explicit Results do not trigger an arbitrary fallback');

const noOp=projectPhase5Lifecycle(projection.model,baseInput());
assert.equal(noOp.model,projection.model,'no-op Phase 5 projection does not synthesize a revision');
const feedbackChanged=projectPhase5Lifecycle(projection.model,baseInput({feedback:[{...baseInput().feedback![0]!,delivery_status:'DELIVERED',lifecycle:'FEEDBACK_CONSUMED',updated_at:'feedback-r2'}]}));
assert.equal(feedbackChanged.model.globalProjectionRevision,projection.model.globalProjectionRevision+1,'real canonical change advances global revision');
assert.equal(feedbackChanged.feedback[0]?.entityProjectionRevision,(projection.feedback[0]?.entityProjectionRevision??0)+1,'feedback entity revision advances on real change');
assert.equal(feedbackChanged.runs[0]?.lifecycle.state==='KNOWN'&&feedbackChanged.runs[0].lifecycle.value,'COMPLETED','feedback revision cannot mutate Run lifecycle');
for(const kind of ['RUN','EXECUTION','RESULT','FEEDBACK','CONTROL_LOOP'] as const)assert.ok(projection.model.entityRevisions.some(item=>item.identity.kind===kind&&item.projectionRevision>0),`${kind} participates in entity revisioning`);
for(const kind of ['RUN','EXECUTION','RESULT','FEEDBACK','CONTROL_LOOP'] as const){const entity=projection.model.entities.find(item=>item.identity.kind===kind);assert.ok(entity?.dimensions.every(field=>field.provenance.sourceEntity.id&&field.provenance.projectionRevision>0),`${kind} retains provenance`)}

const revisionBase=baseInput();
const runChangedInput={...revisionBase,runs:[runtime('FAILED')]};
const runChanged=projectPhase5Lifecycle(projection.model,runChangedInput);
assert.equal(runChanged.runs[0]?.entityProjectionRevision,(projection.runs[0]?.entityProjectionRevision??0)+1,'Run revision advances on canonical Run change');
const executionChangedInput={...runChangedInput,executions:[{...revisionBase.executions![0]!,lifecycle:'FAILED',revision:'execution-r2'}]};
const executionChanged=projectPhase5Lifecycle(runChanged.model,executionChangedInput);
assert.ok((executionChanged.executions[0]?.entityProjectionRevision??0)>(runChanged.executions[0]?.entityProjectionRevision??0),'Execution revision advances on canonical Execution change');
const resultChangedInput={...executionChangedInput,results:[{result:result('hash-2'),runId:'run-1',revision:'result-r2'}]};
const resultChanged=projectPhase5Lifecycle(executionChanged.model,resultChangedInput);
assert.ok((resultChanged.results[0]?.entityProjectionRevision??0)>(executionChanged.results[0]?.entityProjectionRevision??0),'Result revision advances on canonical Result change');
const loopChangedInput={...resultChangedInput,controlLoops:[{...revisionBase.controlLoops![0]!,control_loop_status:'PAUSED',updated_at:'loop-r2'}]};
const loopChanged=projectPhase5Lifecycle(resultChanged.model,loopChangedInput);
assert.ok((loopChanged.controlLoops[0]?.entityProjectionRevision??0)>(resultChanged.controlLoops[0]?.entityProjectionRevision??0),'Control Loop revision advances on canonical Control Loop change');

assert.equal(RUNTIME_SUMMARY_STATE_SOURCE,'GLOBAL_STATE_READ_MODEL');
assert.equal(RUNTIME_MONITOR_STATE_SOURCE,'GLOBAL_STATE_READ_MODEL');
assert.equal(GLOBAL_FEEDBACK_ISLAND_STATE_SOURCE,'GLOBAL_STATE_READ_MODEL');
assert.equal(GLOBAL_FEEDBACK_ISLAND_WRITE_AUTHORITY,'NONE');
assert.equal(PHASE5_UI_LOCAL_STATUS_AUTHORITY,false);

const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const monitor=readFileSync(new URL('../components/RuntimeMonitor.svelte',import.meta.url),'utf8');
const feedbackProjection=readFileSync(new URL('./runtimeLiveProjection.ts',import.meta.url),'utf8');
const island=readFileSync(new URL('../components/GlobalFeedbackIsland.svelte',import.meta.url),'utf8');
assert.match(workspace,/projectPhase5Lifecycle/,'Runtime Summary builds the Layer 2 projection');
assert.match(workspace,/runLayer2=\{focusedRunLayer2\}/,'Runtime Monitor receives the exact projected Run');
assert.match(workspace,/\{focusedRunLifecycle\}/,'Runtime Summary renders Layer 2 lifecycle');
assert.match(monitor,/runLayer2\?\.lifecycle/,'Runtime Monitor formats Layer 2 lifecycle');
assert.match(feedbackProjection,/projectRuntimeFeedbackFromGlobalState/,'runtime feedback reads exact Global State projection');
assert.match(feedbackProjection,/exactResultForRun\(projection,runId\)/,'feedback result availability uses exact Run binding');
assert.doesNotMatch(island,/projectGlobalStateReadModel|writeFile|fetch\(/,'Global Feedback Island remains a renderer with no state authority');

console.log('AICC Phase 5 runtime/result/feedback/control-loop projection contract passed');
