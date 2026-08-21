import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

type Listener=(event:{preventDefault():void;stopPropagation():void})=>void;

class FakeNode {
  tag:string;
  dataset:Record<string,string>={};
  children:FakeNode[]=[];
  parentElement:FakeNode|null=null;
  isConnected=true;
  nodeType=1;
  className='';
  innerHTML='';
  innerText='';
  textContent='';
  id='';
  style:Record<string,string>={};
  ownerDocument:FakeDocument|null=null;
  private attrs=new Map<string,string>();
  private listeners=new Map<string,Listener>();
  constructor(tag='div',text=''){this.tag=tag;this.innerText=text;this.textContent=text;}
  appendChild(child:FakeNode){child.parentElement=this;child.isConnected=true;this.children.push(child);return child;}
  remove(){this.isConnected=false;if(this.parentElement)this.parentElement.children=this.parentElement.children.filter(item=>item!==this);}
  contains(node:FakeNode|null):boolean{return node===this||this.children.some(child=>child.contains(node));}
  setAttribute(name:string,value:string){this.attrs.set(name,value);if(name==='id')this.id=value;}
  getAttribute(name:string){return this.attrs.get(name)??null;}
  matches(selector:string){return selector.split(',').some(part=>{const value=part.trim();return value==='pre'&&this.tag==='pre'||value==='code'&&this.tag==='code'||value==='[data-writing-block]'&&this.attrs.has('data-writing-block')||value==='[data-aicc-executable="true"]'&&this.attrs.get('data-aicc-executable')==='true';});}
  querySelector(selector:string):FakeNode|null{return this.querySelectorAll(selector)[0]??null;}
  querySelectorAll(selector:string):FakeNode[]{
    const all=this.children.flatMap(child=>[child,...child.querySelectorAll('*')]);
    if(selector==='*')return all;
    if(selector==='[data-aicc-action="assistant"]')return all.filter(node=>node.dataset.aiccAction==='assistant');
    if(selector==='[data-aicc-action-error]')return all.filter(node=>node.dataset.aiccActionError==='true');
    return [];
  }
  addEventListener(type:string,listener:Listener){this.listeners.set(type,listener);}
  click(){this.listeners.get('click')?.({preventDefault(){},stopPropagation(){}});}
  getBoundingClientRect(){return {left:100,right:500,top:100,width:80,height:32};}
}

class MessageNode extends FakeNode {
  surfaces:FakeNode[];
  constructor(surfaces:FakeNode[],id:string){super('article');this.surfaces=surfaces;this.setAttribute('data-message-id',id);surfaces.forEach(surface=>this.appendChild(surface));}
  override querySelectorAll(selector:string){
    if(selector==='pre')return this.surfaces.filter(surface=>surface.tag==='pre');
    if(selector==='code')return this.surfaces.filter(surface=>surface.tag==='code');
    if(selector.includes('data-writing-block'))return this.surfaces.filter(surface=>surface.getAttribute('data-writing-block')!==null);
    if(selector==='[data-aicc-executable="true"]')return this.surfaces.filter(surface=>surface.getAttribute('data-aicc-executable')==='true');
    return super.querySelectorAll(selector);
  }
}

class FakeDocument {
  body=new FakeNode('body');head=new FakeNode('head');location={href:'https://chatgpt.com/c/phase6',pathname:'/c/phase6'};
  messages:MessageNode[]=[];
  createElement(tag:string){const node=new FakeNode(tag);node.ownerDocument=this;return node;}
  querySelector(selector:string){if(selector==='[data-aicc-bridge-style]')return this.head.children.find(node=>node.dataset.aiccBridgeStyle==='true')??null;return this.querySelectorAll(selector)[0]??null;}
  querySelectorAll(selector:string):FakeNode[]{
    if(selector.includes('data-message-author-role')||selector.includes('conversation-turn'))return this.messages;
    const all=this.body.children.flatMap(child=>[child,...child.querySelectorAll('*')]);
    if(selector==='[data-aicc-action-rail]')return all.filter(node=>node.dataset.aiccActionRail==='true');
    if(selector==='[data-aicc-action="assistant"]')return all.filter(node=>node.dataset.aiccAction==='assistant');
    if(selector==='[data-aicc-action-error]')return all.filter(node=>node.dataset.aiccActionError==='true');
    return [];
  }
}

const root=process.cwd();
const domSource=readFileSync(join(root,'web-adapter/chatgpt-dom.js'),'utf8');
const content=readFileSync(join(root,'web-adapter/chrome-extension-current/content.js'),'utf8');
const worker=readFileSync(join(root,'web-adapter/chrome-extension-current/service-worker.js'),'utf8');
const context:{AICCChatGPTDom?:Record<string,Function>;innerWidth:number}={innerWidth:1440};vm.runInNewContext(domSource,context);
const dom=context.AICCChatGPTDom!;
const protocol='AICC_EXECUTION_V1\nINSTRUCTION_ID: phase6-browser\nINSTRUCTION_BEGIN\n检查当前仓库\nINSTRUCTION_END';

const document=new FakeDocument();
document.messages=[new MessageNode([], 'ordinary')];
dom.mountAssistantAiccActions(document,()=>null);
assert.equal(document.querySelectorAll('[data-aicc-action-rail]').length,0,'ordinary prose creates no floating action');

const pre=new FakeNode('pre',protocol);const nestedCode=new FakeNode('code',protocol);pre.appendChild(nestedCode);
document.messages=[new MessageNode([pre,nestedCode], 'executable')];
dom.mountAssistantAiccActions(document,()=>null);
assert.equal(document.querySelectorAll('[data-aicc-action-rail]').length,1,'nested executable children reconcile to one canonical action');
dom.mountAssistantAiccActions(document,()=>null);
assert.equal(document.querySelectorAll('[data-aicc-action-rail]').length,1,'rescan does not duplicate the action');

let exactPayload='';let importCount=0;
dom.mountAssistantAiccActions(document,(text:string)=>{exactPayload=text;importCount+=1;return {item:{state:'LAUNCHED'}};});
document.querySelectorAll('[data-aicc-action="assistant"]')[0].click();
await Promise.resolve();
assert.equal(exactPayload,protocol,'inline action captures the exact canonical block');
assert.equal(importCount,1,'one click invokes importAndRun exactly once');

const failureDocument=new FakeDocument();const failurePre=new FakeNode('pre',protocol);failureDocument.messages=[new MessageNode([failurePre],'failure')];
dom.mountAssistantAiccActions(failureDocument,()=>Promise.reject({code:'AICC_HTTP_503',reason:'本地服务不可用'}));
failureDocument.querySelectorAll('[data-aicc-action="assistant"]')[0].click();
await new Promise(resolve=>setTimeout(resolve,0));
const visibleFailure=failureDocument.querySelectorAll('[data-aicc-action-error]')[0];
assert.match(visibleFailure.textContent,/AICC_HTTP_503/,'inline failure exposes transport code');
assert.match(visibleFailure.textContent,/本地服务不可用/,'inline failure exposes transport reason');

const rerenderedPre=new FakeNode('pre',protocol);document.messages=[new MessageNode([rerenderedPre], 'executable')];
dom.mountAssistantAiccActions(document,()=>null);
assert.equal(document.querySelectorAll('[data-aicc-action-rail]').length,1,'rerender preserves one action identity');
document.messages=[];dom.mountAssistantAiccActions(document,()=>null);
assert.equal(document.querySelectorAll('[data-aicc-action-rail]').length,0,'removed surface removes the orphan action');

const selectionSurface=new FakeNode('pre',protocol);const selectedChild=new FakeNode('span','检查当前仓库');selectionSurface.appendChild(selectedChild);document.messages=[new MessageNode([selectionSurface], 'selected')];
const selected=dom.selectedExecutablePayload(document,{toString:()=> '检查当前仓库',anchorNode:selectedChild,focusNode:selectedChild});
assert.equal(selected.text,protocol,'explicit selection binds the exact executable surface');

const signatureOnlyMessage=new MessageNode([], 'signature-only');signatureOnlyMessage.innerText=protocol;signatureOnlyMessage.textContent=protocol;
document.messages=[signatureOnlyMessage];dom.mountAssistantAiccActions(document,()=>null);
assert.equal(document.querySelectorAll('[data-aicc-action-rail]').length,1,'standalone protocol signature is recognized without fragile code classes');

assert.doesNotMatch(content,/resolveTaskSource\(document/,'right panel never falls back to latest Assistant text');
assert.match(content,/selectedExecutablePayload/);
assert.match(content,/navigator\.clipboard\.readText\(\)/,'clipboard is read only through explicit send interaction');
assert.match(content,/if \(explicitPayloadBinding\?\.text[\s\S]*source: '已选指令'[\s\S]*inboundClipboardBinding/,'explicit binding outranks clipboard payload');
assert.match(content,/data-aicc-payload-state="GHOST"/,'no known payload keeps the right-panel send button visually ghosted');
assert.match(content,/inboundClipboardBinding = \{ text: String\(text\)/,'clipboard payload is retained exactly');
assert.doesNotMatch(content,/text = String\(text\)\.trim\(\)/,'clipboard payload is not rewritten before transport');
assert.match(content,/CLIPBOARD_READ_DENIED/);assert.match(content,/CLIPBOARD_TEXT_REQUIRED/);
assert.equal((content.match(/copyAndInsertResult\(envelope/g)??[]).length,1,'one canonical envelope delivery call');
assert.match(domSource,/copyAndInsertResultArtifact[\s\S]*clipboard\.writeText\(artifact\)[\s\S]*insertTextIntoComposer\(node, artifact\)/,'canonical adapter copies before best-effort insertion');
const returnBody=content.match(/async function deliverCanonicalResult\(\)[\s\S]*?(?=function reportText)/)?.[0]??'';
assert.doesNotMatch(returnBody,/reportFormatPresent|verifyComposerText/,'return transport does not judge existing Composer content');
assert.match(returnBody,/returnInFlight/);assert.match(content,/attemptedReturnIds/);assert.match(content,/returnState === 'RESULT_READY'/);assert.match(worker,/claimGranted !== true/);
assert.doesNotMatch(content,/button\[type="submit"\]|KeyboardEvent|\.submit\(|requestSubmit\(|\.click\(\)/,'result return never auto-sends ChatGPT');
assert.doesNotMatch(content,/latestAssistantMessage|latestMessage|lastAssistant|mostRecentAssistant/);
console.log('M4.1 Phase 6 browser remediation matrix passed');
