import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const startupLoader=app.slice(app.indexOf('async function loadAcceptedRoadmapProjection'),app.indexOf("let feedback:Feedback",app.indexOf('async function loadAcceptedRoadmapProjection')));
const syncRoadmap=app.slice(app.indexOf('async function syncRoadmap'),app.indexOf('\n  function ',app.indexOf('async function syncRoadmap')+10));
assert.match(app,/DEFAULT_BOUNDED_REQUEST_TIMEOUT_MS=3000/);
assert.match(app,/ROADMAP_SYNC_TIMEOUT_MS=15000/);
assert.match(app,/async function boundedRequest\(url:string,options\?:RequestInit,timeoutMs=DEFAULT_BOUNDED_REQUEST_TIMEOUT_MS\)/);
assert.match(app,/boundedRequest\('\/api\/roadmap',[\s\S]*?ROADMAP_SYNC_TIMEOUT_MS\)/);
assert.doesNotMatch(app,/boundedRequest\('\/api\/health',[\s\S]*?ROADMAP_SYNC_TIMEOUT_MS/);
assert.doesNotMatch(startupLoader,/method:'POST'/);
assert.match(syncRoadmap,/boundedRequest\('\/api\/roadmap',[\s\S]*?ROADMAP_SYNC_TIMEOUT_MS\)/);
assert.equal((syncRoadmap.match(/boundedRequest\('\/api\/roadmap',\{method:'POST'/g)??[]).length,1);
console.log('roadmap dedicated timeout tests passed');
