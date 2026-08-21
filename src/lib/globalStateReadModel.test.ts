import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {resolveAiccStateDir} from './stateDirectory.ts';
import {
  AICC_STATE_INFERENCE_AUTHORITY,
  GLOBAL_STATE_READ_MODEL_AUTHORITY,
  GLOBAL_STATE_WRITE_AUTHORITY,
  availableSourceRevision,
  createEmptyGlobalStateReadModel,
  dimensionProjection,
  entityIdentity,
  explicitBinding,
  knownDimensionValue,
  planExactProjectionInvalidation,
  projectGlobalStateReadModel,
  projectionSource,
  rebuildGlobalStateReadModel,
  resolveExplicitBindings,
  sourceEntityIdentity,
  unavailableSourceRevision,
  unknownDimensionValue,
  type DimensionProjectionInput,
  type DimensionValue,
  type EntityIdentity,
  type GlobalStateProjectionCandidate,
  type Layer1ProjectionAdapter
} from './globalStateReadModel.ts';
import {globalStateReadModelDirectory} from './globalStateReadModelDirectory.ts';

const wp=entityIdentity('WORK_PACKAGE','WP-1');
const pr=entityIdentity('PULL_REQUEST','PR-1');
const task=entityIdentity('TASK','TASK-1');
const execution=entityIdentity('EXECUTION','EXEC-1');
const run=entityIdentity('RUN','RUN-1');
const result=entityIdentity('RESULT','RESULT-1');
const feedback=entityIdentity('FEEDBACK','FEEDBACK-1');
const controlLoop=entityIdentity('CONTROL_LOOP','LOOP-1');

assert.equal(new Set([wp.kind,pr.kind,task.kind,execution.kind,run.kind,result.kind,feedback.kind,controlLoop.kind]).size,8,'Layer 1 domain identities remain distinct');
assert.notDeepEqual(task,execution);
assert.notDeepEqual(execution,run);
// @ts-expect-error TASK identities must not type-check as RUN identities.
const invalidRunIdentity:EntityIdentity<'RUN'>=task;
void invalidRunIdentity;

const wpSource=projectionSource(sourceEntityIdentity('WORK_PACKAGE','WP-1'),availableSourceRevision('wp-r1'));
const prSource=projectionSource(sourceEntityIdentity('PULL_REQUEST','PR-1'),availableSourceRevision('pr-r1'));
const taskSource=projectionSource(sourceEntityIdentity('TASK','TASK-1'),unavailableSourceRevision());
const executionSource=projectionSource(sourceEntityIdentity('EXECUTION','EXEC-1'),availableSourceRevision('exec-r1'));
const runSource=projectionSource(sourceEntityIdentity('RUN','RUN-1'),availableSourceRevision('run-r1'));
const resultSource=projectionSource(sourceEntityIdentity('RESULT','RESULT-1'),availableSourceRevision('result-r1'));
const feedbackSource=projectionSource(sourceEntityIdentity('FEEDBACK','FEEDBACK-1'),unavailableSourceRevision());
const controlLoopSource=projectionSource(sourceEntityIdentity('CONTROL_LOOP','LOOP-1'),availableSourceRevision('loop-r1'));

const taskUnknown=unknownDimensionValue('task.lifecycle');
assert.deepEqual(taskUnknown,{state:'UNKNOWN',dimension:'task.lifecycle'},'UNKNOWN remains first-class and unnormalized');
// @ts-expect-error Independent lifecycle dimensions cannot be assigned to each other.
const invalidRunLifecycle:DimensionValue<'run.lifecycle'>=taskUnknown;
void invalidRunLifecycle;

const dimensions={
  wp:dimensionProjection('wp.lifecycle',knownDimensionValue('wp.lifecycle','AUTHORIZED'),wpSource),
  pr:dimensionProjection('pr.lifecycle',knownDimensionValue('pr.lifecycle','OPEN'),prSource),
  task:dimensionProjection('task.lifecycle',taskUnknown,taskSource),
  execution:dimensionProjection('execution.lifecycle',knownDimensionValue('execution.lifecycle','ACCEPTED'),executionSource),
  run:dimensionProjection('run.lifecycle',knownDimensionValue('run.lifecycle','RUNNING'),runSource),
  result:dimensionProjection('result.availability',knownDimensionValue('result.availability','AVAILABLE'),resultSource),
  feedback:dimensionProjection('feedback.delivery',unknownDimensionValue('feedback.delivery'),feedbackSource),
  controlLoop:dimensionProjection('controlLoop.lifecycle',knownDimensionValue('controlLoop.lifecycle','AWAITING_EXACT_FEEDBACK'),controlLoopSource)
};

function candidate(taskDimension:DimensionProjectionInput=dimensions.task):GlobalStateProjectionCandidate{
  return {
    entities:[
      {identity:wp,dimensions:[dimensions.wp]},
      {identity:pr,dimensions:[dimensions.pr]},
      {identity:task,dimensions:[taskDimension]},
      {identity:execution,dimensions:[dimensions.execution]},
      {identity:run,dimensions:[dimensions.run]},
      {identity:result,dimensions:[dimensions.result]},
      {identity:feedback,dimensions:[dimensions.feedback]},
      {identity:controlLoop,dimensions:[dimensions.controlLoop]}
    ],
    bindings:[
      explicitBinding('WP_TO_PR',wp,pr,wpSource),
      explicitBinding('WP_TO_TASK',wp,task,wpSource),
      explicitBinding('TASK_TO_EXECUTION',task,execution,taskSource),
      explicitBinding('EXECUTION_TO_RUN',execution,run,executionSource),
      explicitBinding('RUN_TO_RESULT',run,result,runSource),
      explicitBinding('CONTROL_LOOP_TO_RUN',controlLoop,run,controlLoopSource),
      explicitBinding('CONTROL_LOOP_TO_FEEDBACK',controlLoop,feedback,feedbackSource),
      explicitBinding('RUN_TO_FEEDBACK',run,feedback,feedbackSource)
    ]
  };
}

const empty=createEmptyGlobalStateReadModel();
assert.equal(empty.authority,GLOBAL_STATE_READ_MODEL_AUTHORITY);
assert.equal(empty.writeAuthority,GLOBAL_STATE_WRITE_AUTHORITY);
assert.equal(empty.inferenceAuthority,AICC_STATE_INFERENCE_AUTHORITY);
assert.equal(empty.globalProjectionRevision,0);
assert.ok(Object.isFrozen(empty),'read-model snapshots are immutable');

const mutableLayer1Identity={kind:'TASK' as const,id:'TASK-MUTABLE'};
const mutableLayer1Value={state:'KNOWN' as const,dimension:'task.lifecycle' as const,value:'QUEUED'};
const mutableLayer1Source={sourceDomain:'TASK' as const,sourceEntity:{domain:'TASK' as const,id:'TASK-MUTABLE'},sourceRevision:{availability:'UNAVAILABLE' as const}};
const isolatedProjection=projectGlobalStateReadModel(empty,{entities:[{identity:mutableLayer1Identity,dimensions:[{dimension:'task.lifecycle',projectedValue:mutableLayer1Value,source:mutableLayer1Source}]}],bindings:[]},'2026-08-19T23:00:00.000Z');
assert.equal(Object.isFrozen(mutableLayer1Identity),false,'projection does not freeze caller-owned Layer 1 identities');
assert.equal(Object.isFrozen(mutableLayer1Value),false,'projection does not freeze caller-owned Layer 1 values');
mutableLayer1Value.value='CHANGED_AFTER_PROJECTION';
assert.equal(isolatedProjection.entities[0]?.dimensions[0]?.projectedValue.state==='KNOWN'&&isolatedProjection.entities[0].dimensions[0].projectedValue.value,'QUEUED','Layer 2 snapshots do not retain mutable Layer 1 object ownership');

const first=projectGlobalStateReadModel(empty,candidate(),'2026-08-20T00:00:00.000Z');
assert.equal(first.globalProjectionRevision,1);
assert.equal(first.entities.length,8,'independent Layer 1 stores project without collapsed storage');
assert.deepEqual(first.entities.find(entity=>entity.identity.kind==='TASK')?.dimensions[0].projectedValue,taskUnknown);
assert.deepEqual(first.entities.find(entity=>entity.identity.kind==='TASK')?.dimensions[0].provenance.sourceRevision,{availability:'UNAVAILABLE'},'unavailable source revision is not fabricated');
assert.equal(first.entities.find(entity=>entity.identity.kind==='WORK_PACKAGE')?.dimensions[0].provenance.sourceRevision.availability,'AVAILABLE');
assert.equal(first.entities.find(entity=>entity.identity.kind==='WORK_PACKAGE')?.dimensions[0].provenance.projectionRevision,1);
assert.equal(first.entities.find(entity=>entity.identity.kind==='WORK_PACKAGE')?.dimensions[0].provenance.projectedAt,'2026-08-20T00:00:00.000Z');
assert.equal(new Set(first.entities.flatMap(entity=>entity.dimensions.map(field=>field.dimension))).size,8,'lifecycle dimensions remain independent');

const exactBinding=resolveExplicitBindings(first,'TASK_TO_EXECUTION',task);
assert.equal(exactBinding.state,'BOUND');
if(exactBinding.state==='BOUND')assert.deepEqual(exactBinding.bindings.map(binding=>binding.to),[execution]);
const missingTask=entityIdentity('TASK','TASK-UNBOUND');
assert.deepEqual(resolveExplicitBindings(first,'TASK_TO_EXECUTION',missingTask),{state:'UNBOUND',bindings:[]},'missing binding remains UNBOUND without latest/selected fallback');

const noOp=projectGlobalStateReadModel(first,candidate(),'2026-08-20T01:00:00.000Z');
assert.equal(noOp,first,'a no-op projection returns the accepted snapshot');
assert.equal(noOp.globalProjectionRevision,1,'a no-op does not synthesize a global revision');
assert.equal(noOp.projectedAt,'2026-08-20T00:00:00.000Z','a no-op does not synthesize a projection timestamp');

const completedTask=dimensionProjection('task.lifecycle',knownDimensionValue('task.lifecycle','COMPLETE'),projectionSource(sourceEntityIdentity('TASK','TASK-1'),availableSourceRevision('task-r2')));
const second=projectGlobalStateReadModel(first,candidate(completedTask),'2026-08-20T02:00:00.000Z');
assert.equal(second.globalProjectionRevision,2,'global revision advances monotonically on a model change');
assert.equal(second.entities.find(entity=>entity.identity.kind==='TASK')?.projectionRevision,2,'changed entity revision advances monotonically');
assert.equal(second.entities.find(entity=>entity.identity.kind==='RUN')?.projectionRevision,1,'unrelated entity revision does not change');
assert.equal(second.entities.find(entity=>entity.identity.kind==='TASK')?.dimensions[0].provenance.projectionRevision,2);

const bindingChangedCandidate=candidate(completedTask);
const bindingRevisionChanged:GlobalStateProjectionCandidate={
  ...bindingChangedCandidate,
  bindings:bindingChangedCandidate.bindings.map(binding=>binding.kind==='TASK_TO_EXECUTION'
    ?explicitBinding('TASK_TO_EXECUTION',task,execution,projectionSource(sourceEntityIdentity('TASK','TASK-1'),availableSourceRevision('task-binding-r3')))
    :binding)
};
const third=projectGlobalStateReadModel(second,bindingRevisionChanged,'2026-08-20T02:30:00.000Z');
assert.equal(third.globalProjectionRevision,3);
assert.equal(third.entities.find(entity=>entity.identity.kind==='TASK')?.projectionRevision,3,'binding changes advance the from-entity revision');
assert.equal(third.entities.find(entity=>entity.identity.kind==='EXECUTION')?.projectionRevision,2,'binding changes advance the to-entity revision');
assert.equal(third.entities.find(entity=>entity.identity.kind==='RUN')?.projectionRevision,1,'binding changes do not advance unrelated entities');

const withoutTask:GlobalStateProjectionCandidate={
  entities:bindingChangedCandidate.entities.filter(entity=>entity.identity.kind!=='TASK'),
  bindings:bindingChangedCandidate.bindings.filter(binding=>binding.from.kind!=='TASK'&&binding.to.kind!=='TASK')
};
const removed=projectGlobalStateReadModel(third,withoutTask,'2026-08-20T02:40:00.000Z');
assert.equal(removed.entityRevisions.find(record=>record.identity.kind==='TASK')?.projectionRevision,4,'removed identities retain monotonic revision history');
const reintroduced=projectGlobalStateReadModel(removed,bindingChangedCandidate,'2026-08-20T02:50:00.000Z');
assert.equal(reintroduced.entities.find(entity=>entity.identity.kind==='TASK')?.projectionRevision,5,'reintroduced identities do not reset entity revision');

const taskInvalidation=planExactProjectionInvalidation(third,sourceEntityIdentity('TASK','TASK-1'));
assert.equal(taskInvalidation.requiresReprojection,true);
assert.deepEqual(taskInvalidation.dependentProjections.map(target=>target.type).sort(),['BINDING','DIMENSION']);
const unrelatedInvalidation=planExactProjectionInvalidation(third,sourceEntityIdentity('TASK','TASK-OTHER'));
assert.deepEqual(unrelatedInvalidation,{sourceEntity:{domain:'TASK',id:'TASK-OTHER'},dependentProjections:[],requiresReprojection:false},'unrelated canonical changes do not mutate another entity');

const taskAdapter:Layer1ProjectionAdapter={
  domain:'TASK',
  readCanonicalProjection:()=>({entities:[{identity:task,dimensions:[completedTask]}],bindings:[explicitBinding('TASK_TO_EXECUTION',task,execution,projectionSource(sourceEntityIdentity('TASK','TASK-1'),availableSourceRevision('task-r2')))]})
};
const executionAdapter:Layer1ProjectionAdapter={
  domain:'EXECUTION',
  readCanonicalProjection:()=>({entities:[{identity:execution,dimensions:[dimensions.execution]}],bindings:[]})
};
const rebuiltForward=await rebuildGlobalStateReadModel(createEmptyGlobalStateReadModel(),[taskAdapter,executionAdapter],'2026-08-20T03:00:00.000Z');
const rebuiltReverse=await rebuildGlobalStateReadModel(createEmptyGlobalStateReadModel(),[executionAdapter,taskAdapter],'2026-08-20T03:00:00.000Z');
assert.deepEqual(rebuiltForward,rebuiltReverse,'Layer 2 rebuild is deterministic regardless of adapter order');
assert.equal(rebuiltForward.entities.length,2);
assert.equal(rebuiltForward.bindings.length,1);

const resolvedStateDirectory=resolveAiccStateDir();
const directory=globalStateReadModelDirectory();
assert.equal(directory.stateDirectory,resolvedStateDirectory,'existing state-directory resolution remains the directory authority');
assert.equal(directory.projectionPath,join(resolvedStateDirectory,'global-state-read-model.json'));
assert.equal(directory.authority,'READ_ONLY_PROJECTION');
assert.equal(directory.writeAuthority,'NONE');
assert.deepEqual(Object.keys(directory).sort(),['authority','projectionPath','stateDirectory','writeAuthority'],'the directory boundary exposes no write operation');
const implementation=readFileSync(new URL('./globalStateReadModel.ts',import.meta.url),'utf8');
assert.doesNotMatch(implementation,/\b(?:writeFile|rename|mkdir|rmSync|unlink)\w*\b/,'the Layer 2 core has no canonical filesystem writer');

console.log('AICC global canonical lifecycle projection Phase 1 core contract passed');
