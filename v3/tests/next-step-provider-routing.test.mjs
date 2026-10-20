import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createNextStepRequest,recordNextStepReceipt,claimNextStep,nextStepPrompt} from '../lib/next-step-runtime.mjs';

function fixture(overrides={}){
  const home=mkdtempSync(join(tmpdir(),'aicc-nspr-'));const env={AICC_V3_HOME:home};
  const context={project:{id:'nspr',name:'NSPR'},repository:{identity:'o/r',path:'/tmp/wt-nspr',branch:'feat/nspr',head:'abc999',dirty:false},...overrides.context};
  const input={roomId:'room-1',roomName:'Room 1',workstreamId:'ws-1',branch:'feat/nspr',worktree:'/tmp/wt-nspr',head:'abc999',conversationId:'conv-nspr',...overrides.input};
  const facts={executorReady:true,activeRun:null,snapshot:{conversationId:'conv-nspr',conversationUrl:'https://chatgpt.com/c/conv-nspr',capturedAt:new Date().toISOString()},...overrides.facts};
  return {home,env,context,input,facts,cleanup:()=>rmSync(home,{recursive:true,force:true})};
}
function expectCode(fn,code){assert.throws(fn,e=>e?.code===code);}
const uiPreviewPolicy={id:'AICC-GLOBAL-UI-PREVIEW-FIRST-V1',status:'ACTIVE',version:1,mainSha:'a'.repeat(40),contentSha256:'b'.repeat(64),instruction:'GPT must use AppBlock for material UI changes, require OWNER_VISUAL_PASS and keep Production deployment separately gated.'};
const fastIterationPolicy={id:'AICC-GLOBAL-FAST-ITERATION-V1',status:'ACTIVE',version:1,mainSha:'a'.repeat(40),blobSha:'c'.repeat(40),contentSha256:'d'.repeat(64),instruction:'GPT keeps Owner Dev UAT, CI, Global UI Preview First, Owner exact-head merge and WWW/Production separately gated.'};
function createWithPolicy(context,input,facts,env,options={}) {
  return createNextStepRequest(context,input,facts,env,{...options,uiPreviewPolicy,fastIterationPolicy});
}

test('next-step prompt includes AICC_PROVIDER and AICC_PROVIDER_ROUTING_REASON fields',()=>{
  const f=fixture();try{
    const result=createWithPolicy(f.context,f.input,f.facts,f.env,{uuid:()=>'req-nspr-1'});
    assert.match(result.request.prompt,/AICC_PROVIDER: CLAUDE_CODE\|CODEX/);
    assert.match(result.request.prompt,/AICC_PROVIDER_ROUTING_REASON:/);
  }finally{f.cleanup();}
});

test('next-step prompt includes default routing guidance',()=>{
  const f=fixture();try{
    const result=createWithPolicy(f.context,f.input,f.facts,f.env,{uuid:()=>'req-nspr-2'});
    assert.match(result.request.prompt,/CODE_CHANGE -> CLAUDE_CODE/);
    assert.match(result.request.prompt,/TEST_ONLY -> CODEX/);
  }finally{f.cleanup();}
});

test('recordNextStepReceipt EXECUTION_QUEUED requires valid provider decision',()=>{
  const f=fixture();try{
    createWithPolicy(f.context,f.input,f.facts,f.env,{uuid:()=>'req-nspr-3'});
    const claimed=claimNextStep(f.context,{bridgeInstanceId:'b1'},f.env,{uuid:()=>'claim-nspr-3'});
    const goodDecision={decision:'EXECUTE',actionClass:'CODE_CHANGE',provider:'CLAUDE_CODE',providerRoutingReason:'code change task',workPackageTitle:'WP',taskTitle:'Task',instruction:'do it'};
    const done=recordNextStepReceipt(f.context,'req-nspr-3',{claimId:'claim-nspr-3',outcome:'EXECUTION_QUEUED',bridgeRequestId:'br-1',decision:goodDecision},f.env);
    assert.equal(done.state.state,'EXECUTION_QUEUED');
    assert.equal(done.state.decision.provider,'CLAUDE_CODE');
  }finally{f.cleanup();}
});

test('recordNextStepReceipt EXECUTION_QUEUED fails closed on missing provider',()=>{
  const f=fixture();try{
    createWithPolicy(f.context,f.input,f.facts,f.env,{uuid:()=>'req-nspr-4'});
    claimNextStep(f.context,{bridgeInstanceId:'b1'},f.env,{uuid:()=>'claim-nspr-4'});
    const badDecision={decision:'EXECUTE',actionClass:'CODE_CHANGE',workPackageTitle:'WP',taskTitle:'Task',instruction:'do it'};
    expectCode(()=>recordNextStepReceipt(f.context,'req-nspr-4',{claimId:'claim-nspr-4',outcome:'EXECUTION_QUEUED',bridgeRequestId:'br-1',decision:badDecision},f.env),'NEXT_STEP_RECEIPT_PROVIDER_MISSING');
  }finally{f.cleanup();}
});

test('recordNextStepReceipt EXECUTION_QUEUED fails closed on invalid provider',()=>{
  const f=fixture();try{
    createWithPolicy(f.context,f.input,f.facts,f.env,{uuid:()=>'req-nspr-5'});
    claimNextStep(f.context,{bridgeInstanceId:'b1'},f.env,{uuid:()=>'claim-nspr-5'});
    const badDecision={decision:'EXECUTE',actionClass:'CODE_CHANGE',provider:'UNKNOWN_PROVIDER',providerRoutingReason:'r',workPackageTitle:'WP',taskTitle:'Task',instruction:'do it'};
    expectCode(()=>recordNextStepReceipt(f.context,'req-nspr-5',{claimId:'claim-nspr-5',outcome:'EXECUTION_QUEUED',bridgeRequestId:'br-1',decision:badDecision},f.env),'NEXT_STEP_RECEIPT_PROVIDER_MISSING');
  }finally{f.cleanup();}
});

test('recordNextStepReceipt STOP_GATE does not require provider fields',()=>{
  const f=fixture();try{
    createWithPolicy(f.context,f.input,f.facts,f.env,{uuid:()=>'req-nspr-6'});
    claimNextStep(f.context,{bridgeInstanceId:'b1'},f.env,{uuid:()=>'claim-nspr-6'});
    const done=recordNextStepReceipt(f.context,'req-nspr-6',{claimId:'claim-nspr-6',outcome:'STOP_GATE',decision:{decision:'STOP_GATE',gateReason:'owner review needed'}},f.env);
    assert.equal(done.state.state,'STOP_GATE');
  }finally{f.cleanup();}
});
