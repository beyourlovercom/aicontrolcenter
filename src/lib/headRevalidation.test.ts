import assert from 'node:assert/strict';
import {continueAfterReview,projectHeadRevalidation,reconcileDeliveryHead,type HeadRevalidationStore} from './headRevalidation.ts';
const store:HeadRevalidationStore={events:[],reviews:{executions:[],reviews:[]},cI:{executions:[],ci:[]}};
assert.equal(reconcileDeliveryHead({deliveryContextId:'dc',repository:'org/repo',prNumber:8,previousHeadSha:'A',currentHeadSha:'A',reviewProvider:'bot',ciProvider:'actions'},store),null);
const event=reconcileDeliveryHead({deliveryContextId:'dc',repository:'org/repo',prNumber:8,previousHeadSha:'A',currentHeadSha:'B',reviewProvider:'bot',ciProvider:'actions'},store)!;assert.equal(event.old_head_sha,'A');assert.equal(event.new_head_sha,'B');assert.equal(store.reviews.executions[0].head_sha,'B');
assert.equal(reconcileDeliveryHead({deliveryContextId:'dc',repository:'org/repo',prNumber:8,previousHeadSha:'A',currentHeadSha:'B',reviewProvider:'bot',ciProvider:'actions'},store)?.head_change_event_id,event.head_change_event_id);assert.equal(store.reviews.executions.length,1);
assert.equal(continueAfterReview(event,'FAILED',store),null);const ci=continueAfterReview(event,'COMPLETED',store)!;assert.equal(ci.head_sha,'B');assert.equal(projectHeadRevalidation(event,[{review_id:'old',repository:'org/repo',pr_number:8,head_sha:'A',reviewer:'bot',review_provider:'bot',review_status:'PASS',review_summary:'old',reviewed_at:'now'}],[])?.review.status,'STALE_FOR_CURRENT_HEAD');
console.log('head revalidation matrix passed');
