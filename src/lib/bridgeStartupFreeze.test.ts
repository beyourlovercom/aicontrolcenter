import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const source = readFileSync(join(process.cwd(), 'web-adapter/chrome-extension-current/content.js'), 'utf8');
const registry = readFileSync(join(process.cwd(), 'web-adapter/chrome-extension-current/bridge-action-registry.js'), 'utf8');

assert.match(source, /function hasExternalDomMutation\(records\)/, 'the observer has an explicit external-mutation guard');
assert.match(source, /if \(!hasExternalDomMutation\(records\)\) return;/, 'Bridge-owned mutations are ignored');
assert.match(source, /function isAiccOwnedNode\(node\)/, 'Bridge-owned subtree identity is explicit');
assert.doesNotMatch(source, /window\.setInterval\(\(\) => \{ mount\(\);/, 'mount is not timer-driven');
assert.doesNotMatch(source, /window\.setInterval\(mountNativeActions/, 'Composer mounting is not timer-driven');
assert.match(source, /function safeMountNativeActions\(\) \{ try \{ mountNativeActions\(\); \} catch/, 'Composer rail mount failures are isolated from Bridge runtime lifecycle');
const runtimeTimerIndex = source.indexOf('window.setInterval(() => { void pollResult(); void consumeNewAssistantControl(); }, 3000);');
const bootstrapIndex = source.indexOf('const bootstrapObserver = new MutationObserver');
assert.ok(runtimeTimerIndex >= 0 && bootstrapIndex > runtimeTimerIndex, 'runtime polling timer is registered before any DOM bootstrap mount can fail');

assert.match(source, /stack\.dataset\.aiccActionSignature !== signature/, 'action rendering is structural and idempotent');
assert.match(source, /stack\.dataset\.aiccRegistryBound !== 'true'/, 'delegated action binding is one-time');
assert.match(source, /handle\.dataset\.aiccBound !== 'true'/, 'the persistent expand handle is bound one time');
assert.match(source, /if \(button\.disabled !== disabled\)/, 'unchanged disabled state is not rewritten');
assert.match(source, /if \(button\.title !== title\)/, 'unchanged button titles are not rewritten');

assert.match(source, /async function pollResult\(allowAutomaticFeedback = false\)/, 'polling defaults to no automatic feedback');
assert.match(source, /if \(allowAutomaticFeedback\) await submitAutomaticFeedback\(\);/, 'automatic feedback needs an explicit opt-in');
assert.equal((source.match(/ownerConfirmSend\(document, target, window\.AICCChatGPTDom\.COMPOSER_ACTION_MODES\.OWNER_CONFIRM_SEND\)/g) ?? []).length, 1, 'only the explicit next-step handler can submit ChatGPT');
assert.equal((source.match(/deliverCanonicalResult\(\)/g) ?? []).length, 3, 'result delivery remains handler-owned rather than startup-owned');
assert.doesNotMatch(source.slice(source.indexOf('if (document.body)')), /insertTextIntoComposer|ownerConfirmSend|deliverCanonicalResult/, 'startup does not insert or submit Composer content');

const actionKeys = [...registry.matchAll(/actionKey: '([^']+)'/g)].map(match => match[1]);
assert.deepEqual(actionKeys, ['us-claude', 'clipboard-codex-execute', 'codex-execute', 'codex-result', 'aicc-send', 'next-step'], 'the six-button registry baseline is preserved exactly once');

console.log('Bridge startup freeze regression tests passed');
