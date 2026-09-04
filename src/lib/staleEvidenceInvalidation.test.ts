import assert from 'node:assert/strict';
import {projectExactHeadValidation,type CiEvidence,type ReviewEvidence} from './exactHeadEvidence.ts';
import {createProjectSnapshot,LOCAL_DEMO_PR} from './model/projectModel.ts';
import {resolveEntityContext} from './context/entityContext.ts';
import {resolvePrTabView} from './context/prTabContent.ts';

const review=(repository:string,head_sha:string,review_id:string):ReviewEvidence=>({review_id,repository,pr_number:8,head_sha,reviewer:'owner',review_provider:'provider',review_status:'PASS',review_summary:'approved',reviewed_at:'2026-08-14T00:00:00Z'});
const ci=(repository:string,head_sha:string,ci_run_id:string):CiEvidence=>({ci_run_id,repository,pr_number:8,head_sha,provider:'GitHub Actions',workflow:'CI',status:'COMPLETED',conclusion:'SUCCESS',started_at:'2026-08-14T00:00:00Z'});
const reviews=[review('repo-a','SHA_A','review-a'),review('repo-a','SHA_B','review-b'),review('repo-b','SHA_A','review-other')];
const ciRuns=[ci('repo-a','SHA_A','ci-a'),ci('repo-a','SHA_B','ci-b'),ci('repo-b','SHA_A','ci-other')];

const atA=projectExactHeadValidation({repository:'repo-a',pr_number:8,head_sha:'SHA_A'},reviews,ciRuns);
assert.equal(atA.review.current_for_head,true);
assert.equal(atA.ci.current_for_head,true);
assert.equal(atA.review.status,'PASS');
assert.equal(atA.ci.status,'COMPLETED');

const atB=projectExactHeadValidation({repository:'repo-a',pr_number:8,head_sha:'SHA_B'},[reviews[0]],[ciRuns[0]]);
assert.equal(atB.review.current_for_head,false);
assert.equal(atB.review.status,'STALE_FOR_CURRENT_HEAD');
assert.equal(atB.ci.current_for_head,false);
assert.equal(atB.ci.status,'STALE_FOR_CURRENT_HEAD');
assert.equal(atB.review.history.length,1);
assert.equal(atB.ci.history.length,1);

const reviewAfterRace=projectExactHeadValidation({repository:'repo-a',pr_number:8,head_sha:'SHA_B'},[review('repo-a','SHA_A','review-race')],[]);
const ciAfterRace=projectExactHeadValidation({repository:'repo-a',pr_number:8,head_sha:'SHA_B'},[],[ci('repo-a','SHA_A','ci-race')]);
assert.equal(reviewAfterRace.review.status,'STALE_FOR_CURRENT_HEAD');
assert.equal(ciAfterRace.ci.status,'STALE_FOR_CURRENT_HEAD');

const partial=projectExactHeadValidation({repository:'repo-a',pr_number:8,head_sha:'SHA_B'},[review('repo-a','SHA_B','review-current'),review('repo-a','SHA_A','review-old')],[ci('repo-a','SHA_A','ci-old')]);
assert.equal(partial.review.current_for_head,true);
assert.equal(partial.ci.current_for_head,false);
assert.equal(partial.ci.status,'STALE_FOR_CURRENT_HEAD');

const forcePush=projectExactHeadValidation({repository:'repo-a',pr_number:8,head_sha:'SHA_X'},[review('repo-a','SHA_A','review-force')],[ci('repo-a','SHA_A','ci-force')]);
assert.equal(forcePush.review.status,'STALE_FOR_CURRENT_HEAD');
assert.equal(forcePush.ci.status,'STALE_FOR_CURRENT_HEAD');
assert.equal(forcePush.review.history[0].head_sha,'SHA_A');
assert.equal(forcePush.ci.history[0].head_sha,'SHA_A');

const noFallback=projectExactHeadValidation({repository:'repo-a',pr_number:8,head_sha:'SHA_NEW'},[review('repo-a','SHA_A','old')],[ci('repo-a','SHA_A','old-ci')]);
assert.equal(noFallback.review.evidence_head_sha,'SHA_A');
assert.equal(noFallback.review.current_for_head,false);
assert.equal(noFallback.ci.evidence_head_sha,'SHA_A');
assert.equal(noFallback.ci.current_for_head,false);
assert.equal(noFallback.review.history.length,1);
assert.equal(noFallback.ci.history.length,1);

const pr={...LOCAL_DEMO_PR,id:'pr-stale',fixture:false,number:8,repository:'repo-a',headSha:'SHA_NEW',workPackageId:'AICC-V2-REVIEW-EXACT-HEAD-CI-001'};
const context=resolveEntityContext(createProjectSnapshot({pullRequests:[pr],reviewEvidence:[review('repo-a','SHA_A','ui-review')],ciEvidence:[ci('repo-a','SHA_A','ui-ci')]}),{type:'pull_request',id:pr.id});
if(context.type==='pull_request'){
 assert.equal(resolvePrTabView(context,'Review').rows.find(row=>row[0]==='Head match')?.[1],'HISTORICAL_FOR_OLDER_HEAD');
 assert.equal(resolvePrTabView(context,'CI').rows.find(row=>row[0]==='Head match')?.[1],'HISTORICAL_FOR_OLDER_HEAD');
}

console.log('M5 Phase 4 stale evidence invalidation matrix passed');
