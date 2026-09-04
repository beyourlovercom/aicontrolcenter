import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const probe='AICC_AUTO_SUBMIT_PROBE_V1\nPROBE_ID = aicc-auto-submit-probe-004';
const conversationId='auto-submit-conversation';

class FakeNode {
  id=''; value=''; innerText=''; textContent=''; isConnected=true; offsetParent={}; parentElement:FakeNode|null=null; disabled=false; clickCount=0;
  attributes=new Map<string,string>(); children:FakeNode[]=[]; ownerDocument:FakeDocument|null=null; clickBehavior:(()=>void)|null=null;
  dispatchCount=0; dispatchBehavior:(()=>void)|null=null;
  focus(){} dispatchEvent(){this.dispatchCount+=1;this.dispatchBehavior?.();return true;} cloneNode(){return this;} querySelectorAll(selector:string){if(selector==='#prompt-textarea[contenteditable="true"], textarea[name="prompt-textarea"]')return this.children.filter(child=>child===this.ownerDocument?.composer);return [];} getClientRects(){return [1];}
  getAttribute(name:string){return this.attributes.get(name)??null;} setAttribute(name:string,value:string){this.attributes.set(name,value);}
  querySelector(selector:string){return selector==='[data-testid="send-button"], #composer-submit-button, button[type="submit"]'?this.children.find(child=>child===this.ownerDocument?.sendButton)??null:null;}
  closest(selector:string){return selector==='form[data-type="unified-composer"]'?this.parentElement:null;}
  matches(selector:string){return selector==='#prompt-textarea[contenteditable="true"][role="textbox"]'&&this.id==='prompt-textarea';}
  contains(node:FakeNode):boolean{return node===this||this.children.some(child=>child===node||child.contains(node));}
  click(){this.clickCount+=1;this.clickBehavior?.();}
}
class FakeDocument {
  location={href:`https://chatgpt.com/c/${conversationId}`,pathname:`/c/${conversationId}`}; defaultView={}; users:FakeNode[]=[]; composer:FakeNode|null=null; sendButton:FakeNode|null=null; sendSelector='testid';
  querySelectorAll(selector:string){if(selector.includes('message-author-role="user"'))return this.users;if(selector==='form[data-type="unified-composer"]')return this.composer?.parentElement?[this.composer.parentElement]:[];if(selector==='[contenteditable="true"]')return [];if(selector==='textarea')return this.composer?[this.composer]:[];return [];}
  querySelector(selector:string){if(selector==='[data-testid="send-button"]'&&this.sendSelector==='testid')return this.sendButton;if(selector==='#composer-submit-button'&&this.sendSelector==='id')return this.sendButton;return null;}
}

function harness(options:{conversation?:string;composer?:boolean;send?:boolean;disabled?:boolean;confirm?:boolean;throwOnClick?:boolean;rerenderSend?:boolean;sendSelector?:'testid'|'id'}={}){
  const document=new FakeDocument();
  const activeConversation=options.conversation??conversationId;
  document.location={href:`https://chatgpt.com/c/${activeConversation}`,pathname:`/c/${activeConversation}`};
  const context:{AICCChatGPTDom?:Record<string,any>;document:FakeDocument;location:FakeDocument['location'];Event:typeof Event;setTimeout:typeof setTimeout;TextEncoder:typeof TextEncoder;crypto:Crypto}={document,location:document.location,Event,setTimeout,TextEncoder,crypto:globalThis.crypto};
  vm.runInNewContext(readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8'),context);
  if(options.composer!==false){
    const parent=new FakeNode();parent.ownerDocument=document;
    const composer=new FakeNode();composer.id='prompt-textarea';composer.ownerDocument=document;document.composer=composer;composer.parentElement=parent;parent.children=[composer];
    if(options.send!==false){
      const send=new FakeNode();send.ownerDocument=document;send.disabled=options.disabled===true;parent.children=[composer,send];document.sendButton=send;document.sendSelector=options.sendSelector??'testid';
      const confirmSubmission=()=>{
        if(options.throwOnClick)throw new Error('click failed');
        if(options.confirm===false)return;
        const user=new FakeNode();delete (user as {value?:string}).value;user.innerText=probe;user.textContent=probe;user.setAttribute('data-message-id','probe-user-message-001');document.users=[user];composer.value='';
      };
      send.clickBehavior=confirmSubmission;
      if(options.rerenderSend) composer.dispatchBehavior=()=>{const freshSend=new FakeNode();freshSend.ownerDocument=document;freshSend.clickBehavior=confirmSubmission;parent.children=[composer,freshSend];document.sendButton=freshSend;};
    }
  }
  return {document,dom:context.AICCChatGPTDom!};
}

function assertCanonicalFixtureReady(value:ReturnType<typeof harness>){
  const condition=value.dom.liveComposerSendCondition(value.document,true);
  assert.equal(condition.composer,value.document.composer,'fixture mounts the canonical Composer before invocation');
  assert.equal(condition.sendButton,value.document.sendButton,'fixture mounts the scoped Send control before invocation');
  assert.equal(condition.ready,true,'fixture starts with a ready canonical Composer and Send control');
}

const success=harness();
assertCanonicalFixtureReady(success);
const first=await success.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:'aicc-auto-submit-probe-004'});
assert.equal(first.submissionId,'aicc-auto-submit-probe-004');
assert.equal(first.userMessageId,'probe-user-message-001');
assert.equal(first.userMessage?.innerText,probe,'the canonical primitive confirms the exact submitted User message');
assert.equal(success.document.composer?.value,'','confirmed submission clears the pending probe');
const send=success.document.sendButton;
assert.equal(send?.clickCount,1,'the native Send control is clicked exactly once per canonical invocation');

async function failureCode(options:Parameters<typeof harness>[0],overrides:Record<string,unknown>={}){
  const value=harness(options);
  try{await value.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:`failure-${Math.random()}`,...overrides});assert.fail('expected submit failure');}
  catch(error){const failure=error as {code?:string;message?:string};return failure.code??failure.message;}
}
assert.equal(await failureCode({conversation:'other-conversation'}),'EXACT_CONVERSATION_REQUIRED');
assert.equal(await failureCode({composer:false},{composerReadyTimeoutMs:10,composerReadyPollIntervalMs:1}),'COMPOSER_SEND_NOT_READY');
const unrelated=harness();unrelated.document.composer!.value='Owner draft';
const appended=await unrelated.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:'unrelated'});
assert.equal(appended.userMessageId,'probe-user-message-001','an existing draft is preserved while the canonical payload is appended');
const postInsertMutation=harness();postInsertMutation.document.composer!.dispatchEvent=()=>{postInsertMutation.document.composer!.value='changed';return true;};
await assert.rejects(postInsertMutation.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:'post-insert-mutation',composerReadyTimeoutMs:10,composerReadyPollIntervalMs:1}),(error:any)=>error.message==='FEEDBACK_COMPOSER_INSERT_FAILED');
assert.equal(postInsertMutation.document.sendButton?.clickCount,0,'a failed canonical insertion never clicks Send');

const delayedReady=harness();
const delayedComposer=delayedReady.document.composer!;
const originalDelayedDispatch=delayedComposer.dispatchEvent.bind(delayedComposer);
delayedComposer.dispatchEvent=()=>{originalDelayedDispatch();delayedComposer.value='';setTimeout(()=>{delayedComposer.value=probe;},55);return true;};
await assert.rejects(delayedReady.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:'condition-ready',composerReadyTimeoutMs:500,composerReadyPollIntervalMs:50}),(error:any)=>error.message==='FEEDBACK_COMPOSER_INSERT_FAILED');
assert.equal(delayedComposer.dispatchCount,1,'insertion is attempted once and is not retried after an insertion failure');
assert.equal(delayedReady.document.sendButton?.clickCount,0,'a failed insertion never clicks Send');

const delayedEnabled=harness({disabled:true});
setTimeout(()=>{delayedEnabled.document.sendButton!.disabled=false;},55);
await delayedEnabled.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:'send-enabled-ready',composerReadyTimeoutMs:500,composerReadyPollIntervalMs:50});
assert.equal(delayedEnabled.document.sendButton?.clickCount,1,'polling clicks once when the current live Send button becomes enabled');

const neverReady=harness({send:false});
await assert.rejects(neverReady.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:'never-ready',composerReadyTimeoutMs:10,composerReadyPollIntervalMs:1}),(error:any)=>error.message==='COMPOSER_SEND_NOT_READY');
assert.equal(neverReady.document.sendButton?.clickCount??0,0,'the bounded timeout fails closed without clicking');
assert.equal(await failureCode({disabled:true},{composerReadyTimeoutMs:10,composerReadyPollIntervalMs:1}),'COMPOSER_SEND_NOT_READY');
assert.equal(await failureCode({throwOnClick:true}),'click failed');
assert.equal(await failureCode({confirm:false}),'GPT_FEEDBACK_MESSAGE_NOT_CONFIRMED');

const recoveredInsertion=harness();recoveredInsertion.document.composer!.value=probe;
await recoveredInsertion.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:'recover-inserted-probe'});
assert.equal(recoveredInsertion.document.composer!.dispatchCount,0,'an exact pending payload is not inserted twice');
assert.equal(recoveredInsertion.document.sendButton?.clickCount,1,'an exact pending payload proceeds directly to the canonical Send control');

const rerendered=harness({rerenderSend:true});
const staleSend=rerendered.document.sendButton!;
await rerendered.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:'rerendered-send'});
const freshSend=rerendered.document.sendButton!;
assert.notEqual(freshSend,staleSend,'composer insertion rerenders the Send control');
assert.equal(staleSend.clickCount,0,'the stale pre-insert Send control is never actuated');
assert.equal(freshSend.clickCount,1,'the fresh enabled Send control is actuated once');

const callbackRerender=harness();
const callbackStaleSend=callbackRerender.document.sendButton!;
const callbackFreshSend=new FakeNode();
callbackFreshSend.ownerDocument=callbackRerender.document;callbackFreshSend.clickBehavior=callbackStaleSend.clickBehavior;
await callbackRerender.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:'callback-rerendered-send',beforeSubmit:()=>{callbackRerender.document.sendButton=callbackFreshSend;callbackRerender.document.composer!.parentElement!.children=[callbackRerender.document.composer!,callbackFreshSend];}});
assert.equal(callbackStaleSend.clickCount,0,'the pre-claim Send control is never actuated after a callback rerender');
assert.equal(callbackFreshSend.clickCount,1,'the Send control is resolved fresh immediately before the click');

const fallback=harness({sendSelector:'id'});
await fallback.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:'composer-submit-fallback'});
assert.equal(fallback.document.sendButton?.clickCount,1,'the #composer-submit-button fallback is clicked once');

const existing=harness();
const existingMessage=new FakeNode();delete (existingMessage as {value?:string}).value;existingMessage.innerText=probe;existingMessage.textContent=probe;existingMessage.setAttribute('data-message-id','existing-probe');existing.document.users=[existingMessage];
const reconciled=await existing.dom.submitChatGPTComposerOnce({conversationId,payload:probe,submissionId:'reload-probe'});
assert.equal(reconciled.userMessageId,'probe-user-message-001','the canonical primitive returns the exact User message confirmed after Send');
assert.equal(existing.document.sendButton?.clickCount,1);

const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
assert.equal((content.match(/submitChatGPTComposerOnce\(/g)??[]).length,3,'auto-loop, result footer, and explicit clipboard send each use the canonical primitive once');
assert.match(content,/submitChatGPTComposerOnce\(\{[\s\S]*conversationId: loop\.conversation_id,[\s\S]*payload: feedback\.envelope,[\s\S]*submissionId: feedback\.feedback_id/);
assert.match(content,/async function insertLatestResultToGpt\(\)[\s\S]*submitChatGPTComposerOnce\(\{[\s\S]*payload: result\.text/,'the footer action submits only through the canonical primitive');
assert.match(content,/async function pasteClipboardAndSendToChatGpt\(\)[\s\S]*submitChatGPTComposerOnce\(\{[\s\S]*payload: clipboardText/,'the explicit clipboard action submits only through the canonical primitive');
const panelTemplate=content.match(/panel\.innerHTML = '([^']+)'/)?.[1]??'';
assert.equal((panelTemplate.match(/data-aicc-action-button/g)??[]).length,0,'the footer action remains outside the primary action registry');
console.log('M8.2.1.8.4A ChatGPT auto-submit primitive tests passed');
