import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {WebBridgeClient,reportForComposer} from './webBridgeAdapter.ts';

const payload='This is ordinary natural language, not an execution-shaped instruction.';
const sent:string[]=[];
let counter=0;
const client=new WebBridgeClient({fetchImpl:async (_url,init)=>{
  sent.push(String(init?.body));
  counter+=1;
  return new Response(JSON.stringify({item:{id:`inbox-${counter}`,state:'READY',instruction:{instructionId:`instruction-${counter}`}}}),{status:200});
}});
const first=await client.sendInstruction(payload);
const second=await client.sendInstruction(payload);
assert.equal(sent.length,2,'two explicit actions transfer twice');
assert.equal(JSON.parse(sent[0]).payload,payload,'payload is not rewritten');
assert.equal(JSON.parse(sent[1]).payload,payload,'identical second payload is not deduplicated');
assert.notEqual(first.correlation.inboxId,second.correlation.inboxId,'each action has its own transport record');
assert.equal(reportForComposer({id:'outbox',state:'READY',inboxId:'inbox',report:{canonicalResult:{rawResult:'FAILED\nraw Codex result'}}}),'FAILED\nraw Codex result','canonical result remains raw');

const root=process.cwd();
const content=readFileSync(`${root}/web-adapter/chrome-extension-current/content.js`,'utf8');
const worker=readFileSync(`${root}/web-adapter/chrome-extension-current/service-worker.js`,'utf8');
const dom=readFileSync(`${root}/web-adapter/chrome-extension-current/chatgpt-dom.js`,'utf8');
assert.doesNotMatch(content,/isSupportedClipboardInstruction|sameLogicalSubmission|resolveCurrentExecutable/);
assert.doesNotMatch(dom,/isExecutableSurface|executableSurfaces|currentExecutablePayload/);
assert.doesNotMatch(worker,/payloadHash === pending\.payload_hash/);
assert.match(content,/TARGET_NOT_FOUND/,'missing user target is a technical error');
assert.match(worker,/return \{ result: claim\.result, envelope: claim\.result\.rawResult/,'raw result return is preserved');
console.log('Bridge judgment zero contract passed');
