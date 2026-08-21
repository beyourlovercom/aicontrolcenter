import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const island=readFileSync(new URL('../components/GlobalFeedbackIsland.svelte',import.meta.url),'utf8');

assert.match(app,/<GlobalFeedbackIsland \{feedback\} onCopy=\{copyGlobalFeedback\}\/>/,'App owns the one global feedback renderer');
assert.match(island,/feedback\.title/);
assert.match(island,/feedback\.message/);
assert.doesNotMatch(island,/feedback\.code/,'internal feedback codes remain canonical state, not product UI');
assert.match(island,/feedback\.next/);
assert.doesNotMatch(workspace,/runtime-action-feedback|feedback-bar/,'Runtime adds no local feedback renderer');
assert.match(app,/async function canonicalImportInstruction\(payload=bridgePayload\)\{return importInstruction\(payload\)\}/,'Import button uses canonical feedback-producing action');
assert.match(app,/instructionState='TEXT_READY';const message=error instanceof Error\?error\.message/,'Import errors preserve truthful TEXT_READY state and exact message');
assert.match(app,/if\(item\?\.runId\|\|item\?\.state==='LAUNCHED'\)\{bindComposerSubmittedRun/,'Import success binds the returned runtime before feedback');
assert.match(app,/instructionState='RUN_STARTED'/,'Run success preserves started state');
assert.equal((app.match(/<GlobalFeedbackIsland/g)??[]).length,1,'there is one global feedback renderer');
console.log('runtime action feedback regression matrix passed');
