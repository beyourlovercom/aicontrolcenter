import assert from 'node:assert/strict';
import {createMemoryDeliveryContextRecordStore} from './deliveryContextPersistence.ts';
import {discoverExistingDeliveryArtifact,importExistingDeliveryArtifact} from './existingDeliveryArtifactImport.ts';

const store=createMemoryDeliveryContextRecordStore();
const artifact=discoverExistingDeliveryArtifact({repository:'beyourlovercom/aicontrolcenter',branch:'delivery/aicc-m6.2-real-delivery-canary-001',worktreePath:'/private/tmp/aicc-m6.2-canary.Uf8wc7',prNumber:9,prRepository:'beyourlovercom/aicontrolcenter',prUrl:'https://github.com/beyourlovercom/aicontrolcenter/pull/9',prState:'OPEN',baseBranch:'rebuild/aicc-v2',providerId:'codex',workPackageId:'AICC-M6.2-REAL-DELIVERY-CANARY-001',executionId:'exec-import-1',gitHead:'2f9cc9405c77809d49982ecfc9cbcdb4b822268f'});
const first=importExistingDeliveryArtifact(artifact,store);assert.equal(first.reused,false);assert.equal(first.record.pr_number,9);assert.equal(first.record.commit_sha,'2f9cc9405c77809d49982ecfc9cbcdb4b822268f');assert.equal(first.record.delivery_branch,artifact.branch);assert.equal(first.record.head_sha,first.record.pr_head_sha);assert.equal(first.executionBinding.delivery_context_id,first.record.delivery_context_id);
const second=importExistingDeliveryArtifact({...artifact,executionId:'exec-import-2'},store);assert.equal(second.reused,true);assert.equal(second.record.delivery_context_id,first.record.delivery_context_id);assert.equal(store.findByWorkPackage(artifact.workPackageId)?.execution_id,'exec-import-1');
assert.throws(()=>importExistingDeliveryArtifact({...artifact,commitSha:'stale'},store),/DELIVERY_CONTEXT_IDENTITY_MISMATCH/);
console.log('existing delivery artifact import matrix passed');
