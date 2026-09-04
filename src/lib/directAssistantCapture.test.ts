import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const script=readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8');
const context:{}={};vm.runInNewContext(script,context);
const dom=(context as {AICCChatGPTDom:Record<string,any>}).AICCChatGPTDom;
const ordinary='检查当前仓库，不修改任何文件。';
const protocol='AICC_EXECUTION_V1\nINSTRUCTION_BEGIN\n任意原始内容\nINSTRUCTION_END';

assert.equal(dom.actionSurfaces,undefined,'removed Assistant structural action discovery cannot return');
assert.equal(dom.actionPayload,undefined,'removed Assistant structural payload authority cannot return');
assert.equal(typeof dom.mountComposerAiccAction,'function','only the canonical Composer action mount remains executable');
assert.equal(typeof dom.removeChatContentFloatingButtons,'function','historical chat-content action rails remain removable');

const selectedNode={nodeType:1};
const selectedMessage={contains:(node:unknown)=>node===selectedNode,getAttribute:()=>null,id:'assistant-fixture'};
const selectedDocument={
  location:{href:'https://chatgpt.com/c/example',pathname:'/c/example'},
  querySelectorAll:(selector:string)=>selector==='[data-message-author-role="assistant"]'?[selectedMessage]:[]
};
const selection=(text:string)=>({toString:()=>text,anchorNode:selectedNode,focusNode:selectedNode});
assert.equal(dom.selectedPayload(selectedDocument,selection(ordinary))?.text,ordinary,'explicit Assistant selection is passed as-is');
assert.equal(dom.selectedPayload(selectedDocument,selection(protocol))?.text,protocol,'explicit protocol-shaped selection is not reclassified');
assert.equal(dom.selectedPayload(selectedDocument,{toString:()=>'',anchorNode:selectedNode,focusNode:selectedNode}),null,'empty selection never becomes an executable payload');
assert.equal(dom.originContext(selectedDocument,null).conversationUrl,'https://chatgpt.com/c/example');

let removed=0;
const cleanupDocument={querySelectorAll:()=>[{remove(){removed+=1;}},{remove(){removed+=1;}}]};
assert.equal(dom.removeChatContentFloatingButtons(cleanupDocument),2,'legacy chat-content action nodes are removed rather than remounted');
assert.equal(removed,2);
console.log('direct Assistant selection-only capture matrix passed');
