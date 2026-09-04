import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const locator=readFileSync(new URL('../components/CurrentContextLocator.svelte',import.meta.url),'utf8');
const island=readFileSync(new URL('../components/GlobalFeedbackIsland.svelte',import.meta.url),'utf8');
const agents=readFileSync(new URL('../../AGENTS.md',import.meta.url),'utf8');

assert.match(agents,/EXPLICIT_BUTTON_ACTION_FEEDBACK = REQUIRED/);
assert.match(agents,/COLLAPSE_EXPAND_BUTTON_FEEDBACK = REQUIRED/);
assert.match(app,/async function locateSelectedEntity[\s\S]*CURRENT_CONTEXT_LOCATED/,'concrete context locate publishes one global event');
assert.match(app,/state:'INFO',title:'已定位到当前 '\+type/,'WP, PR, and milestone locate feedback is typed INFO');
assert.match(app,/state:'BLOCKED',title:'暂无当前 Work Package',message:'请选择一个具体 Work Package'/,'missing WP target publishes warning semantics');
assert.match(app,/async function locateSelectedTask[\s\S]*title:'已定位到当前 Task'/,'Task locate publishes Task semantics');
assert.match(app,/context\.record\?\.number/,'PR locate uses the resolved PR identity');
assert.match(app,/function toggleEntireRoadmap\(\)[\s\S]*collapsedNodeIds=[\s\S]*setFeedback/,'roadmap state changes before its feedback');
assert.match(app,/function toggleSidebar[\s\S]*leftCollapsed=!leftCollapsed[\s\S]*setFeedback/,'sidebar state changes before feedback');
assert.match(app,/onLocateTask=\{locateSelectedTask\}[\s\S]*onRefreshTasks=\{refreshTaskRecords\}[\s\S]*selectedTaskId=\{selectedTaskId\}/,'Task controls use their real handlers');
assert.match(app,/TASK_REFRESH_SUCCESS/,'Task refresh publishes success feedback');
assert.match(app,/function toggleExecutionContextLock[\s\S]*setFeedback/,'lock feedback remains covered');
assert.match(app,/function bindLaunchedExecution[\s\S]*setFeedback/,'execute feedback remains covered');
assert.match(app,/async function importInstruction[\s\S]*setFeedback/,'import feedback remains covered');
assert.match(app,/async function copyComposerResult[\s\S]*setFeedback/,'copy feedback remains covered');
assert.equal((app.match(/function setFeedback\(/g)??[]).length,1,'one global feedback authority');
assert.equal((app.match(/<GlobalFeedbackIsland/g)??[]).length,1,'one global feedback renderer');
assert.doesNotMatch(app,/toast|snackbar|feedback-bar/i,'no local short feedback UI remains');
assert.match(locator,/onToggleRoadmap/,'explicit collapse/expand control preserves its real handler');
assert.match(island,/data-testid="global-feedback-island"/,'visual island remains the only renderer');
console.log('global feedback action coverage passed');
