import assert from 'node:assert/strict';
import {scopedEntityKey} from './projectEntityScope.ts';
import {buildPrNavigationSnapshot} from './prNavigationSnapshot.ts';

const aicc={projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter'};
const erp={projectId:'erpbeyourlovercom',repositoryIdentity:'beyourlovercom/erpbeyourlovercom'};
assert.notEqual(scopedEntityKey(aicc,'WORK_PACKAGE','SAME_WP'),scopedEntityKey(erp,'WORK_PACKAGE','SAME_WP'));
assert.notEqual(scopedEntityKey(aicc,'PULL_REQUEST','10'),scopedEntityKey(erp,'PULL_REQUEST','10'));
const snapshot=buildPrNavigationSnapshot([
  {repository:aicc.repositoryIdentity,prNumber:10,shortTitle:'AICC',sourceState:'OPEN'},
  {repository:erp.repositoryIdentity,prNumber:10,shortTitle:'ERP',sourceState:'OPEN'}
],null,()=>null,'2026-08-20T00:00:00.000Z');
assert.equal(snapshot.records.length,2);
assert.deepEqual(snapshot.records.map(record=>record.repository),[aicc.repositoryIdentity,erp.repositoryIdentity]);
console.log('Phase 3 Step B project-scoped WP and PR collision matrix passed');
