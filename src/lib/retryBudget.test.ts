import assert from 'node:assert/strict';
import {createRetryPolicy,requestRetry,stopForMissingIdentity,type RetryStore} from './retryBudget.ts';
const store:RetryStore={policies:[],ownerRequired:[]};const policy=createRetryPolicy({policyId:'p1',deliveryContextId:'dc',maxAttempts:2,scope:'CI'});store.policies.push(policy);
assert.equal(requestRetry(policy,'run-1',store).attempt,1);assert.equal(requestRetry(policy,'run-2',store).attempt,2);const stopped=requestRetry(policy,'run-3',store);assert.equal(stopped.allowed,false);assert.match(stopped.ownerRequired!.owner_action_reason,/exhausted/);assert.equal(requestRetry(policy,'run-3',store).ownerRequired?.source_event,'RETRY_BUDGET_EXHAUSTED');assert.equal(store.ownerRequired.length,1);
assert.equal(stopForMissingIdentity({executionId:'run-4',reason:'PR identity missing'},store).source_event,'MISSING_REQUIRED_IDENTITY');assert.equal(stopForMissingIdentity({executionId:'run-4',reason:'PR identity missing'},store),stopForMissingIdentity({executionId:'run-4',reason:'PR identity missing'},store));
console.log('retry budget and stop condition matrix passed');
