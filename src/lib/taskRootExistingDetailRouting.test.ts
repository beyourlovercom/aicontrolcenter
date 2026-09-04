import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const operations=readFileSync(new URL('../components/entity/EntityOperationsWorkspace.svelte',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const inspector=readFileSync(new URL('../components/TaskRightContextInspector.svelte',import.meta.url),'utf8');
const quickList=readFileSync(new URL('../components/TaskQuickList.svelte',import.meta.url),'utf8');
const taskView=readFileSync(new URL('../components/GlobalTaskView.svelte',import.meta.url),'utf8');

assert.doesNotMatch(app,/import GlobalTaskDetail/,'compact right-panel Task detail is not imported into center routing');
assert.equal((app.match(/let selectedTaskId=/g)??[]).length,1,'center detail retains the single canonical Task authority');
assert.doesNotMatch(app,/(?:detailSelectedTaskId|centerSelectedTaskId|taskDetailId)/,'no center-local Task selection authority is introduced');
assert.match(app,/if\(\['PR','TASK'\]\.includes\(activeGlobalTab\)\)globalWorkspace=true/,'persisted Task workspace restores its root or concrete detail route');
assert.match(app,/else if\(tab==='TASK'\)\{selectedTaskId=null;globalWorkspace=true;\}/,'top-level Task returns to root without selecting a default');
assert.doesNotMatch(app,/selectedTaskId=\(?taskRecords/,'Task root does not auto-select the first Task');

const taskBranch=app.match(/\{:else if globalWorkspace && activeGlobalTab==='TASK'\}([\s\S]*?)\{:else if globalWorkspace && activeGlobalTab==='WP'/)?.[1]??'';
assert.match(taskBranch,/\{#if selectedTask\}<EntityOperationsWorkspace entityType="work_package" activeTab=\{selectedTaskActiveTab\}/,'selectedTaskId-derived Task opens the existing Operations Workspace');
assert.match(taskBranch,/\{:else\}<GlobalTaskView center groups=\{globalTaskGroups\}/,'no selected Task renders only the Task root list');
assert.equal((taskBranch.match(/<EntityOperationsWorkspace\b/g)??[]).length,1,'Task operations has one mutually exclusive center mount');
assert.equal((taskBranch.match(/<GlobalTaskView\b/g)??[]).length,1,'Task root has one mutually exclusive center mount');
assert.match(taskBranch,/\{#if selectedTask\}<EntityOperationsWorkspace[\s\S]*\{:else\}<GlobalTaskView[\s\S]*\{\/if\}/,'Task Root list and Task Operations Workspace cannot render simultaneously');
assert.doesNotMatch(taskBranch,/<GlobalTaskDetail\b|<GlobalPrWorkspace\b|<EntityHeader\b/,'Task center does not duplicate the right inspector or leak PR/entity hero surfaces');
assert.match(app,/\{#if !\(globalWorkspace&&\['PR','TASK'\]\.includes\(activeGlobalTab\)\)\}<EntityHeader/,'Task root and Task detail both suppress the stale entity hero');
assert.match(operations,/class="operations-workspace" data-testid="operations-workspace"/,'selected Task center owns the Owner-provided Operations Workspace DOM');
assert.match(operations,/StatusTabs active=\{activeTab\}/,'existing Operations Workspace owns the shared status tabs');
assert.match(app,/WORKSPACE_TABS=\['运行','UAT','概览','证据','授权'\]/,'all five existing Operations tabs are preserved');
assert.match(taskBranch,/runtime=\{selectedTaskRuntime\} history=\{selectedTaskRuntimeHistory\} selectedRunId=\{selectedTaskRuntimeId\}/,'selected Task runtime content is bound only to its canonical Run');
assert.match(taskBranch,/tasks=\{\[selectedTask\]\} \{selectedTaskId\} onSelectTask=\{selectCanonicalTask\}/,'selected Task feed is scoped to the selected canonical Task');
assert.match(runtime,/data-testid="runtime-tab-workspace"[\s\S]*CanonicalTaskFeed[\s\S]*runtime-live-activity[\s\S]*runtime-current-execution[\s\S]*runtime-execution-evidence[\s\S]*ExecutionProviderPanel/,'existing Runtime tab surfaces remain owned by the shared Runtime Workspace in Task-first order');

assert.match(app,/TaskQuickList tasks=\{taskRecords\} selectedTaskId=\{selectedTaskId\} onSelect=\{selectCanonicalTask\}/,'left Task selection uses the canonical authority');
assert.match(app,/GlobalTaskView center groups=\{globalTaskGroups\}[^\n]*\{selectedTaskId\} onSelectTask=\{selectCanonicalTask\}/,'Task root selection uses the same canonical authority');
assert.match(quickList,/class:selected=\{selectedTaskId===task\.taskId\}/,'left highlight follows canonical selection during Task switching');
assert.match(taskView,/selected=\{selectedTaskId===item\.canonicalTaskId\} onSelect=\{onSelectTask\}/,'center root click writes canonical selection immediately');
assert.match(app,/\$:\s*selectedTask=taskRecords\.find\(item=>item\.taskId===selectedTaskId\)\?\?null/,'Task A to Task B detail switching is reactive');
assert.match(app,/selectedTaskWorkPackageContextCandidate=selectedTaskWorkPackageId\?resolveEntityContext/,'Task operations derives mapped entity context from the selected Task instead of selectedEntity');

assert.equal((app.match(/<TaskRightContextInspector/g)??[]).length,1,'right-panel routing is unchanged');
assert.match(inspector,/GlobalTaskDetail \{task\}/,'compact GlobalTaskDetail remains scoped to the existing right inspector');
assert.match(app,/selectedRunId=initialWorkspace\.selectedRunId/,'entity Run selection remains separate');
assert.match(app,/globalSelectedRunId:string\|null=null/,'global Run selection remains separate');
assert.match(app,/GlobalExecutionComposerDock payload=\{bridgePayload\}/,'Global Composer remains mounted through its existing route');
assert.match(app,/\{#if globalWorkspace && activeGlobalTab==='PR'\}\s*<GlobalPrWorkspace records=\{snapshot\.pullRequests\.value\?\?\[\]\} selectedId=\{selectedPrNavigationId\} onSelect=\{selectPrCenterRecord\}\/>/,'PR Root retains its existing center workspace route');
assert.match(app,/\{:else if prTab\}<section class="pr-panel" data-testid="pr-detail"/,'PR Detail retains its existing center route');

console.log('Task Root existing detail routing tests passed');
