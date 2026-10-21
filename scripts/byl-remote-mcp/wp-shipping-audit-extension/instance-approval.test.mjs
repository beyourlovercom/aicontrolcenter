import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEV_A5_KEY,A5_VERSION,MAX_AGE_MS,newDevReceipt,
  isDevReceiptAwaitingOwner,ownerApproveDevReceipt,hasFreshOwnerDevApproval
} from './instance-approval.mjs';

const at=Date.parse('2026-10-21T04:00:00.000Z');
const sha='a'.repeat(64);
test('a nine-instance Dev export does not self-authorize WWW',()=>{
  const record=newDevReceipt(sha,'2026-10-21T03:59:00.000Z');
  assert.equal(DEV_A5_KEY,'bylWpShippingA5OwnerGateV2');
  assert.equal(record.version,A5_VERSION);
  assert.equal(record.ownerApprovedAt,null);
  assert.equal(record.instanceCount,9);
  assert.equal(hasFreshOwnerDevApproval(record,at),false);
  assert.equal(isDevReceiptAwaitingOwner(record,at),true);
});
test('Owner must separately approve the exact pending versioned receipt',()=>{
  const pending=newDevReceipt(sha,'2026-10-21T03:58:00.000Z');
  const confirmed=ownerApproveDevReceipt(pending,at);
  assert.ok(confirmed);
  assert.equal(confirmed.ownerApprovedAt,'2026-10-21T04:00:00.000Z');
  assert.equal(hasFreshOwnerDevApproval(confirmed,at),true);
  assert.equal(ownerApproveDevReceipt(confirmed,at),null);
});
test('expiry: prior Dev export or stale Owner PASS never unlocks WWW',()=>{
  const now=Date.parse('2026-10-23T05:00:00Z');
  const pending=newDevReceipt(sha,'2026-10-21T03:59:00.000Z');
  assert.equal(isDevReceiptAwaitingOwner(pending,now),false);
  assert.equal(ownerApproveDevReceipt(pending,now),null);
  const approved=ownerApproveDevReceipt(pending,at);
  assert.equal(hasFreshOwnerDevApproval(approved,now),false);
  assert.ok(MAX_AGE_MS<=48*3600*1000);
});
test('fail closed for wrong version, hashes, counts, timestamps and forged approval',()=>{
  const confirmed=ownerApproveDevReceipt(newDevReceipt(sha,
    '2026-10-21T03:58:00.000Z'),at);
  const bad=[
    {...confirmed,version:'0.1.0'},
    {...confirmed,sha256:'SECRET'},
    {...confirmed,instanceCount:8},
    {...confirmed,observedAt:'not-a-date'},
    {...confirmed,ownerApprovedAt:'not-a-date'},
    {...confirmed,ownerApprovedAt:null},
    {...confirmed,ownerApprovedAt:'2026-10-21T03:57:00Z'},
    {...confirmed,ownerApprovedAt:'2026-10-22T00:00:00Z'},
    null,{},true
  ];
  for(const sample of bad)assert.equal(hasFreshOwnerDevApproval(sample,at),false);
});
test('new receipt rejects malformed SHA/time; does not store unredacted payload',()=>{
  assert.equal(newDevReceipt('bad','2026-10-21T04:00:00Z'),null);
  assert.equal(newDevReceipt(sha,'invalid'),null);
  const snapshot=newDevReceipt(sha,'2026-10-21T04:00:00Z');
  assert.deepEqual(Object.keys(snapshot).sort(),
    ['version','sha256','observedAt','instanceCount','ownerApprovedAt'].sort());
});
