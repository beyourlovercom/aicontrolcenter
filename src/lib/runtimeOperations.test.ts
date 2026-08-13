import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const manager=readFileSync(new URL('./runtimeManager.ts',import.meta.url),'utf8');
const model=readFileSync(new URL('./model/entityTypes.ts',import.meta.url),'utf8');
const selection=readFileSync(new URL('./runtimeSelection.ts',import.meta.url),'utf8');

assert.match(workspace,/运行结果/,'result control is always present');
assert((workspace.match(/>运行结果<\/button>/g)??[]).length>=2,'Runtime renders result controls for unlaunched and Run rows');
assert.equal((workspace.match(/class="runtime-run-actions"/g)??[]).length,1,'instruction and result share one action owner per Run');
assert.doesNotMatch(workspace,/runtime-disclosures/,'Work Package current panel has no shared action toolbar');
assert.match(workspace,/disabled=\{!resultForRun\(item\)\}/,'result is unavailable before terminal output');
assert.match(workspace,/finalAgentMessage/,'result source is persisted Codex terminal output');
assert.match(workspace,/navigator\.clipboard\.writeText\(result\)/,'copy occurs on explicit Owner click');
assert.match(workspace,/runtime-result-view/,'result body is expandable');
assert.match(workspace,/已复制/,'copy confirmation is visible');
assert.match(workspace,/instructionText/,'instruction view uses the actual Run instruction');
assert.match(workspace,/resultForRun\(item\)/,'result lookup is bound to the Run row');
assert.doesNotMatch(workspace,/onMount\([^)]*clipboard/,'mount does not write clipboard');
assert.doesNotMatch(workspace,/setInterval[^\n]*clipboard/,'polling does not write clipboard');
assert.match(manager,/instructionText: options\.instructionText \?\? options\.instructionBody/,'Runtime persists instruction text');
assert.match(model,/instructionText\?:string/,'Runtime model exposes persisted instruction text');
assert.match(selection,/selected&&\['STARTING','RUNNING','STOPPING'\]\.includes\(selected\.phase\)/,'active Runs remain independently selectable');
console.log('runtime operations workspace matrix passed');
