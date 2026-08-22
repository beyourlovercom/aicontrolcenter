import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root = process.cwd();
const content = readFileSync(join(root, 'web-adapter/chrome-extension-current/content.js'), 'utf8');
const registry = readFileSync(join(root, 'web-adapter/chrome-extension-current/bridge-action-registry.js'), 'utf8');
const dom = readFileSync(join(root, 'web-adapter/chatgpt-dom.js'), 'utf8');
const handler = content.match(/async function insertLatestResultToGpt\(\)[\s\S]*?(?=\n  async function copyPanelResult)/)?.[0] ?? '';
const startup = content.slice(content.indexOf('if (document.body)'));

assert.ok(handler, 'bottom-center action has a dedicated click handler');
assert.match(content, /class="aicc-insert-gpt-footer"[\s\S]*data-aicc-insert-gpt[^>]*>插入 GPT/);
assert.match(content, /\.aicc-insert-gpt-footer\{display:flex;justify-content:center\}/, 'footer action is centered');
assert.match(content, /resultActions\.appendChild\(insertGpt\); insertGptFooter\.remove\(\)/, 'the GPT control joins the existing result footer parent');
assert.match(content, /\.aicc-result-actions\{grid-template-columns:repeat\(3,minmax\(0,1fr\)\);grid-auto-flow:column;white-space:nowrap\}/, 'all three footer controls occupy one no-wrap row');
assert.match(content, /bindPanelControl\(SELECTORS\.insertGpt, insertLatestResultToGpt\)/, 'footer action uses one guarded binding');
assert.match(content, /const insertGpt = section\.querySelector\(SELECTORS\.insertGpt\)/);
assert.match(content, /!resultAvailable \? '当前没有可用的最新结果预览。'/, 'unavailable reason is truthful and visible in the title');
assert.doesNotMatch(content, /插入 AICC 结果|data-aicc-action-key="aicc-result"/);
assert.equal((registry.match(/actionKey:/g) ?? []).length, 6, 'primary action registry includes US-Claude plus the existing five actions');

assert.match(content, /function currentPanelResult\(\)[\s\S]*runtimeProjection\.resultText/);
assert.match(handler, /const result = currentPanelResult\(\)/, 'click reads the current Result Preview source');
assert.doesNotMatch(handler, /bridgeReportText|reportText\(/, 'GPT footer does not use a historical report projection');
assert.match(content, /const preview = section\.querySelector\(SELECTORS\.resultPreview\); if \(preview\) preview\.textContent = runtimeProjection\.resultText/);

const insertIndex = handler.indexOf('insertTextIntoComposer');
const verifyIndex = handler.indexOf('verifyComposerText');
const submitIndex = handler.indexOf('submitChatGPTComposerOnce');
assert.ok(insertIndex >= 0 && verifyIndex > insertIndex && submitIndex > verifyIndex, 'insertion is verified before canonical submission');
assert.equal((handler.match(/insertTextIntoComposer\(/g) ?? []).length, 1, 'one click has at most one insertion call');
assert.equal((handler.match(/submitChatGPTComposerOnce\(/g) ?? []).length, 1, 'one click has one canonical submission call');
assert.match(handler, /if \(insertGptInFlight\) return/);
assert.match(handler, /attemptedGptResultIds\.has\(resultId\)/, 'repeat clicks are rejected for the same result');
assert.match(handler, /beforeSubmit: \(\) => \{ attemptedGptResultIds\.add\(resultId\)/, 'a submission attempt is claimed before Send');
assert.match(handler, /submission\.userMessageId/, 'submitted User message is verified by the canonical primitive');
assert.match(handler, /findComposerSendButton\(document, target\)/, 'Send is resolved before submission');
assert.match(handler, /if \(!currentSendButton \|\| currentSendButton\.disabled\)[\s\S]*结果已插入 GPT 输入框，但发送控件不可用/);
assert.doesNotMatch(handler, /initialSendButton/, 'Send readiness is not cached before insertion');
assert.ok(handler.indexOf('verifyComposerText') < handler.indexOf('const conversationId') && handler.indexOf('const conversationId') < handler.indexOf('submitChatGPTComposerOnce'), 'submission follows verified insertion');
assert.match(handler, /INSERT_GPT_VERIFICATION_FAILED[\s\S]*未提交/);

assert.match(startup, /safeMountNativeActions\(\); scheduleProtocolCapture\(\);/);
assert.doesNotMatch(startup, /insertLatestResultToGpt\(\)/, 'boot and external mutation handling never invoke the footer action');
assert.doesNotMatch(startup, /submitChatGPTComposerOnce\(/, 'boot never submits to ChatGPT');
assert.match(content, /if \(stack\.dataset\.aiccRegistryBound !== 'true'\)/, 'primary button binding is one-time');
assert.match(content, /if \(!button \|\| button\.dataset\.aiccBound === 'true'\) return/);
assert.match(content, /if \(!hasExternalDomMutation\(records\)\) return;/, 'Bridge-owned mutations do not remount or invoke actions');

assert.match(dom, /async function submitChatGPTComposerOnce/);
assert.match(dom, /if \(!insertTextIntoComposer\(initial\.composer, exactPayload\)\) throw/);
assert.match(dom, /const sendButton = findComposerSendButton\(document, ready\.composer\);[\s\S]*sendButton\.click\(\);/);
assert.match(dom, /waitForSubmittedUserMessage\(document, exactPayload\)/);

console.log('AICC Bridge bottom-center 插入 GPT focused contract passed');
