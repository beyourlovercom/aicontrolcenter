import assert from 'node:assert/strict';
import {buildTaskProjection,isTaskProjection,TASK_PROJECTION_CACHE_KEY,TASK_PROJECTION_SCHEMA_VERSION} from './taskProjection.ts';

const task={taskId:'task-1',instructionId:'instruction-1',executionId:'run-1',runId:'run-1',status:'COMPLETED',createdAt:'2026-01-01T00:00:00.000Z',updatedAt:'2026-01-01T00:01:00.000Z'} as any;
const result={version:'AICC_EXECUTION_RESULT_V1',executionId:'run-1',aiccStatus:'RESULT_RECEIVED',rawResult:'ok',receivedAt:'2026-01-01T00:01:00.000Z',resultId:'result-run-1',resultHash:'hash'} as any;
const projection=buildTaskProjection({items:[task],legacy:[]},[{runId:'run-1',phase:'COMPLETED',canonicalResult:result} as any]);
assert.equal(projection.schemaVersion,TASK_PROJECTION_SCHEMA_VERSION);
assert.equal(TASK_PROJECTION_CACHE_KEY,'aicc.task.snapshot.v1');
assert.equal(projection.items[0].resultId,'result-run-1');
assert.equal(projection.items[0].resultHash,'hash');
assert.equal(isTaskProjection(projection),true);
assert.equal(isTaskProjection({...projection,schemaVersion:'wrong'}),false);
console.log('task projection contract tests passed');
