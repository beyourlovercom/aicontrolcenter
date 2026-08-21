import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dom=readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8');
const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
const resolver=dom.match(/function findComposerSendButton\(document,[\s\S]*?(?=\n  function ownerConfirmSend)/)?.[0]??'';
const primitive=dom.match(/async function submitChatGPTComposerOnce[\s\S]*?(?=\n  function assistantMessageIdentity)/)?.[0]??'';
const panelTemplate=content.match(/panel\.innerHTML = '([^']+)'/)?.[1]??'';

assert.match(resolver,/composer\.closest\?\.\('form\[data-type="unified-composer"\]'\)/,'send authority resolves from the canonical live composer shell');
assert.match(resolver,/shell\?\.querySelector\?\.\('\[data-testid="send-button"\], #composer-submit-button, button\[type="submit"\]'\)/,'send selectors are scoped to the live composer shell');
assert.doesNotMatch(resolver,/document\.querySelector/,'no page-level Send fallback remains');
assert.equal((primitive.match(/sendButton\.click\(\)/g)??[]).length,1,'one primitive invocation has one click callsite');
assert.match(primitive,/if \(submitTriggered\) throw new Error\('SUBMIT_ALREADY_TRIGGERED'\)/,'submission identity guards repeated actuation');
assert.match(primitive,/submitTriggered = true;[\s\S]*sendButton\.click\(\)/,'the exactly-once claim is acquired before actuation');
assert.match(primitive,/SEND_BUTTON_NOT_FOUND/);
assert.match(primitive,/SEND_BUTTON_DISABLED/);
assert.match(primitive,/SEND_CLICK_FAILED/);
assert.doesNotMatch(primitive,/SEND_CONTROL_NOT_FOUND|SEND_CONTROL_DISABLED|SUBMIT_TRIGGER_FAILED|COMPOSER_VERIFICATION_FAILED/,'obsolete direct-send failure classifications are removed');
assert.doesNotMatch(primitive,/waitForExactComposerPayload|waitForEnabledComposerSendControl|KeyboardEvent|dispatchEvent|ownerConfirmSend/,'direct click has no verification, polling, or keyboard detour');
assert.match(content,/AUTO_SUBMIT_PROBE_ID = 'aicc-auto-submit-probe-004'/);
assert.match(content,/AICC_AUTO_SUBMIT_PROBE_V1\\nPROBE_ID = aicc-auto-submit-probe-004/);
assert.equal((panelTemplate.match(/data-aicc-action-button/g)??[]).length,6,'the frozen six-button UI is unchanged');
console.log('M8.2.1.8.4E direct Send button click matrix passed');
