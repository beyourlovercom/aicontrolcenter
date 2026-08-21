import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const content=readFileSync(new URL('../../web-adapter/chrome-extension-current/content.js',import.meta.url),'utf8');
const worker=readFileSync(new URL('../../web-adapter/chrome-extension-current/service-worker.js',import.meta.url),'utf8');
const manifest=JSON.parse(readFileSync(new URL('../../web-adapter/chrome-extension-current/manifest.json',import.meta.url),'utf8'));
assert.equal(manifest.content_scripts[0].js[1],'content.js');
assert.match(content,/explicitLocalSyncBlocks/);assert.match(content,/AICC_BUG_REGISTRY_LOCAL_SYNC_V1/);assert.match(content,/localSyncForwardStates/);assert.match(content,/state==='FORWARDING'\|\|state==='FORWARDED'/);assert.match(content,/localSyncForwardStates\.delete\(key\)/);assert.match(content,/message\('BUG_REGISTRY_LOCAL_SYNC'/);
assert.match(worker,/message\?\.type === 'BUG_REGISTRY_LOCAL_SYNC'/);assert.match(worker,/request\('\/api\/bug-registry\/local-sync'/);
assert.equal(content.includes('Writing Block'),false,'local sync detector is not Writing Block-only');
