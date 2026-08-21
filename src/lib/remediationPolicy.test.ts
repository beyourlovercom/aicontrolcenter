import {strict as assert} from 'node:assert';import {evaluateRemediation} from './remediationPolicy.ts';
const build=evaluateRemediation({execution_id:'e1',work_package_id:'wp',message:'TypeScript error',category:'TYPE_ERROR',retry_count:0});assert.equal(build.classification.category,'TYPE_ERROR');assert.equal(build.recommended_action,'REMEDIATE');
const limited=evaluateRemediation({execution_id:'e2',work_package_id:'wp',category:'TEST_FAILURE',retry_count:2});assert.equal(limited.recommended_action,'BLOCKED');
const unknown=evaluateRemediation({execution_id:'e3',work_package_id:'wp',category:'UNKNOWN_FAILURE',retryable:false});assert.equal(unknown.recommended_action,'BLOCKED');
const next=evaluateRemediation({execution_id:'e4',work_package_id:'wp',category:'BUILD_FAILURE',new_head:'HEAD-2'});assert.equal(next.review_revalidation,'TRIGGERED');assert.equal(next.ci_revalidation,'TRIGGERED');console.log('remediation policy matrix passed');
