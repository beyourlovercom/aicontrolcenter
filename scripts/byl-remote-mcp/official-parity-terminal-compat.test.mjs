import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeApprovedRemoteCall} from './official-parity-terminal-compat.mjs';

test('adds the bounded start_process timeout without mutating approved arguments',()=>{
 const argumentsObject={command:'hostname'};
 const approved={name:'start_process',arguments:argumentsObject};
 const normalized=normalizeApprovedRemoteCall(approved);
 assert.deepEqual(normalized,{name:'start_process',arguments:{command:'hostname',timeout_ms:3000}});
 assert.notEqual(normalized,approved);
 assert.notEqual(normalized.arguments,argumentsObject);
 assert.deepEqual(argumentsObject,{command:'hostname'});
});

test('preserves an explicitly provided safe timeout',()=>{
 const approved={name:'start_process',arguments:{command:'hostname',timeout_ms:8000}};
 assert.equal(normalizeApprovedRemoteCall(approved),approved);
 assert.equal(normalizeApprovedRemoteCall(approved).arguments.timeout_ms,8000);
});

test('passes other approved tools through unchanged',()=>{
 const approved={name:'get_file_info',arguments:{path:'/tmp/example'}};
 assert.equal(normalizeApprovedRemoteCall(approved),approved);
});

test('fails closed for malformed approvals and unsafe timeout values',()=>{
 for(const value of [null,{},
  {name:'start_process',arguments:null},
  {name:'start_process',arguments:{timeout_ms:NaN}},
  {name:'start_process',arguments:{timeout_ms:Infinity}},
  {name:'start_process',arguments:{timeout_ms:-1}},
  {name:'start_process',arguments:{timeout_ms:1.5}}])
  assert.throws(()=>normalizeApprovedRemoteCall(value));
});
