import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {existsSync} from 'node:fs';

const root=process.cwd();
const extensionRoot=join(root,'web-adapter/chrome-extension');
const manifest=JSON.parse(readFileSync(join(extensionRoot,'manifest.json'),'utf8')) as {manifest_version:number;permissions:string[];host_permissions:string[];content_scripts:{matches:string[];js:string[]}[];background:{service_worker:string}};
assert.equal(manifest.manifest_version,3);assert.deepEqual(manifest.permissions,['storage']);assert.deepEqual(manifest.host_permissions,['http://127.0.0.1:1420/*']);assert.deepEqual(manifest.content_scripts[0].matches,['https://chatgpt.com/*']);assert.deepEqual(manifest.content_scripts[0].js,['chatgpt-dom.js','content.js']);assert.equal(manifest.background.service_worker,'service-worker.js');
const referenced=[...manifest.content_scripts.flatMap(script=>script.js),manifest.background.service_worker];assert.equal(referenced.filter(file=>!existsSync(join(extensionRoot,file))).length,0,'manifest references only packaged files');
const content=readFileSync(join(extensionRoot,'content.js'),'utf8');const worker=readFileSync(join(extensionRoot,'service-worker.js'),'utf8');const dom=readFileSync(join(root,'web-adapter/chatgpt-dom.js'),'utf8');const packagedDom=readFileSync(join(extensionRoot,'chatgpt-dom.js'),'utf8');const readme=readFileSync(join(extensionRoot,'README.md'),'utf8');
assert.equal(packagedDom,dom,'packaged DOM adapter is synchronized from canonical source');
assert.match(content,/发送到 AICC/);assert.match(content,/插入运行报告/);assert.match(content,/SEND_INSTRUCTION/);assert.match(content,/POLL_RESULT/);assert.equal(content.includes('/api/gpt-bridge/launch'),false);assert.equal(content.includes('button[type="submit"]'),false);assert.equal(content.includes('chrome\.tabs'),false);
assert.match(worker,/127\.0\.0\.1:1420/);assert.match(worker,/api\/gpt-bridge\/inbox/);assert.match(worker,/api\/gpt-bridge\/outbox/);assert.equal(worker.includes('/api/gpt-bridge/launch'),false);assert.match(worker,/chrome\.runtime\.onMessage/);assert.match(worker,/chrome\.storage\.local/);assert.match(worker,/AICC 拒绝请求：HTTP/);
assert.match(dom,/data-message-author-role/);assert.match(dom,/AICC_EXECUTION_V1/);assert.match(dom,/INSTRUCTION_END/);assert.match(dom,/✦/);assert.match(content,/resolveTaskSource/);assert.match(content,/mountAssistantAiccActions/);assert.match(content,/mountComposerAiccAction/);assert.equal(content.includes("/api/gpt-bridge/launch"),false);
const viteConfig=readFileSync(join(root,'vite.config.ts'),'utf8');assert.ok(viteConfig.includes('chrome-extension')&&viteConfig.includes('[a-p]{32}'),'Chrome extension origin is narrowly allowlisted');assert.equal(viteConfig.includes("origin === '*"),false);assert.match(viteConfig,/ORIGIN_REJECTED/);
assert.match(readme,/chrome:\/\/extensions/);assert.match(readme,/Load unpacked/);assert.match(readme,/chatgpt\.com/);assert.match(readme,/127\.0\.0\.1:1420/);console.log('Chrome extension package contract tests passed');
