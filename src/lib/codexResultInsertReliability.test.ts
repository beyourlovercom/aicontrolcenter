import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root=process.cwd();
const domSource=readFileSync(join(root,'web-adapter/chatgpt-dom.js'),'utf8');
const content=readFileSync(join(root,'web-adapter/chrome-extension-current/content.js'),'utf8');

class FakeEvent {
  type:string;init?:{bubbles?:boolean};
  constructor(type:string,init?:{bubbles?:boolean}){this.type=type;this.init=init;}
}
const context:{AICCChatGPTDom?:Record<string,any>;innerWidth:number;Event:typeof FakeEvent;setTimeout:typeof setTimeout}={innerWidth:1440,Event:FakeEvent,setTimeout};
vm.runInNewContext(domSource,context);
const dom=context.AICCChatGPTDom!;

let focusCount=0;let inputCount=0;let sendCount=0;
const send={click:()=>{sendCount+=1;}};
const parent={parentElement:null,querySelector:()=>send};
class FakeTextarea {
  value='';parentElement=parent;offsetParent={};ownerDocument:any;
  constructor(){this.ownerDocument={defaultView:{HTMLTextAreaElement:FakeTextarea}};}
  getClientRects(){return [{}];}
  focus(){focusCount+=1;}
  dispatchEvent(event:FakeEvent){if(event.type==='input'&&event.init?.bubbles)inputCount+=1;}
  getAttribute(){return null;}
}

const artifact='AICC_EXECUTION_RESULT_V1\nCODEX_RESULT: PASS';
const copied:string[]=[];const statuses:string[]=[];
const composer=new FakeTextarea();
const inserted=await dom.copyAndInsertResultArtifact(composer,artifact,{writeText:async(text:string)=>{copied.push(text);}},(status:string)=>statuses.push(status));
assert.equal(inserted.copied,true);assert.equal(inserted.inserted,true);assert.equal(inserted.copyError,null);
assert.deepEqual(copied,[artifact],'result is copied before insertion');
assert.equal(composer.value,artifact,'Composer receives the exact result artifact');
assert.equal(focusCount,1,'existing Composer focus handling is preserved');
assert.equal(inputCount,1,'existing bubbling input event is preserved');
assert.deepEqual(statuses,['COPYING','COPIED','INSERTING','INSERTED']);
assert.equal(sendCount,0,'result insertion never sends GPT');

const second=await dom.copyAndInsertResultArtifact(composer,artifact,{writeText:async()=>{}},()=>{});
assert.equal(second.inserted,true);
assert.equal(composer.value,artifact,'repeat insertion does not duplicate Composer content');
assert.equal(inputCount,1,'repeat insertion dispatches no duplicate input event');

const fallbackCopies:string[]=[];const fallbackStatuses:string[]=[];
const fallback=await dom.copyAndInsertResultArtifact(null,artifact,{writeText:async(text:string)=>{fallbackCopies.push(text);}},(status:string)=>fallbackStatuses.push(status));
assert.equal(fallback.copied,true);assert.equal(fallback.inserted,false);
assert.deepEqual(fallbackCopies,[artifact],'missing Composer retains a clipboard recovery copy');
assert.deepEqual(fallbackStatuses,['COPYING','COPIED','INSERTING','COPIED']);

const copyFailure=await dom.copyAndInsertResultArtifact(null,artifact,{writeText:async()=>{throw new Error('denied');}},()=>{});
assert.equal(copyFailure.copied,false);assert.equal(copyFailure.inserted,false);assert.ok(copyFailure.copyError);

assert.match(content,/ResultInsertStatus = Object\.freeze\(\{ READY: 'READY', COPYING: 'COPYING', COPIED: 'COPIED', INSERTING: 'INSERTING', INSERTED: 'INSERTED', COPY_ONLY_FAILED: 'COPY_ONLY_FAILED' \}\)/,'explicit result insertion states are defined');
assert.match(content,/resultInsertStatus = \{ status: ResultInsertStatus\.READY, runId: null, resultId: null, resultSource: null \}/,'status model tracks run, result, and source');
assert.match(content,/actionKey === 'codex-result'[\s\S]*Boolean\(codexExecutionResult\(reportItem\)\?\.rawResult\)/,'Codex button is disabled until a result exists');
assert.doesNotMatch(content,/aiccResultInFlight|data-aicc-action-key="aicc-result"/,'obsolete AICC result button state is removed');
assert.match(content,/Codex 结果处理中…/);
assert.equal((content.match(/await copyAndInsertResult\(/g)??[]).length,2,'Codex and AICC share one result reliability pipeline');
assert.match(content,/GPT 输入框未定位，结果已复制到剪贴板/);
assert.match(content,/结果已复制并插入 GPT 输入框/);
assert.match(content,/insertedResultIds\.has\(identity\)/,'same result is inserted at most once');
assert.doesNotMatch(content.match(/async function copyAndInsertResult[\s\S]*?(?=async function deliverCanonicalResult)/)?.[0]??'',/ownerConfirmSend|KeyboardEvent|requestSubmit|\.click\(/,'result pipeline cannot submit GPT');
assert.match(content,/const AICC_DECISION_AUTHORITY = 0/);

console.log('M8.2.1.4 Codex result insertion reliability matrix passed');
