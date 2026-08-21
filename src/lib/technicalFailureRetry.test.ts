import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isRetryableRuntimeFailure} from './context/actionEligibility.ts';

const eligibility=readFileSync(new URL('./context/actionEligibility.ts',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const owner=readFileSync(new URL('../components/entity/OwnerActionZone.svelte',import.meta.url),'utf8');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
const bridge=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');

assert.equal(isRetryableRuntimeFailure({phase:'FAILED',failure:'PROVIDER_UNAVAILABLE'}),true);
assert.equal(isRetryableRuntimeFailure({phase:'FAILED',failure:'EXECUTION_FAILED'}),true);
assert.equal(isRetryableRuntimeFailure({phase:'FAILED',failure:'RESULT_FAILED'}),false);
assert.equal(isRetryableRuntimeFailure({phase:'STOPPED',failure:'PROCESS_LAUNCH_FAILED'}),false);
assert.equal(isRetryableRuntimeFailure({phase:'RUNNING',failure:'PROVIDER_UNAVAILABLE'}),false);
assert.match(owner,/label:'重试'/);
assert.match(app,/api\/codex\/retry/);
assert.doesNotMatch(app,/api\/codex\/retry.*confirm/);
assert.match(vite,/server\.middlewares\.use\('\/api\/codex\/retry'/);
assert.match(vite,/previous\.instructionText\?\?''/);
assert.match(vite,/retryOf:previous\.runId/);
assert.match(bridge,/canonicalTaskFromInbox/);
console.log('technical failure retry matrix passed');
