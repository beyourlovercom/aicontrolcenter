import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const globalView=readFileSync(new URL('../components/GlobalTaskView.svelte',import.meta.url),'utf8');
const wp=readFileSync(new URL('../../docs/60_Operations/work-packages/AICC-V2-WORKSPACE-CONTEXT-001.md',import.meta.url),'utf8');
assert.match(app,/globalWorkspace/);assert.match(app,/executionContextLock/);assert.match(app,/GlobalTaskView center/);assert.match(app,/onToggleExecutionContextLock/);
assert.match(globalView,/global-task-center/);assert.match(globalView,/进行中/);assert.match(globalView,/等待 Owner/);assert.match(globalView,/需要处理/);assert.match(globalView,/最近完成/);
assert.match(wp,/GLOBAL_TASK_INLINE_TREE_EXPANSION = 0/);assert.match(wp,/EXECUTION_CONTEXT_PRECEDENCE = EXPLICIT_ENTITY > OWNER_LOCK > UNKNOWN/);
console.log('workspace context implementation matrix passed');
