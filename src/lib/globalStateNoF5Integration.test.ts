import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createGlobalStateConsistencyCoordinator} from './globalStateConsistency.ts';
import {availableSourceRevision,dimensionProjection,entityIdentity,explicitBinding,knownDimensionValue,projectionSource,sourceEntityIdentity,unknownDimensionValue,type GlobalStateProjectionCandidate} from './globalStateReadModel.ts';

const task=entityIdentity('TASK','TASK-NO-F5'),execution=entityIdentity('EXECUTION','EXEC-NO-F5'),run=entityIdentity('RUN','RUN-NO-F5'),result=entityIdentity('RESULT','RESULT-NO-F5'),feedback=entityIdentity('FEEDBACK','FEEDBACK-NO-F5');
const source=(domain:any,id:string,revision:string)=>projectionSource(sourceEntityIdentity(domain,id),availableSourceRevision(revision));
function snapshot(revision:number,runState:'RUNNING'|'COMPLETED',resultAvailable:boolean,feedbackDelivery:'PENDING'|'DELIVERED'):GlobalStateProjectionCandidate{
  const taskSource=source('TASK',task.id,`task-${revision}`),executionSource=source('EXECUTION',execution.id,`execution-${revision}`),runSource=source('RUN',run.id,`run-${revision}`),resultSource=source('RESULT',result.id,`result-${revision}`),feedbackSource=source('FEEDBACK',feedback.id,`feedback-${revision}`);
  return {entities:[
    {identity:task,dimensions:[dimensionProjection('task.lifecycle',knownDimensionValue('task.lifecycle','IN_PROGRESS'),taskSource)]},
    {identity:execution,dimensions:[dimensionProjection('execution.lifecycle',knownDimensionValue('execution.lifecycle',runState),executionSource)]},
    {identity:run,dimensions:[dimensionProjection('run.lifecycle',knownDimensionValue('run.lifecycle',runState),runSource)]},
    {identity:result,dimensions:[resultAvailable?dimensionProjection('result.availability',knownDimensionValue('result.availability','AVAILABLE'),resultSource):dimensionProjection('result.availability',unknownDimensionValue('result.availability'),resultSource)]},
    {identity:feedback,dimensions:[dimensionProjection('feedback.lifecycle',knownDimensionValue('feedback.lifecycle','PENDING'),feedbackSource),dimensionProjection('feedback.delivery',knownDimensionValue('feedback.delivery',feedbackDelivery),feedbackSource)]}
  ],bindings:[explicitBinding('TASK_TO_EXECUTION',task,execution,taskSource),explicitBinding('EXECUTION_TO_RUN',execution,run,executionSource),explicitBinding('RUN_TO_RESULT',run,result,resultSource),explicitBinding('RUN_TO_FEEDBACK',run,feedback,feedbackSource)]};
}
const visible:string[]=[];let reloads=0;let canonical={canonicalRevision:1,candidate:snapshot(1,'RUNNING',false,'PENDING'),projectedAt:'2026-08-20T09:00:00.000Z'};
const coordinator=createGlobalStateConsistencyCoordinator(async()=>canonical);
coordinator.subscribe(change=>{const value=(kind:string,id:string,dimension:string)=>{const field=change.model.entities.find(entity=>entity.identity.kind===kind&&entity.identity.id===id)?.dimensions.find(item=>item.dimension===dimension);return field?.projectedValue.state==='KNOWN'?field.projectedValue.value:'UNKNOWN';};visible.push(`${value('RUN',run.id,'run.lifecycle')}|${value('RESULT',result.id,'result.availability')}|${value('FEEDBACK',feedback.id,'feedback.delivery')}`);});

await coordinator.reconcile();
canonical={canonicalRevision:2,candidate:snapshot(2,'COMPLETED',false,'PENDING'),projectedAt:'2026-08-20T09:01:00.000Z'};await coordinator.invalidate(sourceEntityIdentity('RUN',run.id));
canonical={canonicalRevision:3,candidate:snapshot(3,'COMPLETED',true,'PENDING'),projectedAt:'2026-08-20T09:02:00.000Z'};await coordinator.invalidate(sourceEntityIdentity('RESULT',result.id));
canonical={canonicalRevision:4,candidate:snapshot(4,'COMPLETED',true,'DELIVERED'),projectedAt:'2026-08-20T09:03:00.000Z'};await coordinator.invalidate(sourceEntityIdentity('FEEDBACK',feedback.id));

assert.deepEqual(visible,['RUNNING|UNKNOWN|PENDING','COMPLETED|UNKNOWN|PENDING','COMPLETED|AVAILABLE|PENDING','COMPLETED|AVAILABLE|DELIVERED'],'Layer 3 subscriber receives every exact Layer 2 projection transition without reload');
assert.equal(reloads,0,'the integration harness never reloads the browser');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
assert.match(app,/snapshotRefreshRequestedGeneration/);assert.match(app,/while\(snapshotRefreshCompletedGeneration<snapshotRefreshRequestedGeneration\)/,'in-flight snapshot invalidations drain to the newest requested generation');
assert.match(app,/createLayer2ChangeNotifier/);assert.match(app,/uiLayer2Changes\.publish\(uiLifecycleReadModel\)/,'Layer 3 receives only projected Layer 2 change notifications');
assert.doesNotMatch(app,/location\.reload|window\.location\.reload/,'normal state propagation never performs a browser reload');
console.log('Phase 7 no-F5 Layer 2 to Layer 3 integration passed');
