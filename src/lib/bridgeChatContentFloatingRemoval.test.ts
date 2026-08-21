import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const domSource = readFileSync(join(root, 'web-adapter/chatgpt-dom.js'), 'utf8');
const contentSource = readFileSync(join(root, 'web-adapter/chrome-extension-current/content.js'), 'utf8');
const context: any = { innerWidth: 1440, setTimeout };
vm.runInNewContext(domSource, context);
const dom = context.AICCChatGPTDom;

assert.equal(typeof dom.mountAssistantAiccActions, 'undefined');
assert.equal(typeof dom.mountComposerAiccAction, 'function');
assert.equal(typeof dom.removeChatContentFloatingButtons, 'function');
assert.doesNotMatch(domSource, /function mountAssistantAiccActions|function actionSurfaces/);
assert.doesNotMatch(contentSource, /mountAssistantAiccActions/);
assert.match(contentSource, /removeChatContentFloatingButtons\(document\)/);
assert.match(contentSource, /mountComposerAiccAction\(document/);
assert.match(contentSource, /function hasExternalDomMutation\(records\)/);
assert.match(contentSource, /if \(!hasExternalDomMutation\(records\)\) return;/);
assert.doesNotMatch(contentSource, /new MutationObserver\([^)]*mountAssistant/);

let removed = 0;
const assistantRail = { remove: () => { removed += 1; } };
const composerRail = { remove: () => { removed += 1; } };
const cleanupDocument = {
  querySelectorAll: (selector: string) => selector.includes('aicc-composer') ? [composerRail] : [assistantRail]
};
assert.equal(dom.removeChatContentFloatingButtons(cleanupDocument), 1);
assert.equal(removed, 1, 'cleanup selector must not include the Composer rail');

console.log('Chat content floating button removal regression tests passed');
