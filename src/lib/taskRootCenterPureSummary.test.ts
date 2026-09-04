import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const taskView=readFileSync(new URL('../components/GlobalTaskView.svelte',import.meta.url),'utf8');
const quickList=readFileSync(new URL('../components/TaskQuickList.svelte',import.meta.url),'utf8');
const inspector=readFileSync(new URL('../components/TaskRightContextInspector.svelte',import.meta.url),'utf8');
const composer=readFileSync(new URL('../components/GlobalExecutionComposerDock.svelte',import.meta.url),'utf8');

assert.match(app,/else if\(tab==='TASK'\)\{selectedTaskId=null;globalWorkspace=true;\}/,'top-level Task click clears task selection');
assert.match(app,/\{#if !\(globalWorkspace&&\['PR','TASK'\]\.includes\(activeGlobalTab\)\)\}<EntityHeader/,'entity header is not rendered anywhere in the Task workspace');
const taskBranch=app.match(/\{:else if globalWorkspace && activeGlobalTab==='TASK'\}([\s\S]*?)\{:else if globalWorkspace && activeGlobalTab==='WP'/)?.[1]??'';
assert.match(taskBranch,/\{:else\}<GlobalTaskView center groups=\{globalTaskGroups\}/,'Task Root renders the canonical global Task view when no Task is selected');
assert.match(taskBranch,/\{#if selectedTask\}<EntityOperationsWorkspace[\s\S]*\{:else\}<GlobalTaskView/,'Task Root and selected Task operations are mutually exclusive');
assert.doesNotMatch(taskView,/operations-workspace|runtime-tab-workspace|EntityHeader|RuntimeWorkspace/,'Task Root component remains a pure summary/list surface');
assert.match(taskView,/全局任务/,'Task Root has its summary title');
assert.match(taskView,/task-statistics/,'Task Root has summary counts');
assert.match(taskView,/global-task-filters/,'Task Root has filters');
assert.match(taskView,/data-testid="global-task-list"/,'Task Root has the canonical Task list');
assert.match(taskView,/任务名称[\s\S]*状态[\s\S]*结果/,'Task list retains its shared first three columns');
assert.match(quickList,/TaskQuickList|tasks:CanonicalTaskRecord\[\]/,'left Task quick list remains its existing implementation');
assert.match(inspector,/GlobalTaskDetail/,'right Task inspector remains its existing implementation');
assert.match(composer,/global-execution-composer/,'Global Composer remains its existing implementation');

console.log('Task Root pure summary tests passed');
