import test from 'node:test';
import assert from 'node:assert/strict';
import {classifyParityFailure} from './official-parity-failure.mjs';
test('operator policy error remains distinct from transport outage',()=>{
 assert.deepEqual(classifyParityFailure({code:'OPERATOR_DENIED'}),{
  code:'OPERATOR_DENIED',kind:'AUTHORIZATION',retryable:false,certainty:'reported',outcome:'NOT_CONFIRMED'
 });
 assert.equal(classifyParityFailure({code:'UNREACHABLE'}).kind,'TRANSPORT');
});
test('timeout is retryable for reads only, never assumed safe for writes',()=>{
 assert.equal(classifyParityFailure('TIMEOUT',{operation:'read'}).retryable,true);
 assert.equal(classifyParityFailure('TIMEOUT',{operation:'write'}).retryable,false);
 assert.equal(classifyParityFailure('PARITY_UNKNOWN_ERROR',{operation:'read'}).retryable,false);
});
test('malformed arbitrary backend error is redacted',()=>{
 const x=classifyParityFailure({message:'Token secret ABCD at private host'});
 assert.equal(x.code,'PARITY_UNKNOWN_ERROR');assert.equal(x.kind,'UNKNOWN');
 assert.equal(JSON.stringify(x).includes('ABCD'),false);
});
test('authentication and device states are not mistaken for permission',()=>{
 assert.equal(classifyParityFailure({code:'AUTH_FAILED'}).kind,'AUTHENTICATION');
 assert.equal(classifyParityFailure({code:'AGENT_DEGRADED'}).kind,'DEVICE');
});
test('unknown outcome is never automatically claimed as success',()=>{
 assert.equal(classifyParityFailure('TIMEOUT').outcome,'NOT_CONFIRMED');
});
