import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

class FakeEvent { type:string;init?:{bubbles?:boolean};constructor(type:string,init?:{bubbles?:boolean}){this.type=type;this.init=init;} }
const source=readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8');
const context:{AICCChatGPTDom?:Record<string,any>;innerWidth:number;Event:typeof FakeEvent;setTimeout:typeof setTimeout}={innerWidth:1440,Event:FakeEvent,setTimeout};
vm.runInNewContext(source,context);
const dom=context.AICCChatGPTDom!;

const assistantMessage={getAttribute:(name:string)=>name==='data-message-author-role'?'assistant':null};
const writingBlock={textContent:'OWNER UAT Writing Block',value:'OWNER UAT Writing Block',offsetParent:{},getClientRects:()=>[{}],closest:(selector:string)=>selector.includes('assistant')||selector.includes('conversation-turn')?assistantMessage:null,matches:()=>false};
const hiddenFallback={value:'',offsetParent:null,getClientRects:()=>[],closest:(selector:string)=>selector==='form[data-type="unified-composer"]'?composerShell:null,matches:()=>false};
let sendClicks=0;
const sendButton={disabled:false,getAttribute:()=>null,click:()=>{sendClicks+=1;}};
const bottomComposer:any={value:'',offsetParent:{},ownerDocument:{defaultView:{HTMLTextAreaElement:class {}}},getClientRects:()=>[{}],closest:(selector:string)=>selector==='form[data-type="unified-composer"]'?composerShell:null,matches:(selector:string)=>selector.includes('#prompt-textarea')&&selector.includes('contenteditable'),focus(){},dispatchEvent(){}};
const composerShell:any={offsetParent:{},getClientRects:()=>[{}],closest:()=>null,querySelectorAll:()=>[hiddenFallback,bottomComposer],querySelector:(selector:string)=>selector.includes('send-button')?sendButton:null,contains:(node:unknown)=>[hiddenFallback,bottomComposer,sendButton].includes(node)};
const liveDocument={querySelectorAll:(selector:string)=>selector==='form[data-type="unified-composer"]'?[composerShell]:selector.includes('contenteditable')?[writingBlock,bottomComposer]:[],querySelector:()=>null};

assert.equal(dom.resolveCanonicalChatGPTComposer(liveDocument),bottomComposer,'REAL_CHATGPT_BOTTOM_COMPOSER_IS_DESTINATION');
assert.notEqual(dom.resolveCanonicalChatGPTComposer(liveDocument),writingBlock,'REAL_CHATGPT_WRITING_BLOCK_NOT_DESTINATION');
assert.equal(dom.findComposerSendButton(liveDocument,bottomComposer),sendButton,'REAL_CHATGPT_SEND_BOUND_TO_COMPOSER');
assert.equal(dom.insertTextIntoComposer(bottomComposer,'下一步'),true);
assert.equal(dom.ownerConfirmSend(liveDocument,bottomComposer,dom.COMPOSER_ACTION_MODES.OWNER_CONFIRM_SEND),true);
assert.equal(sendClicks,1);
assert.equal(writingBlock.value,'OWNER UAT Writing Block','Assistant Writing Block remains unchanged');

const genericEditable={value:'',offsetParent:{},getClientRects:()=>[{}],closest:()=>null,matches:()=>true};
assert.equal(dom.resolveCanonicalChatGPTComposer({querySelectorAll:(selector:string)=>selector==='form[data-type="unified-composer"]'?[]:[genericEditable]}),null,'generic editable fallback is forbidden');
const assistantShell={...composerShell,closest:(selector:string)=>selector.includes('assistant')?assistantMessage:null};
assert.equal(dom.resolveCanonicalChatGPTComposer({querySelectorAll:()=>[assistantShell]}),null,'composer-like shell inside Assistant output is rejected');
assert.equal(dom.resolveCanonicalChatGPTComposer({querySelectorAll:()=>[composerShell,{...composerShell}]}),null,'ambiguous composer shells fail closed');

const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
assert.match(content,/function composer\(\) \{ return window\.AICCChatGPTDom\.resolveCanonicalChatGPTComposer\(document\); \}/,'actions use one canonical runtime destination resolver');
assert.match(content,/const canonicalTarget = composer\(\);[\s\S]*target !== canonicalTarget/,'result actions revalidate destination immediately before insertion');
assert.match(content,/CANONICAL_COMPOSER_UNAVAILABLE[\s\S]*未插入“下一步”/,'next step fails without mutating another editable node');
assert.doesNotMatch(content,/function composer\(\)[^{]*\{[^}]*querySelector/,'content runtime has no generic editable fallback');

console.log('AICC live ChatGPT composer DOM regression passed');
