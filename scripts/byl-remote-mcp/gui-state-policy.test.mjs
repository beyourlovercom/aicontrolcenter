import test from 'node:test';import assert from 'node:assert/strict';import {verifyTransition as check} from './gui-state-policy.mjs';
test('click must yield exact test outcome',()=>assert.equal(check({action:'click',before:'BYL GUI TEST READY - Google Chrome',after:'BYL GUI CLICK PASS - Google Chrome'}).ok,true));
test('unverified click fails',()=>assert.equal(check({action:'click',before:'BYL GUI TEST READY',after:'BYL GUI TEST READY'}).reason,'STATE_NOT_VERIFIED'));
test('typing requires specific resulting value',()=>assert.equal(check({action:'type',before:'BYL GUI CLICK PASS',after:'BYL GUI TYPE UATPASS'}).ok,true));
test('real checkout never accepted as proof',()=>assert.equal(check({action:'click',before:'Checkout',after:'Thank you'}).ok,false));
