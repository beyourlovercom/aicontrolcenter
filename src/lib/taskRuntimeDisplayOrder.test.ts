import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const workspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const terminalStart=workspace.indexOf('<AiccWorkspaceDrawer title="Codex CLI Live"');
const runtimeStart=workspace.indexOf('<AiccWorkspaceDrawer title="运行摘要"');
const feedStart=workspace.indexOf('<AiccWorkspaceDrawer title="统一任务列表"');
const currentStart=workspace.indexOf('runtime-current-execution');

assert.ok(feedStart>=0&&terminalStart>feedStart,'canonical Task Feed precedes the terminal drawer');
assert.ok(runtimeStart>terminalStart,'summary drawer follows the terminal drawer');
assert.ok(currentStart>runtimeStart,'summary drawer precedes downstream Task Runtime sections');
assert.ok(workspace.indexOf('title="统一任务列表"')<workspace.indexOf('title="Codex CLI Live"'),'no unrelated module is inserted between canonical Task Feed and terminal drawer');
assert.equal((workspace.match(/class="runtime-live-section"/g)??[]).length,1,'Runtime Monitor has exactly one section');
assert.match(workspace,/title="Codex CLI Live"[\s\S]*<CodexCliLive runtime=\{focused\}\/>[\s\S]*title="运行摘要"[\s\S]*<RuntimeMonitor runtime=\{focused\}/,'terminal and summary remain bound to the exact focused runtime');
assert.match(workspace,/\$: focused=selectCanonicalCurrentRuntime\(runtime,history,selectedRunId\)/,'existing exact runtime selection remains unchanged');
assert.match(app,/runtime=\{selectedTaskRuntime\} history=\{selectedTaskRuntimeHistory\} selectedRunId=\{selectedTaskRuntimeId\}/,'Task selection retains the canonical Task-to-Run binding');
console.log('Task Runtime display order regression passed');
