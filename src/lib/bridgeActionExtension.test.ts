import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const domSource=readFileSync(join(root,'web-adapter/chatgpt-dom.js'),'utf8');
const content=readFileSync(join(root,'web-adapter/chrome-extension-current/content.js'),'utf8');
const registry=readFileSync(join(root,'web-adapter/chrome-extension-current/bridge-action-registry.js'),'utf8');
const worker=readFileSync(join(root,'web-adapter/chrome-extension-current/service-worker.js'),'utf8');
class FakeEvent {
  type:string;init?:{bubbles?:boolean};
  constructor(type:string,init?:{bubbles?:boolean}){this.type=type;this.init=init;}
}
const context:{AICCChatGPTDom?:Record<string,any>;innerWidth:number;Event:typeof FakeEvent;setTimeout:typeof setTimeout}={innerWidth:1440,Event:FakeEvent,setTimeout};
vm.runInNewContext(domSource,context);
const dom=context.AICCChatGPTDom!;

assert.equal(typeof dom.mountAssistantAiccActions,'undefined','assistant content mount is removed');
assert.equal(typeof dom.mountComposerAiccAction,'function','Composer mount remains available');
assert.equal(typeof dom.removeChatContentFloatingButtons,'function','old chat-content buttons can be cleaned');
assert.doesNotMatch(domSource,/function mountAssistantAiccActions|function actionSurfaces/,'chat-content discovery and mounting are removed');
assert.match(domSource,/function mountComposerAiccAction/,'Composer maintenance remains');

for(const label of ['发送到 Codex 并执行','插入 Codex 结果','发送到 AICC','执行下一步'])assert.match(registry,new RegExp(label));
assert.doesNotMatch(content,/插入 AICC 结果/,'obsolete AICC result action is removed');
assert.doesNotMatch(content,/mountAssistantAiccActions/,'content script never mounts assistant chat buttons');
assert.match(content,/removeChatContentFloatingButtons\(document\)/,'content script cleans historical chat buttons');
assert.match(content,/mountComposerAiccAction\(document/,'content script maintains the Composer button');
assert.match(content,/function hasExternalDomMutation\(records\)/,'only external DOM changes schedule Composer maintenance');
assert.match(content,/if \(!hasExternalDomMutation\(records\)\) return;/,'Bridge-owned DOM writes cannot retrigger mounting');
for(const key of ['codex-execute','codex-result','aicc-send','next-step'])assert.equal((registry.match(new RegExp(`actionKey: '${key}'`,'g'))??[]).length,1,`${key} is registered once`);
assert.match(content,/stack\.dataset\.aiccActionSignature !== signature/,'the primary action bar is projected from the registry only when its structure changes');
assert.match(content,/stack\.innerHTML = visibleActions\.map/,'the primary action bar remains projected from the registry');
assert.doesNotMatch(content,/data-aicc-action-key="aicc-result"/,'obsolete AICC result action key is removed');
assert.match(registry,/actionKey: 'next-step',[\s\S]*displayOrdinal: 5/,'next step keeps its action identity while taking visual ordinal five');
assert.match(content,/executeCurrentWithCodex[\s\S]*sendTask\(binding\.text, binding\.originContext, 'Current Executable', 'IMPORT_AND_RUN'(?:, [^)]+)?\)/,'Codex action reuses IMPORT_AND_RUN');
assert.match(worker,/async function importAndRun\(message\) \{\s*return sendInstruction\(message\);\s*\}/,'Codex import-and-run uses the canonical inbox submission path');
assert.equal((worker.match(/api\/gpt-bridge\/launch/g)??[]).length,0,'extension does not reintroduce the obsolete two-step launch race');
assert.match(content,/insertCodexResult[\s\S]*pollResult\(false\)[\s\S]*deliverCanonicalResult\(\)/,'Codex result action reuses polling and canonical delivery');
assert.match(content,/deliverCanonicalResult[\s\S]*copyAndInsertResult\(envelope/,'Codex result uses the shared reliable result path');
assert.match(domSource,/copyAndInsertResultArtifact[\s\S]*insertTextIntoComposer\(node, artifact\)/,'reliable result path preserves the existing Composer adapter');
assert.match(content,/const CODEX_EXECUTION_RESULT = 'AICC_EXECUTION_RESULT_V1'/,'Codex result action binds the canonical result source');
assert.equal(typeof dom.bridgeReportText,'function','AICC report formatter is exposed to the production content script');
assert.match(content,/function reportText\(item\) \{\s*return window\.AICCChatGPTDom\.bridgeReportText\(item\);\s*\}/,'AICC result action uses the canonical formatted report');
const aiccReport=dom.bridgeReportText({runId:'run-aicc-5',report:{entityId:'WP-5',executionType:'UI_REMEDIATION',status:'COMPLETED',gateResult:'PASS',summary:'AICC formatted summary',canonicalResult:{rawResult:'CODEX RAW RESULT'}}});
assert.match(aiccReport,/^AICC_RUN_REPORT_V1\nRun ID: run-aicc-5/m,'AICC result keeps its report artifact identity');
assert.match(aiccReport,/Summary:\nAICC formatted summary/,'AICC result retains the formatted report summary');
assert.doesNotMatch(aiccReport,/^CODEX RAW RESULT$/m,'AICC result is not replaced by the raw Codex result');
assert.match(content,/executeNextStep[\s\S]*insertTextIntoComposer\(target, '下一步'\)[\s\S]*OWNER_CONFIRM_SEND/,'next-step action inserts the fixed text before owner send');
assert.match(content,/if \(nextStepInFlight\) return/,'next-step duplicate clicks are blocked');
assert.match(content,/if \(codexExecutionInFlight\) return/,'Codex duplicate clicks are blocked');
assert.match(content,/const AICC_DECISION_AUTHORITY = 0/);

let sendCount=0;let focusCount=0;let inputCount=0;
const send={disabled:false,getAttribute:()=>null,click:()=>{sendCount+=1;}};
let composer:any;
const scope:any={offsetParent:{},parentElement:null,querySelector:(selector:string)=>selector.includes('send-button')?send:null,querySelectorAll:()=>[composer],contains:(node:unknown)=>node===send||node===composer,closest:()=>null};
class FakeTextarea {
  value='';parentElement=scope;offsetParent={};ownerDocument:any;
  constructor(){this.ownerDocument={defaultView:{HTMLTextAreaElement:FakeTextarea}};}
  getClientRects(){return [{}];}
  focus(){focusCount+=1;}
  dispatchEvent(event:FakeEvent){if(event.type==='input'&&event.init?.bubbles)inputCount+=1;}
  getAttribute(){return null;}
  closest(selector:string){return selector==='form[data-type="unified-composer"]'?scope:null;}
  matches(selector:string){return selector.includes('#prompt-textarea');}
}
composer=new FakeTextarea();
const document={querySelectorAll:(selector:string)=>selector==='form[data-type="unified-composer"]'?[scope]:[],querySelector:()=>null};
assert.equal(dom.insertTextIntoComposer(composer,'下一步'),true,'next step text inserts through the canonical Composer adapter');
assert.equal(composer.value,'下一步');
assert.equal(inputCount,1,'next step insertion dispatches one bubbling input event');
const resultComposer=new FakeTextarea();
assert.equal(dom.insertTextIntoComposer(resultComposer,'AICC_EXECUTION_RESULT_V1\nCODEX_RESULT: PASS'),true,'Codex result inserts through the existing adapter');
assert.equal(sendCount,0,'Codex result insertion never sends GPT');
assert.equal(dom.ownerConfirmSend(document,composer,dom.COMPOSER_ACTION_MODES.INSERT_ONLY),false,'INSERT_ONLY never sends');
assert.equal(sendCount,0);
assert.equal(dom.ownerConfirmSend(document,composer,dom.COMPOSER_ACTION_MODES.OWNER_CONFIRM_SEND),true,'explicit owner mode sends');
assert.equal(sendCount,1,'one owner action triggers one send');
assert.equal(focusCount,2,'only Composer insertions focus the target; native owner send preserves its existing behavior');
send.disabled=true;
assert.equal(dom.ownerConfirmSend(document,composer,dom.COMPOSER_ACTION_MODES.OWNER_CONFIRM_SEND),false,'disabled native send is not triggered');
assert.equal(sendCount,1);

// Source and destination are deliberately different roles. An Assistant Writing
// Block is never eligible as the return destination.
const assistantBlock={value:'AICC_EXECUTION_V1\nSOURCE\nINSTRUCTION_END',offsetParent:{},closest:(selector:string)=>selector.includes('assistant')?assistantMessage:null};
const assistantMessage={};
const hiddenFallback={value:'',offsetParent:null,getClientRects:()=>[],closest:(selector:string)=>selector==='form[data-type="unified-composer"]'?liveShell:null,matches:()=>false};
const bottomComposer:any={value:'',offsetParent:{},closest:(selector:string)=>selector==='form[data-type="unified-composer"]'?liveShell:selector.includes('assistant')?null:null,matches:(selector:string)=>selector.includes('#prompt-textarea'),focus(){},dispatchEvent(){}};
const liveShell:any={offsetParent:{},closest:()=>null,querySelectorAll:()=>[hiddenFallback,bottomComposer],querySelector:(selector:string)=>selector.includes('send-button')?send:null,contains:(node:unknown)=>[hiddenFallback,bottomComposer,send].includes(node)};
const fixtureDocument={
  querySelectorAll:(selector:string)=>selector==='form[data-type="unified-composer"]'?[liveShell]:[],
  querySelector:()=>null
};
assert.equal(dom.resolveCanonicalChatGPTComposer(fixtureDocument),bottomComposer,'canonical destination is the bottom composer');
assert.notEqual(dom.resolveCanonicalChatGPTComposer({querySelectorAll:(selector:string)=>selector==='form[data-type="unified-composer"]'?[]:[assistantBlock]}),assistantBlock,'Assistant Writing Block cannot be a destination');
const arbitraryEditable={value:'latest editable',offsetParent:{},closest:()=>null};
assert.equal(dom.resolveCanonicalChatGPTComposer({querySelectorAll:(selector:string)=>selector==='form[data-type="unified-composer"]'?[]:[arbitraryEditable]}),null,'arbitrary editable without the canonical shell is not a destination');
const assistantWritingBlock={value:'assistant artifact',offsetParent:{},closest:()=>assistantMessage};
assert.equal(dom.resolveCanonicalChatGPTComposer({querySelectorAll:(selector:string)=>selector.includes('contenteditable')?[assistantWritingBlock]:[]}),null,'Assistant Writing Block cannot be a destination even without a role selector');
assert.equal(dom.resolveCanonicalChatGPTComposer({querySelectorAll:()=>[]}),null,'missing composer does not fall back to an editable surface');
send.disabled=false;
const canonicalTarget=dom.resolveCanonicalChatGPTComposer(fixtureDocument);
const clipboard={writeText:async()=>{}};
const assistantBefore=assistantBlock.value;
const codexOutcome=await dom.copyAndInsertResultArtifact(canonicalTarget,'AICC_EXECUTION_RESULT_V1\nCODEX_RESULT: PASS',clipboard);
assert.equal(codexOutcome.inserted,true,'Codex result inserts into the canonical bottom composer');
assert.equal(assistantBlock.value,assistantBefore,'Codex result does not mutate the Assistant Writing Block');
bottomComposer.value='';
const aiccOutcome=await dom.copyAndInsertResultArtifact(canonicalTarget,'AICC_RUN_REPORT_V1\nAICC_RESULT: PASS',clipboard);
assert.equal(aiccOutcome.inserted,true,'AICC result inserts into the canonical bottom composer');
assert.equal(assistantBlock.value,assistantBefore,'AICC result does not mutate the Assistant Writing Block');
bottomComposer.value='';
assert.equal(dom.insertTextIntoComposer(canonicalTarget,'下一步'),true,'next step inserts into the canonical bottom composer');
assert.equal(dom.ownerConfirmSend(fixtureDocument,canonicalTarget,dom.COMPOSER_ACTION_MODES.OWNER_CONFIRM_SEND),true,'next step uses the Send control bound to the canonical composer');
const unrelatedSend={disabled:false,click(){sendCount+=1;}};
const unboundShell:any={offsetParent:{},closest:()=>null,querySelector:()=>null,querySelectorAll:()=>[unboundComposer],contains:()=>false};
const unboundComposer={value:'',offsetParent:{},closest:(selector:string)=>selector==='form[data-type="unified-composer"]'?unboundShell:null,matches:()=>true};
const unboundDocument={querySelectorAll:(selector:string)=>selector==='form[data-type="unified-composer"]'?[unboundShell]:[],querySelector:()=>unrelatedSend};
assert.equal(dom.findComposerSendButton(unboundDocument,unboundComposer),null,'an unrelated page-level Send button is not a composer destination');

assert.doesNotMatch(content,/setInterval\([^)]*executeNextStep|pollResult[\s\S]{0,120}ownerConfirmSend/,'background activity cannot trigger owner send');
assert.equal((content.match(/ownerConfirmSend\(document, target, window\.AICCChatGPTDom\.COMPOSER_ACTION_MODES\.OWNER_CONFIRM_SEND\)/g)??[]).length,1,'next-step owner send has one explicit call site');
console.log('M8.2.1 bridge action extension matrix passed');
