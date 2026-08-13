import assert from 'node:assert/strict';
import {scopeInboxToEntity,scopeOutboxToWorkPackage,scopeRunsToWorkPackage} from './entityScope.ts';

const inbox=[
  {id:'a',instruction:{workPackageId:'WP-A',entityType:'WORK_PACKAGE',entityId:'WP-A'}},
  {id:'b',instruction:{workPackageId:'WP-B',entityType:'WORK_PACKAGE',entityId:'WP-B'}},
  {id:'pr-a',instruction:{entityType:'PULL_REQUEST',entityId:'PR-A'}},
  {id:'raw',instruction:{}}
];
assert.deepEqual(scopeInboxToEntity(inbox,{type:'work_package',id:'WP-A'}).map(item=>item.id),['a']);
assert.deepEqual(scopeInboxToEntity(inbox,{type:'work_package',id:'WP-B'}).map(item=>item.id),['b']);
assert.deepEqual(scopeInboxToEntity(inbox,{type:'pull_request',id:'PR-A'}).map(item=>item.id),['pr-a']);
assert.deepEqual(scopeInboxToEntity(inbox,{type:'pull_request',id:'PR-B'}),[]);
assert.deepEqual(scopeInboxToEntity(inbox,{type:'milestone',id:'M1'}),[]);
assert.deepEqual(scopeRunsToWorkPackage([{runId:'run-a',workPackageId:'WP-A'},{runId:'run-b',workPackageId:'WP-B'}],'WP-A').map(item=>item.runId),['run-a']);
assert.deepEqual(scopeOutboxToWorkPackage([{id:'report-a',report:{workPackageId:'WP-A'}},{id:'report-b',report:{workPackageId:'WP-B'}}],'WP-A').map(item=>item.id),['report-a']);
console.log('entity scope isolation tests passed');
