import assert from 'node:assert/strict';
import {GLOBAL_STATE_PROJECT_QUERY_AUTHORITY,queryProjectScopedEntities} from './projectScopedGlobalStateQuery.ts';

const aicc={projectId:'aicc',displayName:'AICC',repositoryPath:'/aicc',repositoryIdentity:'org/aicc',remoteOrigin:'git@github.com:org/aicc.git',currentBranch:'main',defaultBranch:'main',roadmapPath:'roadmap'} as const;
const erp={projectId:'erp',displayName:'ERP',repositoryPath:'/erp',repositoryIdentity:'org/erp',remoteOrigin:'git@github.com:org/erp.git',currentBranch:'main',defaultBranch:'main',roadmapPath:'NOT_CONFIGURED'} as const;
const records=[{kind:'WP',id:'SAME',repositoryPath:'/aicc'},{kind:'WP',id:'SAME',repositoryPath:'/erp'},{kind:'PR',id:'10',repository:'org/aicc'},{kind:'PR',id:'10',repository:'org/erp'},{kind:'TASK',id:'SAME',projectId:'aicc',repositoryIdentity:'org/aicc'},{kind:'TASK',id:'SAME',projectId:'erp',repositoryIdentity:'org/erp'}];
assert.equal(GLOBAL_STATE_PROJECT_QUERY_AUTHORITY,'PROJECT_SCOPED_CANONICAL_READ_MODEL_QUERY_V1');
assert.deepEqual(queryProjectScopedEntities(aicc,records,[aicc,erp]).map(record=>`${record.kind}:${record.id}`),['WP:SAME','PR:10','TASK:SAME']);
assert.deepEqual(queryProjectScopedEntities(erp,records,[aicc,erp]).map(record=>`${record.kind}:${record.id}`),['WP:SAME','PR:10','TASK:SAME']);
console.log('Phase 3 project-scoped Global State query matrix passed');
