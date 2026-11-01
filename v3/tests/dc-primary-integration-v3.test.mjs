import test from 'node:test';
import assert from 'node:assert/strict';
import {defaultProvider,validateProviderDecision,V3_EXECUTION_PROVIDERS}
 from '../lib/provider-routing.mjs';
import {submitBridgeRequest,submitBridgeRequestAsync} from '../lib/bridge-runtime.mjs';
import {parseNextStepDecision,parseNextStepForRequest} from '../browser-bridge/core.mjs';
import {createRemoteRunnerService} from '../lib/remote-runner-service.mjs';
const opts={v3Enabled:true};
const env={AICC_EXECUTOR_GOVERNANCE_V3_ENABLED:'1'};
const code=e=>e?.code||e?.message;
test('V3 opt-in switches both normal defaults to formal DC; legacy mode untouched',()=>{
 assert.deepEqual([...V3_EXECUTION_PROVIDERS],['SELF_HOSTED_DC','CODEX']);
 assert.equal(defaultProvider('CODE_CHANGE',opts),'SELF_HOSTED_DC');
 assert.equal(defaultProvider('TEST_ONLY',opts),'SELF_HOSTED_DC');
 assert.equal(defaultProvider('CODE_CHANGE'),'CLAUDE_CODE');
 assert.equal(defaultProvider('TEST_ONLY'),'CODEX');
});
test('V3 rejects Claude, Codex without security rationale, unknown providers',()=>{
 assert.throws(()=>validateProviderDecision({executionClass:'CODE_CHANGE',provider:'CLAUDE_CODE',providerRoutingReason:'old'},opts),
  e=>code(e)==='PROVIDER_ROUTING_CLAUDE_RETIRED');
 assert.throws(()=>validateProviderDecision({executionClass:'TEST_ONLY',provider:'CODEX',providerRoutingReason:'routine tests'},opts),
  e=>code(e)==='PROVIDER_ROUTING_CODEX_SECURITY_REASON_REQUIRED');
 assert.throws(()=>validateProviderDecision({executionClass:'CODE_CHANGE',provider:'fake',providerRoutingReason:'x'},opts),
  e=>code(e)==='PROVIDER_ROUTING_PROVIDER_INVALID');
 const ok=validateProviderDecision({executionClass:'TEST_ONLY',provider:'CODEX',providerRoutingReason:'SECURITY_REVIEW: inspect authorization boundary'},opts);
 assert.equal(ok.provider,'CODEX');assert.equal(ok.isOverride,true);
});
test('V3 Bridge synchronous STOP occurs BEFORE task creation, even without a runtime context',()=>{
 const input={executionProvider:{executionClass:'CODE_CHANGE',provider:'SELF_HOSTED_DC',providerRoutingReason:'owner approved'}};
 assert.throws(()=>submitBridgeRequest(null,input,env),e=>code(e)==='BRIDGE_DC_AUTO_DISPATCH_NOT_AUTHORIZED');
 assert.throws(()=>submitBridgeRequest(null,{executionProvider:{...input.executionProvider,provider:'CLAUDE_CODE'}},env),e=>code(e)==='BRIDGE_CLAUDE_RETIRED');
 assert.throws(()=>submitBridgeRequest(null,{},env),e=>code(e)==='BRIDGE_V3_PROVIDER_REQUIRED');
 assert.throws(()=>submitBridgeRequest(null,{executionProvider:{...input.executionProvider,provider:'CODEX'}},env),
 e=>code(e)==='BRIDGE_V3_PROVIDER_DECISION_INVALID');
});
test('V3 Bridge async STOP occurs BEFORE any Claude or DC remote runner access',async()=>{
 for(const provider of ['SELF_HOSTED_DC','CLAUDE_CODE']){
  await assert.rejects(submitBridgeRequestAsync(null,{executionProvider:{executionClass:'CODE_CHANGE',provider,providerRoutingReason:'approved'}},env),
   e=>code(e)===(provider==='CLAUDE_CODE'?'BRIDGE_CLAUDE_RETIRED':'BRIDGE_DC_AUTO_DISPATCH_NOT_AUTHORIZED'));
 }
});
test('Next-Step DC EXECUTE proposal becomes explicit STOP_GATE before Bridge submission',()=>{
 const s=['AICC_NEXT_STEP_V1','AICC_DECISION: EXECUTE','AICC_ACTION_CLASS: CODE_CHANGE',
  'AICC_PROVIDER: SELF_HOSTED_DC','AICC_PROVIDER_ROUTING_REASON: owner scoped',
  'AICC_WORK_PACKAGE: AICC-EXECUTOR-DC-PRIMARY-V3','AICC_TASK: review',
  'AICC_INSTRUCTION_BEGIN','inspect fixed tools only','AICC_INSTRUCTION_END',
  'AICC_GATE_REASON: NONE'].join('\n');
 assert.deepEqual(parseNextStepDecision(s),{decision:'STOP_GATE',gateReason:'NEXT_STEP_DC_AUTO_DISPATCH_NOT_AUTHORIZED'});
});

test('V3 opt-in retires legacy Claude runner even on a direct submit route',()=>{
 const r=createRemoteRunnerService('/tmp',{v3Enabled:true,spawn:()=>{throw Error('MUST_NOT_SPAWN');}});
 assert.throws(()=>r.submit({provider:'CLAUDE_CODE'}),e=>code(e)==='REMOTE_RUNNER_CLAUDE_RETIRED');
});

test('V3 browser rejects Claude and unqualified Codex even with a valid-looking EXECUTE block',()=>{
 const make=(provider,reason,marker=false)=>[
 'AICC_NEXT_STEP_V1',...(marker?['AICC_EXECUTOR_GOVERNANCE: V3']:[]),
 'AICC_DECISION: EXECUTE','AICC_ACTION_CLASS: CODE_CHANGE',
 'AICC_PROVIDER: '+provider,'AICC_PROVIDER_ROUTING_REASON: '+reason,
 'AICC_WORK_PACKAGE: AICC-EXECUTOR-DC-PRIMARY-V3','AICC_TASK: inspect',
 'AICC_INSTRUCTION_BEGIN','check source only','AICC_INSTRUCTION_END','AICC_GATE_REASON: NONE'
 ].join('\n');
 assert.deepEqual(parseNextStepDecision(make('CLAUDE_CODE','legacy'),{v3Enabled:true}),
  {decision:'STOP_GATE',gateReason:'NEXT_STEP_CLAUDE_RETIRED'});
 assert.deepEqual(parseNextStepDecision(make('CLAUDE_CODE','legacy',true)),
  {decision:'STOP_GATE',gateReason:'NEXT_STEP_CLAUDE_RETIRED'});
 assert.deepEqual(parseNextStepDecision(make('CODEX','routine tests',true)),
  {decision:'STOP_GATE',gateReason:'NEXT_STEP_CODEX_SECURITY_REASON_REQUIRED'});
 const valid=parseNextStepDecision(make('CODEX','SECURITY_REVIEW: inspect principal boundary',true));
 assert.equal(valid.decision,'EXECUTE');assert.equal(valid.provider,'CODEX');
});
test('runner constructor binds explicit V3 runtime env, direct submit cannot evade',()=>{
 for(const options of [
  {env:{AICC_EXECUTOR_GOVERNANCE_V3_ENABLED:'1'}},
  {v3Enabled:true}
 ]){
  const runner=createRemoteRunnerService('/tmp',{...options,spawn:()=>{throw Error('MUST_NOT_SPAWN');}});
  assert.throws(()=>runner.submit({provider:'CLAUDE_CODE'}),e=>code(e)==='REMOTE_RUNNER_CLAUDE_RETIRED');
 }
});

test('real browser background request binding stops stripped-marker V3 Claude reply',()=>{
 const request={v3Enabled:true,prompt:'AICC_NEXT_STEP_V1\nAICC_EXECUTOR_GOVERNANCE: V3\n'};
 const response=[
 'AICC_NEXT_STEP_V1','AICC_DECISION: EXECUTE','AICC_ACTION_CLASS: CODE_CHANGE',
 'AICC_PROVIDER: CLAUDE_CODE','AICC_PROVIDER_ROUTING_REASON: legacy',
 'AICC_WORK_PACKAGE: forged','AICC_TASK: forged',
 'AICC_INSTRUCTION_BEGIN','inspect only','AICC_INSTRUCTION_END',
 'AICC_GATE_REASON: NONE'
 ].join('\n');
 assert.deepEqual(parseNextStepForRequest(request,response),{
  decision:'STOP_GATE',gateReason:'NEXT_STEP_CLAUDE_RETIRED'
 });
 assert.deepEqual(parseNextStepForRequest({v3Enabled:true,prompt:'marker stripped'},response),{
  decision:'STOP_GATE',gateReason:'NEXT_STEP_V3_REQUEST_BINDING_INVALID'
 });
 assert.throws(()=>parseNextStepForRequest({v3Enabled:'true',prompt:request.prompt},response),
  e=>code(e)==='NEXT_STEP_REQUEST_MODE_INVALID');
});
