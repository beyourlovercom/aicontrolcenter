import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
const worker=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/service-worker.js'),'utf8');
const dom=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/chatgpt-dom.js'),'utf8');
const loop=readFileSync(join(process.cwd(),'src/lib/gptAutoControlLoop.ts'),'utf8');

// The former diagnostic Probe/UAT path is obsolete. The current contract is
// canonical Auto Loop feedback delivery followed by a terminal Owner-UAT
// control contract.
assert.doesNotMatch(content,/runAutoSubmitProbe|autoSubmitProbeBlockReason|AUTO_SUBMIT_PROBE_ID|AICC_AUTO_SUBMIT_PROBE_V1/);
assert.match(content,/async function submitAutomaticFeedback\(\)[\s\S]*?AUTO_LOOP_FEEDBACK/);
assert.match(content,/submitChatGPTComposerOnce\(\{[\s\S]*conversationId: loop\.conversation_id,[\s\S]*payload: feedback\.envelope,[\s\S]*submissionId: feedback\.feedback_id/);
assert.equal((content.match(/submitChatGPTComposerOnce\(/g)??[]).length,1,'feedback delivery has one canonical Composer submission call');
assert.match(content,/AUTO_LOOP_FEEDBACK_STATE.*operation: 'inserting'/);
assert.match(content,/AUTO_LOOP_FEEDBACK_STATE.*operation: 'inserted'/);
assert.match(content,/AUTO_LOOP_FEEDBACK_STATE.*operation: 'submitting'/);
assert.match(content,/AUTO_LOOP_FEEDBACK_STATE.*operation: 'submitted'/);
assert.match(content,/AUTO_LOOP_FEEDBACK_STATE.*operation: 'complete'/);
assert.match(worker,/AUTO_LOOP_FEEDBACK.*autoLoopFeedback/);
assert.match(worker,/AUTO_LOOP_FEEDBACK_STATE.*autoLoopFeedbackState/);
assert.match(worker,/AUTO_LOOP_CONTROL.*autoLoopControl/);
assert.match(dom,/async function submitChatGPTComposerOnce/);
assert.match(dom,/sendButton\.click\(\)/);
assert.match(loop,/export function consumeGptControl\(/);
assert.match(loop,/CONTROL_CONTRACT_TYPES = \['AICC_EXECUTION_V1', 'AICC_OWNER_UAT_V1', 'AICC_WP_COMPLETE_V1', 'AICC_BLOCKED_V1'\]/);
assert.match(loop,/if \(contract\.type === 'AICC_OWNER_UAT_V1'\) \{ loop\.status = 'WAITING_OWNER_UAT'/);
assert.match(loop,/loop\.control_loop_status = parsed\.contract\.type === 'AICC_OWNER_UAT_V1' \? 'WAITING_OWNER_UAT'/);
assert.match(loop,/if \(loop\.control_loop_status === 'WAITING_OWNER_UAT'\)/);
console.log('current canonical Auto Loop feedback → Owner UAT trigger contract passed');
