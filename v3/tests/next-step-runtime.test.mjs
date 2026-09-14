import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {claimNextStep,createNextStepRequest,readNextStepRequest,reconcileNextStepStartup,recordNextStepReceipt} from '../lib/next-step-runtime.mjs';

function fixture(overrides={}){
  const home=mkdtempSync(join(tmpdir(),'aicc-v54-next-step-'));const env={AICC_V3_HOME:home};
  const context={project:{id:'v54',name:'V5.4'},repository:{identity:'owner/repo',path:'/tmp/wt-v54',branch:'feat/v54',head:'abc123',dirty:false},...overrides.context};
  const input={roomId:'traffic',roomName:'Traffic / Ads',workstreamId:'traffic-ads',branch:'feat/v54',worktree:'/tmp/wt-v54',conversationId:'conv-1',draft:'continue safely',...overrides.input};
  const facts={executorReady:true,activeRun:null,snapshot:{conversationId:'conv-1',conversationUrl:'https://chatgpt.com/c/conv-1'},...overrides.facts};
  return {home,env,context,input,facts,cleanup:()=>rmSync(home,{recursive:true,force:true})};
}
function expectCode(fn,code){assert.throws(fn,error=>error?.code===code);}

test('creates frozen PENDING intent with strict GPT protocol',()=>{const f=fixture();try{const value=createNextStepRequest(f.context,f.input,f.facts,f.env,{uuid:()=> 'req-1',now:()=> '2026-09-14T08:00:00.000Z'});assert.equal(value.state.state,'PENDING');assert.equal(value.request.head,'abc123');assert.match(value.request.prompt,/AICC_NEXT_STEP_V1/);assert.match(value.request.prompt,/AICC_DECISION: EXECUTE\|STOP_GATE/);assert.equal(readNextStepRequest(f.context,'req-1',f.env).request.promptSha256.length,64);}finally{f.cleanup();}});
test('fails closed on runtime drift, dirty worktree, busy executor and stale conversation',()=>{
  for(const [mutate,code] of [
    [f=>f.input.branch='wrong','NEXT_STEP_RUNTIME_DRIFT'],
    [f=>f.context.repository.dirty=true,'NEXT_STEP_WORKTREE_DIRTY'],
    [f=>f.facts.activeRun='run-1','NEXT_STEP_EXECUTOR_BUSY'],
    [f=>f.facts.snapshot=null,'NEXT_STEP_CONVERSATION_STALE']
  ]){const f=fixture();try{mutate(f);expectCode(()=>createNextStepRequest(f.context,f.input,f.facts,f.env),code);}finally{f.cleanup();}}
});
test('claim is exclusive and EXECUTION_QUEUED receipt requires exact claim plus bridge request id',()=>{const f=fixture();try{createNextStepRequest(f.context,f.input,f.facts,f.env,{uuid:()=> 'req-2'});const claimed=claimNextStep(f.context,{bridgeInstanceId:'bridge-1'},f.env,{uuid:()=> 'claim-1'});assert.equal(claimed.request.requestId,'req-2');assert.equal(claimNextStep(f.context,{bridgeInstanceId:'bridge-2'},f.env),null);expectCode(()=>recordNextStepReceipt(f.context,'req-2',{claimId:'claim-1',outcome:'EXECUTION_QUEUED'},f.env),'NEXT_STEP_RECEIPT_INVALID');const done=recordNextStepReceipt(f.context,'req-2',{claimId:'claim-1',outcome:'EXECUTION_QUEUED',bridgeRequestId:'bridge-request-1',decision:{decision:'EXECUTE'}},f.env);assert.equal(done.state.state,'EXECUTION_QUEUED');assert.equal(done.state.bridgeRequestId,'bridge-request-1');}finally{f.cleanup();}});
test('restart after CLAIMED becomes terminal UNCERTAIN and is never replayed',()=>{const f=fixture();try{createNextStepRequest(f.context,f.input,f.facts,f.env,{uuid:()=> 'req-3'});claimNextStep(f.context,{bridgeInstanceId:'bridge-1'},f.env,{uuid:()=> 'claim-3'});assert.deepEqual(reconcileNextStepStartup(f.context,f.env),['req-3']);const value=readNextStepRequest(f.context,'req-3',f.env);assert.equal(value.state.state,'UNCERTAIN');assert.equal(value.state.errorCode,'NEXT_STEP_RESTART_AFTER_CLAIM');assert.equal(claimNextStep(f.context,{bridgeInstanceId:'bridge-1'},f.env),null);}finally{f.cleanup();}});
