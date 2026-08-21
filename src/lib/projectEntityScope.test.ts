import assert from 'node:assert/strict';
import {backfillProjectScope,belongsToProject,projectEntityScope,sameProjectScope,scopedEntityKey} from './projectEntityScope.ts';

const aicc={projectId:'aicc',displayName:'AICC',repositoryPath:'/fixtures/aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter',remoteOrigin:'git@github.com:beyourlovercom/aicontrolcenter.git',currentBranch:'rebuild/aicc-v2',defaultBranch:'main',roadmapPath:'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md'} as const;
const erp={projectId:'erpbeyourlovercom',displayName:'ERP',repositoryPath:'/fixtures/erp',repositoryIdentity:'beyourlovercom/erpbeyourlovercom',remoteOrigin:'git@github.com:beyourlovercom/erpbeyourlovercom.git',currentBranch:'docs/mvp',defaultBranch:'NOT_AVAILABLE',roadmapPath:'NOT_CONFIGURED'} as const;
const aiccScope=projectEntityScope(aicc),erpScope=projectEntityScope(erp);

assert.notEqual(scopedEntityKey(aiccScope,'WORK_PACKAGE','WP-001'),scopedEntityKey(erpScope,'WORK_PACKAGE','WP-001'));
assert.notEqual(scopedEntityKey(aiccScope,'PULL_REQUEST','10'),scopedEntityKey(erpScope,'PULL_REQUEST','10'));
assert.notEqual(scopedEntityKey(aiccScope,'TASK','task-1'),scopedEntityKey(erpScope,'TASK','task-1'));
assert.notEqual(scopedEntityKey(aiccScope,'EXECUTION','execution-1'),scopedEntityKey(erpScope,'EXECUTION','execution-1'));
assert.notEqual(scopedEntityKey(aiccScope,'RUN','run-1'),scopedEntityKey(erpScope,'RUN','run-1'));
assert.notEqual(scopedEntityKey(aiccScope,'RESULT','result-1'),scopedEntityKey(erpScope,'RESULT','result-1'));
assert.notEqual(scopedEntityKey(aiccScope,'FEEDBACK','feedback-1'),scopedEntityKey(erpScope,'FEEDBACK','feedback-1'));
assert.equal(sameProjectScope(aiccScope,aiccScope),true);assert.equal(sameProjectScope(aiccScope,erpScope),false);
assert.equal(belongsToProject({...aiccScope,runId:'run-1'},aiccScope),true);assert.equal(belongsToProject({...aiccScope,runId:'run-1'},erpScope),false);
assert.deepEqual(backfillProjectScope({repositoryPath:'/fixtures/aicc'},[aicc,erp]),aiccScope);
assert.deepEqual(backfillProjectScope({repositoryIdentity:'beyourlovercom/erpbeyourlovercom'},[aicc,erp]),erpScope);
assert.equal(backfillProjectScope({repositoryPath:'/unknown'},[aicc,erp]),null);
assert.equal(backfillProjectScope({},[aicc,erp]),null);
console.log('Phase 3 project entity scope identity matrix passed');
