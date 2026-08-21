import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const dom=readFileSync(join(process.cwd(),'web-adapter/chatgpt-dom.js'),'utf8');
const content=readFileSync(join(process.cwd(),'web-adapter/chrome-extension-current/content.js'),'utf8');
const primitive=dom.match(/async function submitChatGPTComposerOnce[\s\S]*?(?=\n  function assistantMessageIdentity)/)?.[0]??'';
const probe=content.match(/async function runAutoSubmitProbe\(\)[\s\S]*?(?=\n  function ensureAutoLoopSetup)/)?.[0]??'';

assert.doesNotMatch(dom,/waitForExactComposerPayload|waitForEnabledComposerSendControl/,'direct Send bypasses obsolete insertion verification and polling gates');
assert.ok(primitive.indexOf("transition('INSERTED')")<primitive.indexOf('findComposerSendButton(document)'),'fresh Send lookup follows insertion');
assert.ok(primitive.indexOf('findComposerSendButton(document)')<primitive.indexOf('sendButton.click()'),'actuation follows fresh direct selector resolution');
assert.equal((primitive.match(/sendButton\.click\(\)/g)??[]).length,1,'canonical primitive contains exactly one native Send actuation');
assert.match(primitive,/if \(submitTriggered\) throw new Error\('SUBMIT_ALREADY_TRIGGERED'\)/,'actuation is guarded exactly once');
assert.match(primitive,/currentComposerText !== exactPayload/,'an exact existing insertion bypasses reinsertion');
assert.match(primitive,/transition\('MESSAGE_CONFIRMING'\)/);
assert.match(primitive,/matches\.length === 1 && !pending/,'confirmation requires one exact User message and cleared composer');
assert.match(content,/AUTO_SUBMIT_PROBE_ID = 'aicc-auto-submit-probe-004'/);
assert.match(content,/AUTO_SUBMIT_PROBE_STATES = Object\.freeze\(\['READY', 'STARTED', 'INSERTING', 'INSERTED', 'WAITING_SEND_CONTROL', 'INSERT_VERIFIED', 'SUBMITTING', 'SUBMIT_TRIGGERED', 'WAITING_MESSAGE_CONFIRMATION', 'CONFIRMED'\]\)/);
assert.match(content,/nextRank < currentRank\) return false/,'status rendering cannot regress lifecycle state');
assert.match(content,/autoSubmitProbeStateRestored \|\| autoSubmitProbeInFlight \|\| !\['READY', 'PRECONDITION_FAILED'\]\.includes\(autoSubmitProbeLifecycle\.state\)/,'mutation refresh skips unrestored and active post-insert lifecycle');
assert.match(probe,/composerText && composerText !== AUTO_SUBMIT_PROBE_PAYLOAD/,'only unrelated composer content fails start/recovery');
assert.doesNotMatch(probe,/COMPOSER_INSERT_FAILED/);
console.log('M8.2.1.8.4C post-insert state machine matrix passed');
