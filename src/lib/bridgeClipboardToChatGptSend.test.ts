import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const dom = readFileSync(join(root, 'web-adapter/chatgpt-dom.js'), 'utf8');
const content = readFileSync(join(root, 'web-adapter/chrome-extension-current/content.js'), 'utf8');
const handler = content.match(/async function pasteClipboardAndSendToChatGpt\(\)[\s\S]*?(?=\n  function mountNativeActions)/)?.[0] ?? '';
const mount = dom.match(/function mountComposerAiccAction\(document, onClick\)[\s\S]*?(?=\n  function mountComposerClipboardAction)/)?.[0] ?? '';
const submit = dom.match(/async function submitChatGPTComposerOnce[\s\S]*?(?=\n  function exactNormalizedText)/)?.[0] ?? '';

assert.ok(handler, 'clipboard-to-ChatGPT has one dedicated user-action handler');
assert.match(dom, /button\.textContent = '➡️'/, 'clipboard control remains a visible arrow button');
assert.match(dom, /button\.title = 'Paste clipboard and send'/, 'clipboard control has the required tooltip');
assert.match(dom, /aria-label', 'Paste clipboard and send'/, 'icon-only control has an accessible label');
assert.doesNotMatch(mount, /clipboard|onClipboardSend/i, 'the existing rail mount remains clipboard-independent');
assert.doesNotMatch(mount, /clipboard|onClipboardSend/i, 'the existing rail mount remains clipboard-independent');

assert.match(handler, /if \(clipboardChatGptSendInFlight\) return/, 'rapid clicks are lifecycle-gated');
assert.match(handler, /clipboardChatGptSendInFlight = true/, 'the local clipboard lifecycle starts before asynchronous work');
assert.match(handler, /finally \{ clipboardChatGptSendInFlight = false; \}/, 'the local clipboard lifecycle always releases');
assert.equal((handler.match(/navigator\.clipboard\.readText\(\)/g) ?? []).length, 1, 'one click performs at most one clipboard read');
assert.match(handler, /CLIPBOARD_TEXT_REQUIRED[\s\S]*Clipboard is empty/, 'empty clipboard fails before insertion or submit');
assert.match(handler, /CLIPBOARD_READ_UNAVAILABLE[\s\S]*Clipboard unavailable/, 'clipboard API unavailability is explicit');
assert.match(handler, /CLIPBOARD_READ_FAILED[\s\S]*error\?\.message/, 'clipboard failures expose their technical error');
assert.match(handler, /CANONICAL_COMPOSER_UNAVAILABLE[\s\S]*ChatGPT composer unavailable/, 'composer unavailability is explicit');
assert.match(handler, /COMPOSER_CONTAINS_EXISTING_INPUT[\s\S]*Composer contains existing user input/, 'existing drafts are never silently overwritten or merged');
assert.equal((handler.match(/submitChatGPTComposerOnce\(/g) ?? []).length, 1, 'one clipboard action has one canonical submit invocation');
assert.doesNotMatch(handler, /insertTextIntoComposer\(|ownerConfirmSend\(|\.click\(|KeyboardEvent|sendTask\(|message\(/, 'clipboard action has no second insert/submit path and no AICC transport');
assert.match(handler, /payload: clipboardText/, 'canonical submission receives the exact clipboard text');
assert.match(handler, /onInserted: \(\) => \{ clipboardInserted = true; \}/, 'post-insert submit failure preserves the inserted clipboard text');
assert.match(handler, /COMPOSER_SEND_NOT_READY[\s\S]*clipboard text remains in composer/, 'unavailable submit is visible and non-destructive');
assert.match(content, /mountComposerAiccAction\(document, canonicalImportAndRun\)/, 'the existing rail mount remains authoritative');
assert.doesNotMatch(content, /mountComposerClipboardAction\(/, 'clipboard mounting is disabled during hard baseline restore');
assert.doesNotMatch(content, /setInterval\(\(\) => \{ mountNativeActions\(\)/, 'clipboard does not add polling as a rail lifecycle workaround');

assert.match(submit, /onInserted\) await onInserted\(\)/, 'the canonical submit primitive records insertion before waiting for send readiness');
assert.match(submit, /requireEmptyComposer && String\(textOf\(initial\.composer\) \|\| ''\)/, 'the canonical primitive rechecks for a draft immediately before insertion');
assert.match(handler, /requireEmptyComposer: true/, 'clipboard send opts into the no-overwrite canonical guard');
assert.match(submit, /const sendButton = findComposerSendButton\(document, ready\.composer\);[\s\S]*sendButton\.click\(\)/, 'submission uses a fresh canonical Send lookup');
assert.equal((submit.match(/sendButton\.click\(\)/g) ?? []).length, 1, 'the canonical primitive has one native submission callsite');
assert.doesNotMatch(submit, /KeyboardEvent|dispatchEvent\(new MouseEvent/, 'submission authority is neither simulated keyboard nor synthetic mouse');

const resultInsertion = content.match(/async function copyAndInsertResult\([\s\S]*?(?=\n  function currentPanelResult)/)?.[0] ?? '';
assert.doesNotMatch(resultInsertion, /submitChatGPTComposerOnce|ownerConfirmSend|\.click\(/, 'AICC/Codex result insertion still never auto-sends');

console.log('AICC clipboard → ChatGPT → Send focused contract passed');
