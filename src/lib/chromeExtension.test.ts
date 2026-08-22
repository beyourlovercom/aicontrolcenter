import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';

const root=process.cwd();
const extensionRoot=join(root,'web-adapter/chrome-extension-current');
const manifest=JSON.parse(readFileSync(join(extensionRoot,'manifest.json'),'utf8')) as {manifest_version:number;background:{service_worker:string};content_scripts:{js:string[]}[]};
const content=readFileSync(join(extensionRoot,'content.js'),'utf8');
const worker=readFileSync(join(extensionRoot,'service-worker.js'),'utf8');
const dom=readFileSync(join(root,'web-adapter/chatgpt-dom.js'),'utf8');
const packagedDom=readFileSync(join(extensionRoot,'chatgpt-dom.js'),'utf8');
assert.equal(manifest.manifest_version,3);
assert.equal(manifest.background.service_worker,'service-worker.js');
assert.deepEqual(manifest.content_scripts[0].js,['chatgpt-dom.js','bridge-action-registry.js','content.js']);
assert.equal(packagedDom,dom,'packaged DOM adapter is synchronized');
assert.match(content,/SEND_INSTRUCTION/);assert.match(content,/POLL_RESULT/);assert.match(content,/boundedMessage/);
assert.match(content,/submitChatGPTComposerOnce/,'content script uses the canonical Composer submission primitive');
assert.match(content,/AUTO_LOOP_FEEDBACK/,'content script may transport explicit auto-loop feedback operations');
assert.doesNotMatch(content,/projectAutoLoopStatus|consumeGptControl|canonicalControlLoopReadModel/,'content script owns no control-loop semantic authority');
assert.match(worker,/AUTO_LOOP_STATUS_PATH = '\/api\/gpt-bridge\/auto-loop'/,'worker transports auto-loop API operations');
assert.match(worker,/function autoLoopRequest/);
assert.doesNotMatch(worker,/projectAutoLoopStatus|consumeGptControl|canonicalControlLoopReadModel/,'worker owns no control-loop semantic authority');
assert.doesNotMatch(dom,/AUTO_LOOP|AUTO_SUBMIT_PROBE|completeProtocol|firstControlContract|resolveInstructionSource/,'DOM adapter remains control-loop-semantic free');
assert.match(dom,/function ownerConfirmSend/,'DOM adapter may expose the canonical Owner-confirmed Send primitive');
assert.match(worker,/api\/gpt-bridge\/inbox/);assert.match(worker,/api\/tasks\/result/);assert.match(worker,/RECONCILE_SUBMISSION/);const pollResultSource=worker.match(/async function pollResult[\s\S]*?(?=async function remoteClaudeStatus)/)?.[0]??'';assert.doesNotMatch(pollResultSource,/api\/gpt-bridge\/outbox/,'POLL_RESULT must not read Outbox result authority');
console.log('Chrome extension pure transport contract passed');


assert.match(worker,/function scopedStorageKey\(base, scopeId\)/,'service worker isolates Bridge storage by caller scope');
assert.match(worker,/scopedStorageKey\(CORRELATION_KEY, message\.bridgeScopeId\)/,'worker correlation lookup is caller-scoped');
assert.match(worker,/scopedStorageKey\(PENDING_SUBMISSION_KEY, message\.bridgeScopeId\)/,'worker pending submission lookup is caller-scoped');
assert.doesNotMatch(worker,/chrome\.storage\.local\.get\(CORRELATION_KEY\)/,'worker never reads a global unscoped correlation key');
