import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProvider,validateProviderDecision,EXECUTION_CLASSES,EXECUTION_PROVIDERS} from '../lib/provider-routing.mjs';

function expectCode(fn,code){assert.throws(fn,e=>e?.code===code);}

test('EXECUTION_CLASSES and EXECUTION_PROVIDERS are frozen',()=>{
  assert.deepEqual([...EXECUTION_CLASSES],['CODE_CHANGE','TEST_ONLY']);
  assert.deepEqual([...EXECUTION_PROVIDERS],['CLAUDE_CODE','CODEX']);
});

test('defaultProvider routes CODE_CHANGE to CLAUDE_CODE and TEST_ONLY to CODEX',()=>{
  assert.equal(defaultProvider('CODE_CHANGE'),'CLAUDE_CODE');
  assert.equal(defaultProvider('TEST_ONLY'),'CODEX');
});

test('defaultProvider fails on unknown execution class',()=>{
  expectCode(()=>defaultProvider('UNKNOWN'),'PROVIDER_ROUTING_CLASS_INVALID');
  expectCode(()=>defaultProvider(null),'PROVIDER_ROUTING_CLASS_INVALID');
});

test('validateProviderDecision accepts valid decision',()=>{
  const result=validateProviderDecision({executionClass:'CODE_CHANGE',provider:'CLAUDE_CODE',providerRoutingReason:'implementation task'});
  assert.deepEqual(result,{executionClass:'CODE_CHANGE',provider:'CLAUDE_CODE',providerRoutingReason:'implementation task',isOverride:false});
  const r2=validateProviderDecision({executionClass:'TEST_ONLY',provider:'CODEX',providerRoutingReason:'deterministic test verification'});
  assert.equal(r2.provider,'CODEX');assert.equal(r2.isOverride,false);
});

test('validateProviderDecision preserves explicit provider override as auditable fact',()=>{
  const r=validateProviderDecision({executionClass:'CODE_CHANGE',provider:'CODEX',providerRoutingReason:'narrow deterministic exception'});
  assert.equal(r.provider,'CODEX');assert.equal(r.isOverride,true);assert.equal(r.providerRoutingReason,'narrow deterministic exception');
});

test('validateProviderDecision trims providerRoutingReason',()=>{
  const r=validateProviderDecision({executionClass:'CODE_CHANGE',provider:'CLAUDE_CODE',providerRoutingReason:'  reason  '});
  assert.equal(r.providerRoutingReason,'reason');
});

test('validateProviderDecision fails on invalid inputs',()=>{
  expectCode(()=>validateProviderDecision({executionClass:'INVALID',provider:'CLAUDE_CODE',providerRoutingReason:'x'}),'PROVIDER_ROUTING_CLASS_INVALID');
  expectCode(()=>validateProviderDecision({executionClass:'CODE_CHANGE',provider:'INVALID',providerRoutingReason:'x'}),'PROVIDER_ROUTING_PROVIDER_INVALID');
  expectCode(()=>validateProviderDecision({executionClass:'CODE_CHANGE',provider:'CLAUDE_CODE',providerRoutingReason:''}),'PROVIDER_ROUTING_REASON_REQUIRED');
  expectCode(()=>validateProviderDecision({executionClass:'CODE_CHANGE',provider:'CLAUDE_CODE',providerRoutingReason:'   '}),'PROVIDER_ROUTING_REASON_REQUIRED');
  expectCode(()=>validateProviderDecision(null),'PROVIDER_ROUTING_CLASS_INVALID');
});
