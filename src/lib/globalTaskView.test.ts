import assert from 'node:assert/strict';
import {buildGlobalTaskGroups} from './globalTaskView.ts';

const groups=buildGlobalTaskGroups([
  {id:'running',state:'RUNNING',runId:'run-a',instruction:{workPackageId:'WP-A',title:'A'}},
  {id:'ready',state:'READY',instruction:{workPackageId:'WP-B',title:'B'}},
  {id:'failed',state:'FAILED',instruction:{workPackageId:'WP-A',title:'C'}},
  {id:'done',state:'COMPLETED',runId:'run-b',instruction:{workPackageId:'WP-B',title:'D'}},
  {id:'raw',state:'READY',instruction:{title:'raw'}}
]);
assert.equal(groups.inProgress[0].workPackageId,'WP-A');
assert.equal(groups.waitingOwner[0].workPackageId,'WP-B');
assert.equal(groups.needsAction[0].state,'FAILED');
assert.equal(groups.recentCompleted[0].runId,'run-b');
assert.equal(groups.waitingOwner[1].scope,'UNKNOWN');
assert.equal(Object.keys(groups).length,4);
assert.equal(groups.inProgress[0].entity?.id,'WP-A');
console.log('global task view tests passed');
