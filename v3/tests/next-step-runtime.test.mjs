import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {cancelPendingNextStepForRoom,claimNextStep,createNextStepRequest,latestNextStepForRoom,readNextStepRequest,reconcileNextStepStartup,recordNextStepReceipt} from '../lib/next-step-runtime.mjs';

function fixture(overrides={}){
  const home=mkdtempSync(join(tmpdir(),'aicc-v54-next-step-'));const env={AICC_V3_HOME:home};
  const context={project:{id:'v54',name:'V5.4'},repository:{identity:'owner/repo',path:'/tmp/wt-v54',branch:'feat/v54',head:'abc123',dirty:false},...overrides.context};
  const input={roomId:'traffic',roomName:'Traffic / Ads',workstreamId:'traffic-ads',branch:'feat/v54',worktree:'/tmp/wt-v54',head:'abc123',conversationId:'conv-1',draft:'continue safely',...overrides.input};
  const facts={executorReady:true,activeRun:null,snapshot:{conversationId:'conv-1',conversationUrl:'https://chatgpt.com/c/conv-1',capturedAt:new Date().toISOString()},work:{workPackages:[{id:'wp-live',title:'Live WP',status:'ACTIVE'}],tasks:[{id:'task-live',title:'Live Task',status:'IN_PROGRESS',workPackageId:'wp-live'}]},prDelivery:{pullRequests:[{number:77,title:'Live PR',state:'OPEN',isDraft:false,headRefOid:'abc123'}],checks:[{name:'verify',status:'completed',conclusion:'success',headSha:'abc123'}]},...overrides.facts};
  return {home,env,context,input,facts,cleanup:()=>rmSync(home,{recursive:true,force:true})};
}
function expectCode(fn,code){assert.throws(fn,error=>error?.code===code);}
const uiPreviewPolicy=Object.freeze({id:'AICC-GLOBAL-UI-PREVIEW-FIRST-V1',version:1,status:'ACTIVE',mainSha:'a'.repeat(40),contentSha256:'b'.repeat(64),instruction:'GPT must use AppBlock where supported; OWNER_VISUAL_PASS is separate from Production deployment approval.'});
const fastIterationPolicy=Object.freeze({id:'AICC-GLOBAL-FAST-ITERATION-V1',version:1,status:'ACTIVE',mainSha:'a'.repeat(40),blobSha:'c'.repeat(40),contentSha256:'d'.repeat(64),instruction:'GPT uses Owner Dev UAT, CI and Global UI Preview First. Owner exact-head merge and WWW/Production remain separately authorized.'});
function createWithPolicy(context,input,facts,env,options={}) {
  return createNextStepRequest(context,input,facts,env,{...options,uiPreviewPolicy,fastIterationPolicy});
}


test('creates frozen PENDING intent with strict GPT protocol',()=>{const f=fixture();try{const value=createWithPolicy(f.context,f.input,f.facts,f.env,{uuid:()=> 'req-1'});assert.equal(value.state.state,'PENDING');assert.equal(value.request.head,'abc123');assert.match(value.request.prompt,/AICC_NEXT_STEP_V1/);assert.match(value.request.prompt,/CANONICAL CROSS-PROJECT UI GOVERNANCE/);assert.match(value.request.prompt,/OWNER_VISUAL_PASS/);assert.match(value.request.prompt,/CROSS-PROJECT FAST ITERATION/);assert.match(value.request.prompt,/Owner exact-head merge/);assert.equal(value.request.fastIterationPolicy.mainSha,value.request.uiPreviewPolicy.mainSha);assert.equal(value.request.uiPreviewPolicy.mainSha,'a'.repeat(40));assert.match(value.request.prompt,/AICC_DECISION: EXECUTE\|STOP_GATE/);assert.match(value.request.prompt,/AICC_ACTION_CLASS: CODE_CHANGE\|TEST_ONLY\|STOP_GATE/);assert.match(value.request.prompt,/CANONICAL_EVIDENCE/);assert.match(value.request.prompt,/Live Task/);assert.match(value.request.prompt,/Live PR/);assert.equal(value.request.canonicalEvidence.currentTask.title,'Live Task');assert.equal(readNextStepRequest(f.context,'req-1',f.env).request.promptSha256.length,64);}finally{f.cleanup();}});
test('fails closed on runtime drift, dirty worktree, busy executor and stale conversation',()=>{
  for(const [mutate,code] of [
    [f=>f.input.branch='wrong','NEXT_STEP_RUNTIME_DRIFT'],
    [f=>f.input.head='wrong-head','NEXT_STEP_RUNTIME_DRIFT'],
    [f=>f.context.repository.dirty=true,'NEXT_STEP_WORKTREE_DIRTY'],
    [f=>f.facts.activeRun='run-1','NEXT_STEP_EXECUTOR_BUSY'],
    [f=>f.facts.snapshot=null,'NEXT_STEP_CONVERSATION_STALE'],
    [f=>f.facts.snapshot.capturedAt='2020-01-01T00:00:00.000Z','NEXT_STEP_CONVERSATION_STALE']
  ]){const f=fixture();try{mutate(f);expectCode(()=>createWithPolicy(f.context,f.input,f.facts,f.env),code);}finally{f.cleanup();}}
});
test('claim is exclusive and EXECUTION_QUEUED receipt requires exact claim plus bridge request id',()=>{const f=fixture();try{createWithPolicy(f.context,f.input,f.facts,f.env,{uuid:()=> 'req-2'});const claimed=claimNextStep(f.context,{bridgeInstanceId:'bridge-1'},f.env,{uuid:()=> 'claim-1'});assert.equal(claimed.request.requestId,'req-2');assert.equal(claimNextStep(f.context,{bridgeInstanceId:'bridge-2'},f.env),null);expectCode(()=>recordNextStepReceipt(f.context,'req-2',{claimId:'claim-1',outcome:'EXECUTION_QUEUED'},f.env),'NEXT_STEP_RECEIPT_PROVIDER_MISSING');expectCode(()=>recordNextStepReceipt(f.context,'req-2',{claimId:'claim-1',outcome:'EXECUTION_QUEUED',decision:{decision:'EXECUTE',actionClass:'CODE_CHANGE',provider:'CLAUDE_CODE',providerRoutingReason:'implementation task'}},f.env),'NEXT_STEP_RECEIPT_INVALID');const done=recordNextStepReceipt(f.context,'req-2',{claimId:'claim-1',outcome:'EXECUTION_QUEUED',bridgeRequestId:'bridge-request-1',decision:{decision:'EXECUTE',actionClass:'CODE_CHANGE',provider:'CLAUDE_CODE',providerRoutingReason:'implementation task'}},f.env);assert.equal(done.state.state,'EXECUTION_QUEUED');assert.equal(done.state.bridgeRequestId,'bridge-request-1');}finally{f.cleanup();}});
test('restart after CLAIMED becomes terminal UNCERTAIN and is never replayed',()=>{const f=fixture();try{createWithPolicy(f.context,f.input,f.facts,f.env,{uuid:()=> 'req-3'});claimNextStep(f.context,{bridgeInstanceId:'bridge-1'},f.env,{uuid:()=> 'claim-3'});assert.deepEqual(reconcileNextStepStartup(f.context,f.env),['req-3']);const value=readNextStepRequest(f.context,'req-3',f.env);assert.equal(value.state.state,'UNCERTAIN');assert.equal(value.state.errorCode,'NEXT_STEP_RESTART_AFTER_CLAIM');assert.equal(claimNextStep(f.context,{bridgeInstanceId:'bridge-1'},f.env),null);}finally{f.cleanup();}});

test('global queue keeps different Room/project intents isolated from current project context',()=>{
  const home=mkdtempSync(join(tmpdir(),'aicc-v55-global-next-step-'));const env={AICC_V3_HOME:home};
  const make=(id,room,path,conv)=>({
    context:{project:{id,name:id},repository:{identity:`owner/${id}`,path,branch:`feat/${room}`,head:`head-${room}`,dirty:false}},
    input:{roomId:room,roomName:room,workstreamId:room,branch:`feat/${room}`,worktree:path,head:`head-${room}`,conversationId:conv,draft:''},
    facts:{executorReady:true,activeRun:null,snapshot:{conversationId:conv,conversationUrl:`https://chatgpt.com/c/${conv}`,capturedAt:new Date().toISOString()}}
  });
  const a=make('project-a','room-a','/tmp/wt-a','conv-a'),b=make('project-b','room-b','/tmp/wt-b','conv-b');
  try{
    createWithPolicy(a.context,a.input,a.facts,env,{uuid:()=> 'req-a'});
    createWithPolicy(b.context,b.input,b.facts,env,{uuid:()=> 'req-b'});
    const first=claimNextStep(null,{bridgeInstanceId:'bridge'},env,{uuid:()=> 'claim-a'});assert.equal(first.request.roomId,'room-a');assert.equal(first.request.projectId,'project-a');
    recordNextStepReceipt(null,'req-a',{claimId:'claim-a',outcome:'STOP_GATE',decision:{decision:'STOP_GATE'}},env);
    const second=claimNextStep(null,{bridgeInstanceId:'bridge'},env,{uuid:()=> 'claim-b'});assert.equal(second.request.roomId,'room-b');assert.equal(second.request.projectId,'project-b');
  }finally{rmSync(home,{recursive:true,force:true});}
});


test('closing a Room cancels PENDING intent but never rewrites an already CLAIMED intent',()=>{
  const f=fixture();try{
    createWithPolicy(f.context,f.input,f.facts,f.env,{uuid:()=> 'req-close'});
    const cancelled=cancelPendingNextStepForRoom(null,'traffic',f.env,{now:()=> '2026-09-15T08:40:00.000Z'});
    assert.deepEqual(cancelled,{cancelled:['req-close'],claimed:[]});
    const closed=readNextStepRequest(null,'req-close',f.env);assert.equal(closed.state.state,'ABORTED_BEFORE_SEND');assert.equal(closed.state.errorCode,'NEXT_STEP_ROOM_INACTIVE');
    createWithPolicy(f.context,{...f.input,conversationId:'conv-2'}, {...f.facts,snapshot:{conversationId:'conv-2',conversationUrl:'https://chatgpt.com/c/conv-2',capturedAt:new Date().toISOString()}},f.env,{uuid:()=> 'req-claimed'});
    claimNextStep(null,{bridgeInstanceId:'bridge'},f.env,{uuid:()=> 'claim-close'});
    const blocked=cancelPendingNextStepForRoom(null,'traffic',f.env);assert.deepEqual(blocked,{cancelled:[],claimed:['req-claimed']});
    assert.equal(readNextStepRequest(null,'req-claimed',f.env).state.state,'CLAIMED');
  }finally{f.cleanup();}
});

test('no Next-Step is created without a verified canonical global UI policy',()=> {
  const f=fixture();
  try {
    expectCode(()=>createNextStepRequest(f.context,f.input,f.facts,f.env),'NEXT_STEP_GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE');
    expectCode(()=>createNextStepRequest(f.context,f.input,f.facts,f.env,{uiPreviewPolicy:{...uiPreviewPolicy,status:'DRAFT'}}),'NEXT_STEP_GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE');
    assert.equal(latestNextStepForRoom(f.context,'traffic',f.env),null);
  } finally {f.cleanup();}
});

test('Next-Step never persists intent with absent, stale or mismatched fast policy',()=>{
  const f=fixture();try{
    expectCode(()=>createNextStepRequest(f.context,f.input,f.facts,f.env,{uiPreviewPolicy}),'NEXT_STEP_GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
    expectCode(()=>createNextStepRequest(f.context,f.input,f.facts,f.env,{uiPreviewPolicy,fastIterationPolicy:{...fastIterationPolicy,mainSha:'f'.repeat(40)}}),'NEXT_STEP_GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
    expectCode(()=>createNextStepRequest(f.context,f.input,f.facts,f.env,{uiPreviewPolicy,fastIterationPolicy:{...fastIterationPolicy,status:'DRAFT'}}),'NEXT_STEP_GLOBAL_FAST_ITERATION_POLICY_UNAVAILABLE');
    assert.equal(latestNextStepForRoom(f.context,'traffic',f.env),null);
  }finally{f.cleanup();}
});
