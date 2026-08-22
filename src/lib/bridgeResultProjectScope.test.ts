import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {buildTaskProjection} from './taskProjection.ts';
import {projectTaskLayer2ReadModel} from './taskCanonicalProjection.ts';
import {createEmptyGlobalStateReadModel} from './globalStateReadModel.ts';

const root=process.cwd();
const bridge=readFileSync(join(root,'src/lib/bridgeCore.ts'),'utf8');
const runtimeManager=readFileSync(join(root,'src/lib/runtimeManager.ts'),'utf8');

const scopeA={projectId:'project-a',repositoryIdentity:'repo/a',projectContextRevision:1} as const;
const scopeB={projectId:'project-b',repositoryIdentity:'repo/b',projectContextRevision:1} as const;
const runId='shared-result-run';
const taskA={taskId:'task-a',inboxId:'inbox-a',instructionId:'instruction-a',executionId:runId,runId,entityScope:'GLOBAL_TASK',workPackageId:null,prId:null,repository:'/repo/a',branch:'main',origin:'TEST',status:'RUNNING',createdAt:'now',updatedAt:'now',instruction:{} as any,rawInstruction:'test',projectId:scopeA.projectId,repositoryIdentity:scopeA.repositoryIdentity} as any;
const resultB={version:'AICC_EXECUTION_RESULT_V1',executionId:runId,projectId:scopeB.projectId,repositoryIdentity:scopeB.repositoryIdentity,rawResult:'B_RESULT',receivedAt:'now',resultId:'result-b',resultHash:'hash-b'} as any;
const runtimeB={runId,projectId:scopeB.projectId,repositoryIdentity:scopeB.repositoryIdentity,phase:'COMPLETED',canonicalResult:resultB} as any;
const runtimeA={runId,projectId:scopeA.projectId,repositoryIdentity:scopeA.repositoryIdentity,phase:'RUNNING'} as any;

const projection=buildTaskProjection({items:[taskA],legacy:[]},[runtimeB,runtimeA]);
assert.equal(projection.items[0]?.canonicalResult,null,'project A task cannot inherit project B result for the same raw runId');
assert.equal(projection.items[0]?.runtimeStatus,'RUNNING','project A task resolves only the same-scope runtime');

const layer2=projectTaskLayer2ReadModel(createEmptyGlobalStateReadModel(scopeA),[taskA],[runtimeB,runtimeA]);
const runEntity=layer2.entities.find((entity:any)=>entity.identity.kind==='RUN'&&entity.identity.id===runId);const runLifecycle=runEntity?.dimensions.find((dimension:any)=>dimension.dimension==='run.lifecycle');assert.equal(runLifecycle?.projectedValue?.value,'RUNNING','Layer 2 run lifecycle ignores foreign-project same-runId evidence');

assert.match(bridge,/runtimeKey=.*projectId.*repositoryIdentity.*runId/,'bridge reconciliation indexes runtime by project scope plus runId');
assert.match(bridge,/snapshotRuntime\?\.runId===item\.runId&&sameScope\(snapshotRuntime\)/,'snapshot runtime must match inbox project scope');
assert.match(bridge,/sameScope\(x\).*x\.executionId===item\.executionId&&x\.runId===item\.runId/,'outbox deduplication is project scoped');
assert.match(bridge,/notification\.runId===item\.runId&&notification\.projectId===item\.projectId&&notification\.repositoryIdentity===item\.repositoryIdentity/,'terminal notification deduplication is project scoped');
assert.match(runtimeManager,/if\(projectScope&&!runtimeBelongsToProject\(item,projectScope\)\)return false/,'synchronous runtime reader applies supplied project scope');

console.log('bridge result project scope regression passed');
