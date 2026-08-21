import assert from 'node:assert/strict';
import {dedupeCiEvidence,projectExactHeadValidation,type CiEvidence} from './exactHeadEvidence.ts';

const base:CiEvidence={ci_run_id:'run-1',repository:'owner/repo',pr_number:7,head_sha:'sha-a',provider:'GitHub Actions',workflow:'CI',status:'COMPLETED',conclusion:'SUCCESS',started_at:'2026-08-14T00:00:00Z'};
const older:CiEvidence={...base,ci_run_id:'run-0',head_sha:'sha-old',conclusion:'FAILURE'};
const duplicate:CiEvidence={...base};
const distinctWorkflow:CiEvidence={...base,ci_run_id:'run-2',workflow:'Lint'};

const deduped=dedupeCiEvidence([base,duplicate,distinctWorkflow,older]);
assert.equal(deduped.length,3);
assert.equal(deduped.filter(item=>item.head_sha==='sha-a').length,2);

const current=projectExactHeadValidation({repository:'owner/repo',pr_number:7,head_sha:'sha-a'},[],deduped);
assert.equal(current.ci.status,'COMPLETED');
assert.equal(current.ci.conclusion,'SUCCESS');
assert.equal(current.ci.current_for_head,true);
const advanced=projectExactHeadValidation({repository:'owner/repo',pr_number:7,head_sha:'sha-new'},[],deduped);
assert.equal(advanced.ci.status,'STALE_FOR_CURRENT_HEAD');
assert.equal(advanced.ci.current_for_head,false);
assert.equal(advanced.ci.historical,true);
const unavailable=projectExactHeadValidation({repository:'owner/repo',pr_number:7,head_sha:'sha-a'},[],[]);
assert.equal(unavailable.ci.status,'NOT_AVAILABLE');
assert.equal(unavailable.ci.conclusion,'NOT_AVAILABLE');
assert.equal(unavailable.ci.current_for_head,false);
console.log('M5 Phase 3 CI evidence tests passed');
