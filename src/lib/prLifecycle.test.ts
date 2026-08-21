import assert from 'node:assert/strict';
import {currentPrLifecycle,readyForOwnerUat,transitionPrLifecycle,type PrLifecycleStore} from './prLifecycle.ts';
const store:PrLifecycleStore={history:[]};
for(const state of ['DRAFT','REVIEW_RUNNING','REVIEW_COMPLETE','CI_RUNNING','CI_COMPLETE'] as const)assert.ok(transitionPrLifecycle(store,{state,sourceEvent:state,deliveryContextId:'dc'}));
assert.equal(transitionPrLifecycle(store,{state:'CI_COMPLETE',sourceEvent:'CI_COMPLETE',deliveryContextId:'dc'})?.source_event,'CI_COMPLETE');assert.equal(store.history.length,5);
assert.ok(transitionPrLifecycle(store,{state:'REMEDIATION_RUNNING',sourceEvent:'CI_FAILED',deliveryContextId:'dc'}));assert.ok(transitionPrLifecycle(store,{state:'REVALIDATING',sourceEvent:'REMEDIATION_COMPLETE',deliveryContextId:'dc'}));assert.equal(currentPrLifecycle(store),'REVALIDATING');
const review={review_id:'r',repository:'org/repo',pr_number:1,head_sha:'B',reviewer:'bot',review_provider:'bot',review_status:'PASS' as const,review_summary:'ok',reviewed_at:'now'};const ci={ci_run_id:'c',repository:'org/repo',pr_number:1,head_sha:'B',provider:'actions',workflow:'checks',status:'COMPLETED',conclusion:'SUCCESS',started_at:'now'};
assert.equal(readyForOwnerUat({repository:'org/repo',prNumber:1,currentHead:'A',reviews:[review],ci:[ci],reviewStatus:'PASS',ciConclusion:'SUCCESS'}),false);assert.equal(readyForOwnerUat({repository:'org/repo',prNumber:1,currentHead:'B',reviews:[review],ci:[ci],reviewStatus:'PASS',ciConclusion:'SUCCESS'}),true);
console.log('PR lifecycle progression matrix passed');
