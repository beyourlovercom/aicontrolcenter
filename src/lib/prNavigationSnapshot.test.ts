import assert from 'node:assert/strict';
import {PR_NAVIGATION_SNAPSHOT_SCHEMA_VERSION,buildPrNavigationSnapshot,deserializePrNavigationSnapshot,filterPrNavigationSnapshotRecords,projectPrNavigationSnapshot,resolvePrLifecycleStatus,serializePrNavigationSnapshot,toPullRequestRecordLike} from './prNavigationSnapshot.ts';

const initialTime='2026-08-17T12:00:00.000Z';
const initial=buildPrNavigationSnapshot([
  {repository:'aicc/control',prNumber:12,shortTitle:'Closed',sourceState:'CLOSED'},
  {repository:'aicc/control',prNumber:2,shortTitle:'Merged',sourceState:'MERGED',title:'Merged full title'},
  {repository:'aicc/control',prNumber:7,shortTitle:'Draft',sourceState:'DRAFT'},
  {repository:'aicc/control',prNumber:8,shortTitle:'Blocked',sourceState:'OPEN',explicitBlockingFact:true},
  {repository:'aicc/control',prNumber:9,shortTitle:'Open',sourceState:'OPEN'}
],null,input=>input.prNumber===2||input.prNumber===9?'AICC-M6.2-REAL-DELIVERY-CANARY-001':null,initialTime);

assert.equal(initial.schema_version,PR_NAVIGATION_SNAPSHOT_SCHEMA_VERSION,'V1 envelope schema is persisted');
assert.equal(initial.snapshot_version,1,'the first accepted snapshot starts at version one');
assert.deepEqual(initial.records.map(record=>record.prNumber),[2,7,8,9,12],'records use stable ascending PR-number order');
assert.equal(initial.records[0]?.lifecycleStatus,'COMPLETE','merged PR becomes complete');
assert.equal(initial.records[1]?.lifecycleStatus,'IN_PROGRESS','draft PR remains in progress');
assert.equal(initial.records[2]?.lifecycleStatus,'BLOCKED','explicit blocking fact becomes blocked');
assert.equal(initial.records[3]?.lifecycleStatus,'IN_PROGRESS','open PR remains in progress');
assert.equal(initial.records[4]?.lifecycleStatus,'BLOCKED','closed unmerged PR is blocked');
assert.equal(initial.records[1]?.mappingStatus,'UNMAPPED','unmapped is separate lifecycle metadata');
assert.equal(initial.records[0]?.mappingStatus,'MAPPED','exact mapping remains mapped');
assert.equal(initial.records[3]?.parentWpId,'AICC-M6.2-REAL-DELIVERY-CANARY-001','PR #9 exact mapping is preserved');
assert.equal(Object.hasOwn(initial.records[0]??{},'progress'),false,'new snapshots do not write percentage progress');

const refreshed=buildPrNavigationSnapshot([{repository:'aicc/control',prNumber:2,shortTitle:'Merged',sourceState:'MERGED'}],initial,()=>undefined,'2026-08-17T12:01:00.000Z');
assert.equal(refreshed.records[0]?.lifecycleStatus,'COMPLETE','merged status remains complete after refresh');
assert.equal(refreshed.records[0]?.parentWpId,'AICC-M6.2-REAL-DELIVERY-CANARY-001','undefined resolver result preserves explicit prior mapping');
assert.deepEqual(filterPrNavigationSnapshotRecords(initial.records,'IN_PROGRESS').map(record=>record.prNumber),[7,9],'in-progress filter uses persisted lifecycle status');
assert.deepEqual(filterPrNavigationSnapshotRecords(initial.records,'BLOCKED').map(record=>record.prNumber),[8,12],'blocked filter uses persisted lifecycle status');
assert.deepEqual(filterPrNavigationSnapshotRecords(initial.records,'COMPLETE').map(record=>record.prNumber),[2],'complete filter uses persisted lifecycle status');
assert.deepEqual(filterPrNavigationSnapshotRecords(initial.records,'UNMAPPED').map(record=>record.prNumber),[7,8,12],'unmapped filter uses persisted mapping status');
assert.deepEqual(projectPrNavigationSnapshot(initial,'COMPLETE').map(record=>record.prNumber),[2],'snapshot projection reads stored lifecycle state only');

const serialized=serializePrNavigationSnapshot(initial),roundTrip=deserializePrNavigationSnapshot(JSON.parse(serialized));
assert.deepEqual(roundTrip,initial,'serialized snapshots round-trip through strict validation');
assert.equal(toPullRequestRecordLike(initial.records[0]!).status,'COMPLETE','legacy adapter uses persisted lifecycle status');
assert.equal(deserializePrNavigationSnapshot({...initial,snapshot_version:0}),null,'non-positive snapshot versions are rejected');
assert.equal(deserializePrNavigationSnapshot({...initial,records:[{...initial.records[0]!,lifecycleStatus:'UNKNOWN'}]}),null,'unknown lifecycle status is rejected');
assert.equal(resolvePrLifecycleStatus({sourceState:'MERGED'}),'COMPLETE','MERGED_TO_COMPLETE');
assert.equal(resolvePrLifecycleStatus({sourceState:'OPEN'}),'IN_PROGRESS','OPEN_TO_IN_PROGRESS');
assert.equal(resolvePrLifecycleStatus({sourceState:'DRAFT'}),'IN_PROGRESS','DRAFT_TO_IN_PROGRESS');
assert.equal(resolvePrLifecycleStatus({sourceState:'CLOSED'}),'BLOCKED','CLOSED_UNMERGED_TO_BLOCKED');
assert.equal(resolvePrLifecycleStatus({sourceState:'OPEN',explicitBlockingFact:true}),'BLOCKED','EXPLICIT_BLOCKER_TO_BLOCKED');

console.log('PR lifecycle status snapshot matrix passed');
