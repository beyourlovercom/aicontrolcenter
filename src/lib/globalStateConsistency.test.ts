import assert from 'node:assert/strict';
import {
  CACHE_AUTHORITY,
  LAYER2_CANONICAL_WRITE,
  NOTIFICATION_AUTHORITY,
  POLLING_AUTHORITY,
  RECONCILIATION_FAILURE_INFERENCE,
  STATE_RECOVERY_REEXECUTION_AUTHORITY,
  createGlobalStateConsistencyCoordinator,
  createLayer2ChangeNotifier
} from './globalStateConsistency.ts';
import {
  availableSourceRevision,
  createEmptyGlobalStateReadModel,
  dimensionProjection,
  entityIdentity,
  explicitBinding,
  knownDimensionValue,
  projectionSource,
  projectGlobalStateReadModel,
  sourceEntityIdentity,
  type GlobalStateProjectionCandidate
} from './globalStateReadModel.ts';

const scope={projectId:'consistency-a',repositoryIdentity:'repo-a',projectContextRevision:1} as const;
const foreignScope={projectId:'consistency-b',repositoryIdentity:'repo-b',projectContextRevision:1} as const;
const source=(domain:any,id:string,revision:string)=>projectionSource(sourceEntityIdentity(scope,domain,id),availableSourceRevision(revision));
const milestone=entityIdentity(scope,'MILESTONE','M8'),wp=entityIdentity(scope,'WORK_PACKAGE','WP-A'),pr=entityIdentity(scope,'PULL_REQUEST','repo#42'),task=entityIdentity(scope,'TASK','TASK-A'),execution=entityIdentity(scope,'EXECUTION','EXEC-A'),run=entityIdentity(scope,'RUN','RUN-A'),result=entityIdentity(scope,'RESULT','RESULT-A'),feedback=entityIdentity(scope,'FEEDBACK','FEEDBACK-A'),loop=entityIdentity(scope,'CONTROL_LOOP','LOOP-A');
const dimensionValue=(model:any,kind:string,id:string,dimension?:string)=>{const field=model.entities.find((entity:any)=>entity.identity.kind===kind&&entity.identity.id===id)?.dimensions.find((item:any)=>!dimension||item.dimension===dimension);return field?.projectedValue.state==='KNOWN'?field.projectedValue.value:null;};

function candidate(revision:number,runLifecycle='RUNNING',prLifecycle='OPEN'):GlobalStateProjectionCandidate{
  const roadmap=source('ROADMAP','roadmap:M8',`roadmap-r${revision}`),wpSource=source('WORK_PACKAGE','WP-A',`wp-r${revision}`),prSource=source('PULL_REQUEST','repo#42',`pr-r${revision}`),taskSource=source('TASK','TASK-A',`task-r${revision}`),executionSource=source('EXECUTION','EXEC-A',`execution-r${revision}`),runSource=source('RUN','RUN-A',`run-r${revision}`),resultSource=source('RESULT','RESULT-A',`result-r${revision}`),feedbackSource=source('FEEDBACK','FEEDBACK-A',`feedback-r${revision}`),loopSource=source('CONTROL_LOOP','LOOP-A',`loop-r${revision}`);
  return {entities:[
    {identity:milestone,dimensions:[dimensionProjection('milestone.lifecycle',knownDimensionValue('milestone.lifecycle','ACTIVE'),roadmap)]},
    {identity:wp,dimensions:[dimensionProjection('wp.structure',knownDimensionValue('wp.structure','M8:WP-A'),roadmap),dimensionProjection('wp.lifecycle',knownDimensionValue('wp.lifecycle','IN_PROGRESS'),wpSource)]},
    {identity:pr,dimensions:[dimensionProjection('pr.lifecycle',knownDimensionValue('pr.lifecycle',prLifecycle),prSource)]},
    {identity:task,dimensions:[dimensionProjection('task.lifecycle',knownDimensionValue('task.lifecycle','IN_PROGRESS'),taskSource)]},
    {identity:execution,dimensions:[dimensionProjection('execution.lifecycle',knownDimensionValue('execution.lifecycle',runLifecycle==='COMPLETED'?'COMPLETED':'RUNNING'),executionSource)]},
    {identity:run,dimensions:[dimensionProjection('run.lifecycle',knownDimensionValue('run.lifecycle',runLifecycle),runSource)]},
    {identity:result,dimensions:[dimensionProjection('result.availability',knownDimensionValue('result.availability',runLifecycle==='COMPLETED'?'AVAILABLE':'PENDING'),resultSource)]},
    {identity:feedback,dimensions:[dimensionProjection('feedback.lifecycle',knownDimensionValue('feedback.lifecycle','PENDING'),feedbackSource),dimensionProjection('feedback.delivery',knownDimensionValue('feedback.delivery','FAILED'),feedbackSource)]},
    {identity:loop,dimensions:[dimensionProjection('controlLoop.lifecycle',knownDimensionValue('controlLoop.lifecycle','WAITING_OWNER'),loopSource)]}
  ],bindings:[
    explicitBinding('MILESTONE_TO_WP',milestone,wp,roadmap),explicitBinding('WP_TO_PR',wp,pr,wpSource),explicitBinding('WP_TO_TASK',wp,task,wpSource),explicitBinding('TASK_TO_EXECUTION',task,execution,taskSource),explicitBinding('EXECUTION_TO_RUN',execution,run,executionSource),explicitBinding('RUN_TO_RESULT',run,result,resultSource),explicitBinding('RUN_TO_FEEDBACK',run,feedback,feedbackSource),explicitBinding('EXECUTION_TO_CONTROL_LOOP',execution,loop,loopSource),explicitBinding('CONTROL_LOOP_TO_RUN',loop,run,loopSource),explicitBinding('CONTROL_LOOP_TO_FEEDBACK',loop,feedback,loopSource)
  ]};
}
function withPrOnlyChange(base:GlobalStateProjectionCandidate,prLifecycle:string,sourceRevision:string):GlobalStateProjectionCandidate{
  const prSource=source('PULL_REQUEST','repo#42',sourceRevision);
  return {...base,entities:base.entities.map(entity=>entity.identity.kind==='PULL_REQUEST'?{identity:entity.identity,dimensions:[dimensionProjection('pr.lifecycle',knownDimensionValue('pr.lifecycle',prLifecycle),prSource)]}:entity)};
}

let current={canonicalRevision:1,candidate:candidate(1),projectedAt:'2026-08-20T08:00:00.000Z'};
const coordinator=createGlobalStateConsistencyCoordinator(async()=>current,createEmptyGlobalStateReadModel(scope));
assert.throws(()=>projectGlobalStateReadModel(createEmptyGlobalStateReadModel(scope),{entities:[{identity:entityIdentity(foreignScope,'TASK','SAME'),dimensions:[]}],bindings:[]}),/FOREIGN_PROJECT_ENTITY/,'foreign candidate is rejected rather than re-scoped');
const notifications:number[]=[];const unsubscribe=coordinator.subscribe(change=>notifications.push(change.globalProjectionRevision));
const first=await coordinator.reconcile();
assert.equal(first.globalProjectionRevision,1);assert.equal(coordinator.canonicalRevision(),1);
assert.equal((await coordinator.reconcile()).globalProjectionRevision,1,'same canonical revision/value causes no Layer 2 revision bump');
assert.deepEqual(notifications,[1],'notifications describe actual Layer 2 changes only');

current={canonicalRevision:2,candidate:candidate(2,'COMPLETED'),projectedAt:'2026-08-20T08:01:00.000Z'};
const second=await coordinator.invalidate(sourceEntityIdentity(scope,'RUN','RUN-A'));
assert.equal(second.globalProjectionRevision,2);assert.equal(dimensionValue(second,'RUN','RUN-A'),'COMPLETED');
assert.equal(dimensionValue(second,'TASK','TASK-A'),'IN_PROGRESS','Run terminal state does not fabricate Task lifecycle');
assert.equal(dimensionValue(second,'FEEDBACK','FEEDBACK-A','feedback.delivery'),'FAILED','independent feedback dimension remains authoritative');
assert.equal(dimensionValue(second,'CONTROL_LOOP','LOOP-A'),'WAITING_OWNER','Run completion does not fabricate Control Loop completion');

current={canonicalRevision:1,candidate:candidate(1,'RUNNING'),projectedAt:'2026-08-20T07:59:00.000Z'};
const stale=await coordinator.reconcile();
assert.equal(stale,second,'older canonical revision cannot overwrite terminal Layer 2 truth');
assert.equal(stale.globalProjectionRevision,2);
const roadmapDimension=(kind:string,id:string,dimension:string,model=stale)=>model.entities.find((entity:any)=>entity.identity.kind===kind&&entity.identity.id===id)?.dimensions.find((field:any)=>field.dimension===dimension);
const sourceRevisionValue=(field:any):string=>{assert.ok(field);const revision=field.provenance.sourceRevision;assert.equal(revision.availability,'AVAILABLE');return revision.value;};
assert.equal(sourceRevisionValue(roadmapDimension('MILESTONE','M8','milestone.lifecycle')),'roadmap-r2','a stale Roadmap source revision cannot overwrite the newer Milestone projection');
assert.equal(sourceRevisionValue(roadmapDimension('WORK_PACKAGE','WP-A','wp.structure')),'roadmap-r2','a Roadmap revision updates the exact bound WP without creating a grouping entity');

const propagation=coordinator.plan(sourceEntityIdentity(scope,'RUN','RUN-A'));
assert.deepEqual(propagation.dependentEntities.map(item=>`${item.kind}:${item.id}`).sort(),['CONTROL_LOOP:LOOP-A','EXECUTION:EXEC-A','FEEDBACK:FEEDBACK-A','RESULT:RESULT-A','RUN:RUN-A','TASK:TASK-A','WORK_PACKAGE:WP-A','PULL_REQUEST:repo#42','MILESTONE:M8'].sort(),'only the explicit exact-bound dependency component is invalidated');
assert.equal(coordinator.plan(sourceEntityIdentity(scope,'RUN','RUN-OTHER')).dependentEntities.length,0,'unrelated Run has no dependency plan');

let releaseFirst:()=>void=()=>{};const blocked=new Promise<void>(resolve=>{releaseFirst=resolve});let reads=0;
const inFlight=createGlobalStateConsistencyCoordinator(async()=>{reads+=1;if(reads===1)await blocked;return reads===1?{canonicalRevision:2,candidate:candidate(2,'RUNNING'),projectedAt:'2026-08-20T08:02:00.000Z'}:{canonicalRevision:3,candidate:candidate(3,'COMPLETED'),projectedAt:'2026-08-20T08:03:00.000Z'};},createEmptyGlobalStateReadModel(scope));
const pending=inFlight.reconcile();const newest=inFlight.invalidate(sourceEntityIdentity(scope,'RUN','RUN-A'));releaseFirst();await Promise.all([pending,newest]);
assert.equal(reads,2,'in-flight invalidation schedules a subsequent canonical read');assert.equal(inFlight.canonicalRevision(),3);assert.equal(dimensionValue(inFlight.current(),'RUN','RUN-A'),'COMPLETED');
assert.equal(sourceRevisionValue(roadmapDimension('MILESTONE','M8','milestone.lifecycle',inFlight.current())),'roadmap-r3','rapid Roadmap revisions converge to the newest canonical source revision');

const restarted=createGlobalStateConsistencyCoordinator(async()=>({canonicalRevision:3,candidate:candidate(3,'COMPLETED'),projectedAt:'2026-08-20T08:03:00.000Z'}),createEmptyGlobalStateReadModel(scope));
const rebuilt=await restarted.reconcile();
assert.equal(rebuilt.globalProjectionRevision,1,'restart/cache-loss rebuild derives a new read-model snapshot only');
assert.deepEqual(rebuilt.entities.map(entity=>[entity.identity,entity.dimensions.map(field=>field.projectedValue)]),inFlight.current().entities.map(entity=>[entity.identity,entity.dimensions.map(field=>field.projectedValue)]),'deterministic rebuild retains Layer 1 semantic truth');

current={canonicalRevision:4,candidate:withPrOnlyChange(candidate(2,'COMPLETED'),'MERGED','pr-r4'),projectedAt:'2026-08-20T08:04:00.000Z'};
await coordinator.reconcile();
assert.equal(dimensionValue(coordinator.current(),'PULL_REQUEST','repo#42'),'MERGED','missed notification recovers through an ordinary deterministic reconciliation');
assert.equal(coordinator.current().entities.find(entity=>entity.identity.kind==='RUN')?.projectionRevision,2,'unrelated PR mutation does not mutate Run entity revision');
assert.equal(coordinator.current().entities.find(entity=>entity.identity.kind==='PULL_REQUEST')?.projectionRevision,3,'the exact PR alone advances on its canonical change');

const concurrentCandidate=(states:Readonly<Record<'A'|'B'|'C',string>>):GlobalStateProjectionCandidate=>{
  const entities:any[]=[],bindings:any[]=[];
  for(const id of ['A','B','C'] as const){
    const concurrentTask=entityIdentity(scope,'TASK',`TASK-${id}`),concurrentExecution=entityIdentity(scope,'EXECUTION',`EXEC-${id}`),concurrentRun=entityIdentity(scope,'RUN',`RUN-${id}`),sourceRevision=states[id];
    const taskSource=source('TASK',concurrentTask.id,`task-${id}-r1`),executionSource=source('EXECUTION',concurrentExecution.id,`execution-${id}-r1`),runSource=source('RUN',concurrentRun.id,`run-${id}-${sourceRevision}`);
    entities.push({identity:concurrentTask,dimensions:[dimensionProjection('task.lifecycle',knownDimensionValue('task.lifecycle',sourceRevision),taskSource)]},{identity:concurrentExecution,dimensions:[dimensionProjection('execution.lifecycle',knownDimensionValue('execution.lifecycle',sourceRevision),executionSource)]},{identity:concurrentRun,dimensions:[dimensionProjection('run.lifecycle',knownDimensionValue('run.lifecycle',sourceRevision),runSource)]});
    bindings.push(explicitBinding('TASK_TO_EXECUTION',concurrentTask,concurrentExecution,taskSource),explicitBinding('EXECUTION_TO_RUN',concurrentExecution,concurrentRun,executionSource));
  }
  return {entities,bindings};
};
let concurrent={canonicalRevision:1,candidate:concurrentCandidate({A:'RUNNING',B:'RUNNING',C:'RUNNING'})};
const concurrentCoordinator=createGlobalStateConsistencyCoordinator(async()=>concurrent,createEmptyGlobalStateReadModel(scope));
await concurrentCoordinator.reconcile();
concurrent={canonicalRevision:2,candidate:concurrentCandidate({A:'COMPLETED',B:'FAILED',C:'RUNNING'})};
await concurrentCoordinator.invalidate(sourceEntityIdentity(scope,'RUN','RUN-A'));
const concurrentModel=concurrentCoordinator.current();
assert.equal(dimensionValue(concurrentModel,'RUN','RUN-A'),'COMPLETED');assert.equal(dimensionValue(concurrentModel,'RUN','RUN-B'),'FAILED');assert.equal(dimensionValue(concurrentModel,'RUN','RUN-C'),'RUNNING','concurrent Runs remain exact-bound and isolated');
assert.equal(dimensionValue(concurrentModel,'TASK','TASK-A'),'COMPLETED');assert.equal(dimensionValue(concurrentModel,'TASK','TASK-B'),'FAILED');assert.equal(dimensionValue(concurrentModel,'TASK','TASK-C'),'RUNNING','concurrent Tasks retain their own canonical facts with no latest/selected fallback');
assert.equal(concurrentModel.entities.find(entity=>entity.identity.kind==='RUN'&&entity.identity.id==='RUN-C')?.projectionRevision,1,'unrelated concurrent Run does not receive a revision bump');
for(const entity of coordinator.current().entities)for(const field of entity.dimensions){assert.equal(field.provenance.sourceDomain,field.provenance.sourceEntity.domain);assert.ok(field.provenance.projectionRevision>0);assert.ok(field.provenance.projectedAt);}
assert.equal(CACHE_AUTHORITY,'NONE');assert.equal(POLLING_AUTHORITY,'NONE');assert.equal(NOTIFICATION_AUTHORITY,'NONE');assert.equal(STATE_RECOVERY_REEXECUTION_AUTHORITY,0);assert.equal(LAYER2_CANONICAL_WRITE,false);assert.equal(RECONCILIATION_FAILURE_INFERENCE,0);
const notifier=createLayer2ChangeNotifier();const observed:number[]=[];notifier.subscribe(change=>observed.push(change.globalProjectionRevision));assert.equal(notifier.publish(coordinator.current()),true);assert.equal(notifier.publish(coordinator.current()),false,'same Layer 2 revision does not publish a duplicate UI notification');assert.deepEqual(observed,[coordinator.current().globalProjectionRevision]);
unsubscribe();
console.log('Phase 7 global state consistency matrix passed');
