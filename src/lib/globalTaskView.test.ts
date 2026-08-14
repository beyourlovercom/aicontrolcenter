import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
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
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const globalPr=readFileSync(new URL('../components/GlobalPrWorkspace.svelte',import.meta.url),'utf8');
const nav=readFileSync(new URL('../components/GlobalTaskView.svelte',import.meta.url),'utf8');
assert.match(nav,/全局 PR#/,'global PR navigation entry');
assert.match(app,/GlobalPrWorkspace/,'global PR workspace is connected to the center');
assert.match(globalPr,/PR #\{record\.number/,'global PR rows expose repository PR numbers');
console.log('global task view tests passed');
