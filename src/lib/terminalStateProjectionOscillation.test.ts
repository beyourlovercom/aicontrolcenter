import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import {bindControlLoop,claimFeedback,completeFeedback,consumeGptControl,enableControlLoop,markFeedbackInserted,markFeedbackInserting,markFeedbackSubmitted,markFeedbackSubmitting,projectAutoLoopStatus,readControlLoop} from './gptAutoControlLoop.ts';
import type {InboxItem} from './bridgeCore.ts';

const context:{AICCChatGPTDom?:Record<string,any>;innerWidth:number}={innerWidth:1440};
vm.runInNewContext(readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8'),context);
const dom=context.AICCChatGPTDom!;
const suffix=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
const wpId='AICC-V2-GPT-CODEX-BRIDGE-001',projectId='project-terminal-state-projection-oscillation',repositoryIdentity='repo-terminal-state-projection-oscillation';
let submitCount=0,launchCount=0;
const submit=():InboxItem=>{submitCount+=1;throw new Error('TERMINAL_POLLING_MUST_NOT_SUBMIT');};
const launch=():InboxItem=>{launchCount+=1;throw new Error('TERMINAL_POLLING_MUST_NOT_LAUNCH');};

function terminalProjection(kind:string,response:string,expectedState:'WAITING_OWNER_UAT'|'COMPLETE'|'BLOCKED') {
  const conversationId=`terminal-projection-${kind}-${suffix}`,controlLoopId=`terminal-projection-loop-${kind}-${suffix}`;
  const loop=bindControlLoop({control_loop_id:controlLoopId,projectId,repositoryIdentity,formal_wp_id:wpId,conversation_id:conversationId});enableControlLoop(controlLoopId,true);
  const feedback=claimFeedback({control_loop_id:controlLoopId,projectId,repositoryIdentity,formal_wp_id:wpId,conversation_id:conversationId,binding_epoch:loop.binding_epoch,execution_id:`execution-round-3-${kind}-${suffix}`,run_id:`run-round-3-${kind}-${suffix}`,result_id:`result-round-3-${kind}-${suffix}`,result_hash:`hash-round-3-${kind}-${suffix}`,execution_result:'ROUND_3 = PASS'}).record!;
  markFeedbackInserting(controlLoopId,feedback.feedback_key);markFeedbackInserted(controlLoopId,feedback.feedback_key);markFeedbackSubmitting(controlLoopId,feedback.feedback_key);markFeedbackSubmitted(controlLoopId,feedback.feedback_key);completeFeedback(controlLoopId,feedback.feedback_key,`feedback-message-${kind}-${suffix}`);
  const consumed=consumeGptControl({control_loop_id:controlLoopId,projectId,repositoryIdentity,conversation_id:conversationId,binding_epoch:loop.binding_epoch,feedback_key:feedback.feedback_key,expected_gpt_turn_id:feedback.expected_gpt_turn_id,assistant_message_id:`assistant-${kind}-${suffix}`,response},submit,launch);
  assert.equal(consumed.ok,true,'terminal control consumes through the exact canonical expected turn');
  const durable=readControlLoop(controlLoopId)!;assert.equal(durable.status,expectedState);
  const runId=`run-round-3-${kind}-${suffix}`;
  const runtime=dom.projectBridgeRuntime({previous:dom.emptyBridgeRuntimeProjection(),correlation:{inboxId:`inbox-${kind}-${suffix}`,runId,sourceType:'GPT_AUTO_CONTROL_LOOP'},item:{id:`outbox-${kind}-${suffix}`,state:'READY',inboxId:`inbox-${kind}-${suffix}`,taskId:`task-${kind}-${suffix}`,runId,executionId:`execution-round-3-${kind}-${suffix}`,updatedAt:'2026-08-16T08:00:00.000Z',report:{runId,executionId:`execution-round-3-${kind}-${suffix}`,status:'COMPLETED',canonicalResult:{version:'AICC_EXECUTION_RESULT_V1',executionId:`execution-round-3-${kind}-${suffix}`,resultId:`result-round-3-${kind}-${suffix}`,resultHash:`hash-round-3-${kind}-${suffix}`,rawResult:'ROUND_3 = PASS',returnState:'RESULT_READY'}}}});
  for(let index=0;index<25;index+=1){const exact=readControlLoop(controlLoopId)!;const status=projectAutoLoopStatus(exact);assert.equal(exact.status,expectedState);assert.equal(status.state,expectedState);assert.equal(runtime.status,'COMPLETED');assert.equal(runtime.resultState,'AVAILABLE');assert.equal(runtime.runId,runId);}
  return {loop:durable,status:projectAutoLoopStatus(durable),runtime};
}

const owner=terminalProjection('owner','AICC_OWNER_UAT_V1\nCONTROL_LOOP_TEST: PASS\nREASON: THREE_AUTOMATIC_ROUNDS_COMPLETED','WAITING_OWNER_UAT');
terminalProjection('complete','AICC_WP_COMPLETE_V1\nRESULT: PASS','COMPLETE');
terminalProjection('blocked','AICC_BLOCKED_V1\nBLOCKER_CODE: OWNER_DECISION_REQUIRED','BLOCKED');
assert.equal(owner.status.label,'AUTO LOOP · WAITING OWNER UAT');assert.equal(owner.runtime.status,'COMPLETED');assert.equal(owner.runtime.resultState,'AVAILABLE');
assert.equal(submitCount,0);assert.equal(launchCount,0,'terminal controls create no further Inbox, Task, Execution, or Run');
const unlockedLoop={...owner.loop,binding_active:false};const unlockedStatus=projectAutoLoopStatus(unlockedLoop);
assert.equal(unlockedStatus.state,'OFF');assert.equal(unlockedStatus.label,'AUTO LOOP · NOT BOUND','explicit durable unlock outranks terminal display projection');

const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
const poller=content.match(/async function pollResult\(allowAutomaticFeedback = false\)[\s\S]*?(?=\n  async function copyAndInsertResult)/)?.[0]??'';
const terminalFeedback=content.match(/async function submitAutomaticFeedback\(\)[\s\S]*?(?=\n  async function consumeNewAssistantControl)/)?.[0]??'';
const terminalConsume=content.match(/async function consumeNewAssistantControl\(\)[\s\S]*?(?=\n  function addPanelStyle)/)?.[0]??'';
assert.match(poller,/updateRuntimeProjection\(/,'polling retains runtime/result projection authority');
assert.match(poller,/await refreshAutoLoopStatus\(\)/,'polling refreshes Auto Loop only from canonical server status');
assert.match(terminalFeedback,/\['WAITING_OWNER_UAT', 'BLOCKED', 'COMPLETE', 'PAUSED'\]\.includes\(loop\.status\)/,'terminal durable state blocks repeat feedback delivery');
assert.match(content,/autoLoop = value;/,'UI replaces Auto Loop projection only with canonical status response');
assert.doesNotMatch(content,/reconcileAutoLoopProjection|terminalAutoLoopState/,'removed client-side terminal authority cannot return');
assert.match(terminalConsume,/const status = await refreshAutoLoopStatus\(\)/,'terminal control consumption starts from canonical durable status');
assert.match(terminalConsume,/!status\?\.ok \|\| !status\.expected_turn/,'without a canonical expected turn terminal polling cannot consume another control');
console.log('M8.2.1.8.9A terminal projection server-authority regression passed');
