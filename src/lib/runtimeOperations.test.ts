import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const monitor=readFileSync(new URL('../components/RuntimeMonitor.svelte',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const manager=readFileSync(new URL('./runtimeManager.ts',import.meta.url),'utf8');
const model=readFileSync(new URL('./model/entityTypes.ts',import.meta.url),'utf8');
const selection=readFileSync(new URL('./runtimeSelection.ts',import.meta.url),'utf8');

assert.match(monitor,/运行结果/,'main result panel is owned by Runtime Monitor');
assert.equal((workspace.match(/class="runtime-run-actions"/g)??[]).length,0,'Run history no longer owns competing row actions');
assert.doesNotMatch(workspace,/runtime-disclosures/,'Work Package current panel has no shared action toolbar');
assert.match(workspace,/exactResultForRun\(lifecycleProjection,run\.runId\)\?\.canonical\?\.rawResult/,'result availability is read from the exact Phase 5 RUN_TO_RESULT projection');
assert.doesNotMatch(workspace,/canonicalResult\?\.rawResult/,'Runtime Workspace does not reintroduce raw Runtime canonicalResult authority');
assert.match(workspace,/onCopyResult\(runId\)/,'copy delegates on explicit Owner click');
assert.match(monitor,/runtime-result-content/,'result body is expandable');
assert.match(monitor,/已复制/,'copy confirmation is visible');
assert.doesNotMatch(workspace,/runtime-result-detail/,'historical rows do not own a second result implementation');
assert.match(app,/canonicalCopyResult/,'copy resolves through the canonical App result action');
assert.match(workspace,/export let bridgeInbox:any\[\]=\[\]/,'Inbox data contract remains intact');
assert.match(workspace,/export let bridgeOutbox:any\[\]=\[\]/,'Outbox data contract remains intact');
assert.doesNotMatch(workspace,/onMount\([^)]*clipboard/,'mount does not write clipboard');
assert.doesNotMatch(workspace,/setInterval[^\n]*clipboard/,'polling does not write clipboard');
assert.match(manager,/instructionText: options\.instructionText \?\? options\.instructionBody/,'Runtime persists instruction text');
assert.match(model,/instructionText\?:string/,'Runtime model exposes persisted instruction text');
assert.match(selection,/selected&&\['STARTING','RUNNING','STOPPING'\]\.includes\(selected\.phase\)/,'active Runs remain independently selectable');
console.log('runtime operations workspace matrix passed');
