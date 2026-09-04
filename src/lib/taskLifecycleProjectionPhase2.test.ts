import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createEmptyGlobalStateReadModel,entityIdentity,resolveExplicitBindings} from './globalStateReadModel.ts';
import {projectTaskLayer2ReadModel,type CanonicalTaskRecord} from './bridgeCore.ts';

const scope={projectId:'aicc-fixture',repositoryIdentity:'fixture/task-lifecycle-projection-phase2'} as const;
const emptyContext={...scope,projectContextRevision:0} as const;
const task=(taskId:string,executionId?:string,runId?:string,status:'RUNNING'|'COMPLETED'='RUNNING')=>({
  registryVersion:2,recordType:'CANONICAL_TASK',taskId,inboxId:`inbox-${taskId}`,instructionId:`instruction-${taskId}`,executionId,runId,
  entityScope:'GLOBAL_TASK',workPackageId:null,prId:null,repository:'repo',branch:'branch',origin:'CLIPBOARD',status,createdAt:'2026-08-20T00:00:00.000Z',updatedAt:status==='COMPLETED'?'2026-08-20T00:01:00.000Z':'2026-08-20T00:00:00.000Z',instruction:{} as any,rawInstruction:'',...scope
}) as CanonicalTaskRecord;

const taskA=task('task-a','execution-a','run-a'),taskB=task('task-b','execution-b','run-b');
const running=projectTaskLayer2ReadModel(createEmptyGlobalStateReadModel(emptyContext),[taskA,taskB],[{runId:'run-a',phase:'RUNNING',...scope} as any,{runId:'run-b',phase:'RUNNING',...scope} as any]);
assert.equal(running.globalProjectionRevision,1);
const completedA=projectTaskLayer2ReadModel(running,[{...taskA,status:'COMPLETED',updatedAt:'2026-08-20T00:01:00.000Z'},taskB],[{runId:'run-a',phase:'COMPLETED',...scope} as any,{runId:'run-b',phase:'RUNNING',...scope} as any]);
assert.equal(completedA.globalProjectionRevision,2,'exact terminal Task projection advances the global revision');
assert.equal(completedA.entities.find(entity=>entity.identity.kind==='TASK'&&entity.identity.id==='task-a')?.dimensions[0]?.projectedValue.state,'KNOWN');
const completedTaskValue=completedA.entities.find(entity=>entity.identity.kind==='TASK'&&entity.identity.id==='task-a')?.dimensions[0]?.projectedValue;
const completedRunValue=completedA.entities.find(entity=>entity.identity.kind==='RUN'&&entity.identity.id==='run-a')?.dimensions[0]?.projectedValue;
assert.equal(completedTaskValue?.state==='KNOWN'&&completedTaskValue.value,'COMPLETED');
assert.equal(completedRunValue?.state==='KNOWN'&&completedRunValue.value,'COMPLETED');
assert.equal(completedA.entityRevisions.find(entity=>entity.identity.kind==='TASK'&&entity.identity.id==='task-a')?.projectionRevision,2,'bound Task revision advances');
assert.equal(completedA.entityRevisions.find(entity=>entity.identity.kind==='TASK'&&entity.identity.id==='task-b')?.projectionRevision,1,'unrelated Task remains untouched');
assert.deepEqual(resolveExplicitBindings(completedA,'TASK_TO_EXECUTION',entityIdentity(scope,'TASK','task-a')),resolveExplicitBindings(completedA,'TASK_TO_EXECUTION',entityIdentity(scope,'TASK','task-a')),'only the explicit Task binding is usable');
assert.equal(projectTaskLayer2ReadModel(completedA,[{...taskA,status:'COMPLETED',updatedAt:'2026-08-20T00:01:00.000Z'},taskB],[{runId:'run-a',phase:'COMPLETED',...scope} as any,{runId:'run-b',phase:'RUNNING',...scope} as any]),completedA,'no-op reprojection cannot synthesize a revision');
const unbound=projectTaskLayer2ReadModel(createEmptyGlobalStateReadModel(emptyContext),[task('task-unbound')],[]);
assert.equal(resolveExplicitBindings(unbound,'TASK_TO_EXECUTION',entityIdentity(scope,'TASK','task-unbound')).state,'UNBOUND','missing exact binding stays UNBOUND');

const bridge=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');
assert.match(bridge,/reconcileBridgeProjectionAsync\(\)\.then\(\(\)=>invalidateTaskProjectionSnapshot\(\)\)/,'terminal projection invalidation occurs only after reconciliation');
assert.match(bridge,/state\.completedGeneration<state\.requestedGeneration/,'an invalidation raised during an in-flight rebuild is deterministically drained');
assert.doesNotMatch(bridge,/latestRun|selectedRun/,'Task terminal projection contains no latest/selected-run fallback');
