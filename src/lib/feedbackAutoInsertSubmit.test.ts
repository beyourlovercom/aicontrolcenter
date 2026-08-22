import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';
import {bindControlLoop,buildFeedbackEnvelope,claimFeedback,completeFeedback,enableControlLoop,failFeedbackDelivery,markFeedbackInserted,markFeedbackInserting,markFeedbackSubmitted,markFeedbackSubmitting,readControlLoop,readFeedback} from './gptAutoControlLoop.ts';

const loopId=`feedback-loop-${Date.now()}`;
const conversationId='feedback-bound-conversation';
const projectId='project-feedback-auto-insert-submit';
const repositoryIdentity='repo-feedback-auto-insert-submit';
const input={control_loop_id:loopId,projectId,repositoryIdentity,formal_wp_id:'AICC-V2-GPT-CODEX-BRIDGE-001',conversation_id:conversationId,current_pr_id:null,task_id:'task-round-1',instruction_id:'instruction-round-1',execution_id:'execution-round-1',run_id:'run-round-1',source:'GPT_AUTO_CONTROL_LOOP',runtime:'CODEX_CLI',model:'luna',result_id:'result-run-round-1',result_hash:'exact-result-hash',execution_result:'ROUND_1 = PASS\nEXACT_RESULT = preserved'};
bindControlLoop({control_loop_id:loopId,projectId,repositoryIdentity,formal_wp_id:input.formal_wp_id,conversation_id:conversationId});
enableControlLoop(loopId,true);
const claimed=claimFeedback(input);
assert.equal(claimed.claimGranted,true,'completed exact Run creates one durable feedback');
assert.equal(claimFeedback(input).claimGranted,false,'duplicate polling cannot create another feedback');
assert.equal(readFeedback(loopId).length,1);
assert.match(claimed.record!.envelope,/RUN_ID: run-round-1/);
assert.match(claimed.record!.envelope,/RESULT_ID: result-run-round-1/);
assert.match(claimed.record!.envelope,/RESULT_HASH: exact-result-hash/);
assert.match(claimed.record!.envelope,/ROUND_1 = PASS\nEXACT_RESULT = preserved/,'canonical result is not summarized');
assert.equal(claimFeedback({...input,conversation_id:'other-conversation'}).code,'CROSS_CONVERSATION_ISOLATION');

const feedbackKey=claimed.record!.feedback_key;
assert.equal(markFeedbackInserting(loopId,feedbackKey).attemptGranted,true);
assert.equal(markFeedbackInserted(loopId,feedbackKey).lifecycle,'FEEDBACK_INSERTED');
assert.equal(readControlLoop(loopId)?.status,'FEEDBACK_INSERTED');
assert.equal(markFeedbackSubmitting(loopId,feedbackKey).sendGranted,true,'verified insertion grants one durable Send claim');
assert.equal(markFeedbackSubmitting(loopId,feedbackKey).sendGranted,false,'remount cannot acquire a second Send claim');
assert.equal(readControlLoop(loopId)?.status,'FEEDBACK_SUBMITTING');
assert.throws(()=>completeFeedback(loopId,feedbackKey),/FEEDBACK_SUBMISSION_NOT_CONFIRMED/,'WAITING_GPT requires visible message confirmation');
markFeedbackSubmitted(loopId,feedbackKey);
assert.equal(readControlLoop(loopId)?.status,'FEEDBACK_SUBMITTED');
completeFeedback(loopId,feedbackKey);
assert.equal(readControlLoop(loopId)?.status,'WAITING_GPT');
assert.equal(claimFeedback(input).record?.lifecycle,'FEEDBACK_CONSUMED','reload sees consumed durable identity');

const failureLoopId=`feedback-failure-${Date.now()}`;
const failureInput={...input,control_loop_id:failureLoopId,conversation_id:'feedback-failure-conversation',execution_id:'execution-failure',run_id:'run-failure',result_id:'result-failure',result_hash:'hash-failure'};
bindControlLoop({control_loop_id:failureLoopId,projectId,repositoryIdentity,formal_wp_id:input.formal_wp_id,conversation_id:failureInput.conversation_id});
enableControlLoop(failureLoopId,true);
const failureClaim=claimFeedback(failureInput).record!;
assert.equal(markFeedbackInserting(failureLoopId,failureClaim.feedback_key).attemptGranted,true);
failFeedbackDelivery(failureLoopId,failureClaim.feedback_key,'FEEDBACK_COMPOSER_UNAVAILABLE');
assert.equal(markFeedbackInserting(failureLoopId,failureClaim.feedback_key).attemptGranted,false,'terminal feedback failure cannot reinsert after polling or remount');
assert.equal(readControlLoop(failureLoopId)?.status,'FEEDBACK_DELIVERY_FAILED');

const sendFailureLoopId=`feedback-send-failure-${Date.now()}`;
const sendFailureInput={...input,control_loop_id:sendFailureLoopId,conversation_id:'feedback-send-failure-conversation',execution_id:'execution-send-failure',run_id:'run-send-failure',result_id:'result-send-failure',result_hash:'hash-send-failure'};
bindControlLoop({control_loop_id:sendFailureLoopId,projectId,repositoryIdentity,formal_wp_id:input.formal_wp_id,conversation_id:sendFailureInput.conversation_id});
enableControlLoop(sendFailureLoopId,true);
const sendFailureClaim=claimFeedback(sendFailureInput).record!;
assert.equal(markFeedbackInserting(sendFailureLoopId,sendFailureClaim.feedback_key).attemptGranted,true);
markFeedbackInserted(sendFailureLoopId,sendFailureClaim.feedback_key);
assert.equal(markFeedbackSubmitting(sendFailureLoopId,sendFailureClaim.feedback_key).sendGranted,true);
failFeedbackDelivery(sendFailureLoopId,sendFailureClaim.feedback_key,'SEND_CLICK_FAILED');
assert.equal(readControlLoop(sendFailureLoopId)?.status,'FEEDBACK_DELIVERY_FAILED','a failure after the durable Send claim is terminal');
assert.equal(markFeedbackInserting(sendFailureLoopId,sendFailureClaim.feedback_key).attemptGranted,false,'a failed Send claim cannot reinsert feedback');
assert.equal(markFeedbackSubmitting(sendFailureLoopId,sendFailureClaim.feedback_key).sendGranted,false,'a failed Send claim cannot click Send again');
assert.throws(()=>completeFeedback(sendFailureLoopId,sendFailureClaim.feedback_key),/FEEDBACK_SUBMISSION_NOT_CONFIRMED/,'failed delivery cannot project WAITING_GPT');

class FakeNode {
  value=''; innerText=''; textContent=''; isConnected=true; offsetParent={}; parentElement:null|FakeNode=null; disabled=false; clickCount=0;
  attributes=new Map<string,string>(); children:FakeNode[]=[]; ownerDocument:FakeDocument|null=null;
  focus(){} dispatchEvent(){return true;} cloneNode(){return this;} querySelectorAll(){return [];} getClientRects(){return [1];}
  getAttribute(name:string){return this.attributes.get(name)??null;} setAttribute(name:string,value:string){this.attributes.set(name,value);}
  querySelector(selector:string){return selector.includes('send')?this.children[0]??null:null;} click(){this.clickCount+=1;}
}
class FakeDocument {
  location={href:`https://chatgpt.com/c/${conversationId}`,pathname:`/c/${conversationId}`}; defaultView={}; users:FakeNode[]=[]; composer:FakeNode|null=null; sendButton:FakeNode|null=null;
  querySelectorAll(selector:string){if(selector.includes('message-author-role="user"'))return this.users;if(selector==='[contenteditable="true"]')return [];if(selector==='textarea')return this.composer?[this.composer]:[];return [];}
  querySelector(selector:string){return selector==='[data-testid="send-button"]'?this.sendButton:null;}
}
const context:{AICCChatGPTDom?:Record<string,any>;Event:typeof Event;setTimeout:typeof setTimeout}={Event,setTimeout};
vm.runInNewContext(readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8'),context);
const dom=context.AICCChatGPTDom!;
const document=new FakeDocument();
const composer=new FakeNode(); composer.ownerDocument=document; document.composer=composer;
const send=new FakeNode(); send.ownerDocument=document; composer.parentElement=new FakeNode(); composer.parentElement.children=[send]; document.sendButton=send;
const envelope=buildFeedbackEnvelope(input);
assert.equal(dom.insertTextIntoComposer(composer,envelope),true,'complete feedback inserts through canonical composer adapter');
assert.equal(await dom.verifyComposerText(composer,envelope,[0]),true,'complete payload remains verifiable');
const user=new FakeNode(); delete (user as {value?:string}).value; user.innerText=envelope; user.textContent=envelope; document.users=[user];
assert.equal(dom.submittedUserMessage(document,envelope),user,'exact complete user message confirms submission');
assert.equal(await dom.waitForSubmittedUserMessage(document,envelope,[0]),user);
user.innerText=`${envelope}\nextra`;user.textContent=user.innerText;
assert.equal(dom.submittedUserMessage(document,envelope),null,'prefix or altered message cannot confirm submission');

const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
const worker=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/service-worker.js'),'utf8');
const automatic=content.match(/async function submitAutomaticFeedback[\s\S]*?(?=\n  async function consumeNewAssistantControl)/)?.[0]??'';
const manual=content.match(/async function copyAndInsertResult[\s\S]*?(?=\n  function currentPanelResult)/)?.[0]??'';
assert.match(automatic,/submitChatGPTComposerOnce\(\{ document, conversationId: loop\.conversation_id, payload: feedback\.envelope, submissionId: feedback\.feedback_id/,'feedback uses the one canonical bounded Composer submission primitive with exact loop/result identity');
assert.equal((automatic.match(/submitChatGPTComposerOnce\(/g)??[]).length,1,'feedback has one canonical composer submission path');
assert.match(automatic,/beforeSubmit: async \(\) => \{ const result = await message\('AUTO_LOOP_FEEDBACK_STATE', \{ operation: 'submitting'[\s\S]*sendGranted === false/,'the durable Send claim remains inside the canonical primitive boundary');
assert.equal((automatic.match(/ownerConfirmSend\(/g)??[]).length,0,'feedback no longer has a competing Send implementation');
assert.equal((automatic.match(/operation: 'fail'/g)??[]).length,1,'all feedback delivery failures use one durable terminal transition');
assert.doesNotMatch(automatic,/sendClaimed\s*\?\s*['"]AUTO LOOP · FEEDBACK SUBMITTING/,'a failed direct Send is never projected as still submitting');
assert.doesNotMatch(automatic,/KeyboardEvent|requestSubmit|ownerConfirmSend/,'feedback adds no competing keyboard or submit implementation');
assert.doesNotMatch(automatic,/sleep|setTimeout|5000/,'feedback has no fixed post-insert send delay');
const primitive=readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8').match(/async function submitChatGPTComposerOnce[\s\S]*?(?=\n  function exactNormalizedText)/)?.[0]??'';
assert.ok(primitive.indexOf('waitForLiveComposerSendCondition(document')<primitive.indexOf('if (beforeSubmit) await beforeSubmit()'),'live composer and Send readiness precede the durable Send claim');
assert.ok(primitive.indexOf('if (beforeSubmit) await beforeSubmit()')<primitive.indexOf('findComposerSendButton(document, ready.composer)'),'fresh Send resolution follows the durable claim callback');
assert.equal((primitive.match(/insertTextIntoComposer\(/g)??[]).length,1,'readiness polling has no reinsertion path');
const readiness=readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8').match(/function liveComposerSendCondition[\s\S]*?(?=\n  async function waitForLiveComposerSendCondition)/)?.[0]??'';
assert.match(readiness,/composer && composerText && sendButton/,'readiness requires a current non-empty composer and live Send button');
assert.doesNotMatch(readiness,/expected|includes\(|=== exactPayload/,'readiness does not compare the current composer with the expected payload');
assert.doesNotMatch(primitive,/COMPOSER_NOT_READY|EXPECTED_PAYLOAD_NOT_RETAINED|INSERT_VERIFICATION_FAILED/,'false post-insert payload failures are removed');
assert.match(automatic,/if \(!claimed\.claimGranted && feedback\.lifecycle !== 'FEEDBACK_CLAIMED'\) \{ await refreshAutoLoopStatus\(\); return claimed; \}/,'durable feedback claim prevents duplicate delivery re-entry');
assert.doesNotMatch(manual,/ownerConfirmSend|KeyboardEvent|requestSubmit|\.click\(/,'normal result insertion remains insert-only');
assert.match(worker,/return autoLoopRequest\(`feedback\/\$\{message\.operation\}`,[\s\S]*feedback_message_id[\s\S]*conversation_id/,'worker forwards durable feedback/remount identity to the server authority');
assert.match(content,/async function refreshAutoLoopStatus\(\)[\s\S]*message\('AUTO_LOOP_STATUS', \{ conversation_id \}\)[\s\S]*autoLoop = value/,'remount reloads durable auto-loop state from the server authority');
assert.match(content,/restoreRuntimeProjection\(\(\) => \{ void refreshAutoLoopStatus\(\);/,'runtime remount triggers durable auto-loop state restoration');
const actionRegistry=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/bridge-action-registry.js'),'utf8');
assert.equal((actionRegistry.match(/actionKey:/g)??[]).length,6,'the frozen six-button action registry remains unchanged');
console.log('M8.2.1.8.4F AICC feedback proven auto-submit matrix passed');
