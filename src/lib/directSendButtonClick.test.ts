import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dom=readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8');
const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
const resolver=dom.match(/function findComposerSendButton\(document,[\s\S]*?(?=\n  function ownerConfirmSend)/)?.[0]??'';
const primitive=dom.match(/async function submitChatGPTComposerOnce[\s\S]*?(?=\n  function exactNormalizedText)/)?.[0]??'';

assert.match(resolver,/composer\.closest\?\.\('form\[data-type="unified-composer"\]'\)/,'send authority resolves from the canonical live composer shell');
assert.match(resolver,/shell\?\.querySelector\?\.\('\[data-testid="send-button"\], #composer-submit-button, button\[type="submit"\]'\)/,'send selectors are scoped to the live composer shell');
assert.doesNotMatch(resolver,/document\.querySelector/,'no page-level Send fallback remains');
assert.equal((primitive.match(/sendButton\.click\(\)/g)??[]).length,1,'one primitive invocation has one native Send callsite');
assert.match(primitive,/const sendButton = findComposerSendButton\(document, ready\.composer\)/,'Send control is resolved from the post-insert live composer');
assert.match(primitive,/if \(!sendButton \|\| sendButton\.disabled\) throw new Error\('COMPOSER_SEND_NOT_READY'\)/,'missing or disabled Send fails closed');
assert.match(primitive,/waitForSubmittedUserMessage\(document, exactPayload\)/,'native click requires exact User-message confirmation');
assert.doesNotMatch(primitive,/KeyboardEvent|dispatchEvent|requestSubmit|ownerConfirmSend/,'canonical auto-submit has no keyboard, synthetic submit, or competing owner-send path');
assert.doesNotMatch(content,/AUTO_SUBMIT_PROBE_ID|AICC_AUTO_SUBMIT_PROBE_V1/,'obsolete Probe path remains removed from production content');
console.log('M8.2.1.8.4E canonical direct Send button matrix passed');
