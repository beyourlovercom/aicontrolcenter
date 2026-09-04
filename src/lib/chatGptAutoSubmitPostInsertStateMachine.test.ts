import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dom=readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8');
const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
const primitive=dom.match(/async function submitChatGPTComposerOnce[\s\S]*?(?=\n  function exactNormalizedText)/)?.[0]??'';

assert.doesNotMatch(dom,/waitForExactComposerPayload|waitForEnabledComposerSendControl/,'obsolete verification helpers remain removed');
const insertIndex=primitive.indexOf('insertTextIntoComposer(initial.composer, exactPayload)');
const callbackIndex=primitive.indexOf('if (onInserted) await onInserted()');
const readyIndex=primitive.indexOf('const ready = await waitForLiveComposerSendCondition');
const claimIndex=primitive.indexOf('if (beforeSubmit) await beforeSubmit()');
const resolveIndex=primitive.indexOf('findComposerSendButton(document, ready.composer)');
const clickIndex=primitive.indexOf('sendButton.click()');
const confirmIndex=primitive.indexOf('waitForSubmittedUserMessage(document, exactPayload)');
assert.ok(insertIndex>=0&&insertIndex<callbackIndex&&callbackIndex<readyIndex,'post-insert callback and bounded live-composer readiness follow insertion');
assert.ok(readyIndex<claimIndex&&claimIndex<resolveIndex&&resolveIndex<clickIndex,'durable claim precedes fresh Send resolution and native actuation');
assert.ok(clickIndex<confirmIndex,'exact submitted User-message confirmation follows native actuation');
assert.equal((primitive.match(/sendButton\.click\(\)/g)??[]).length,1,'canonical primitive contains exactly one native Send callsite');
assert.match(primitive,/if \(!reportFormatPresent\(initial\.composer, exactPayload\)\)/,'an exact pending payload bypasses reinsertion');
assert.match(primitive,/waitForSubmittedUserMessage\(document, exactPayload\)/,'submission confirmation remains exact-payload bound');
assert.doesNotMatch(content,/runAutoSubmitProbe|AUTO_SUBMIT_PROBE_STATES|autoSubmitProbeLifecycle/,'removed Probe state machine cannot return');
console.log('M8.2.1.8.4C canonical post-insert submission ordering matrix passed');
