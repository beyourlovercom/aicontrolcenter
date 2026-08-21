import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const inspector=readFileSync(new URL('../components/TaskRightContextInspector.svelte',import.meta.url),'utf8');
const detail=readFileSync(new URL('../components/GlobalTaskDetail.svelte',import.meta.url),'utf8');

assert.match(app,/\{#if activeGlobalTab==='TASK'&&selectedTask\}<TaskRightContextInspector/,'RIGHT_TASK_CONTEXT_AUTHORITY = selectedTaskId-derived selectedTask');
assert.doesNotMatch(app,/\{#if selectedTask\}<TaskRightContextInspector/,'TASK_RIGHT_CONTEXT_OUTSIDE_TASK_WORKSPACE = NO');
assert.equal((app.match(/<TaskRightContextInspector/g)??[]).length,1,'RIGHT_PANEL_ACTIVE_SURFACE_COUNT = 1');
assert.match(inspector,/GlobalTaskDetail \{task\} \{runtime\} \{report\} \{resultProjection\}/,'RIGHT_TASK_CONTEXT_REUSES_EXISTING_COMPONENT = PASS');
assert.doesNotMatch(inspector,/position:absolute|position:fixed|portal|z-index/,'RIGHT_TASK_CONTEXT_OVERLAY = NO; FLOATING = NO');
assert.match(inspector,/width:100%;min-width:0;max-width:100%;[^}]*overflow:hidden/,'TASK_04A_OVERFLOW_REGRESSION = PASS');
assert.match(inspector,/overflow-x:hidden;overflow-y:auto/,'RIGHT_PANEL_BREAKOUT = NO');
assert.match(detail,/navigator\.clipboard\?\.writeText\(result\.rawResult\)/,'COPY_USES_FULL_CANONICAL_VALUE = PASS');
assert.match(app,/activeGlobalTab==='PR'&&!selectedPrNavigationId/,'PR_RIGHT_PANEL_RESTORED_AFTER_TASK = PASS');
assert.match(app,/activeGlobalTab==='PR'&&selectedEntity\.type==='pull_request'/,'PR_RIGHT_PANEL_DETAIL_RESTORED_AFTER_TASK = PASS');
assert.match(app,/globalWorkspace && activeGlobalTab==='WP'/,'WP_RIGHT_PANEL_RESTORED_AFTER_TASK = PASS');
assert.match(app,/globalWorkspace && activeGlobalTab==='BLUEPRINT'/,'BLUEPRINT_RIGHT_PANEL_RESTORED_AFTER_TASK = PASS');
assert.match(app,/selectedTaskId=null;globalWorkspace=true/,'TOP_TASK_CLICK_CLEARS_RIGHT_CONTEXT = PASS');
assert.doesNotMatch(app,/rightSelectedTaskId|inspectorSelectedTaskId|taskEvidenceSelectedTaskId/,'NEW_RIGHT_TASK_SELECTION_STATE = NO');
const taskSelection=app.match(/function selectCanonicalTask\(taskId:string\)\{([^}]*)\}/)?.[1]??'';
assert.doesNotMatch(taskSelection,/selectedRunId|globalSelectedRunId/,'TASK_RUN_SELECTION_COLLAPSED = NO');
assert.match(app,/selectedRunId=initialWorkspace\.selectedRunId/,'RUNTIME_SELECTION_LOGIC_MODIFIED = NO');
assert.match(app,/GlobalExecutionComposerDock payload=\{bridgePayload\}/,'GLOBAL_COMPOSER_MODIFIED = NO');
assert.match(app,/\{#if globalWorkspace && activeGlobalTab==='PR'\}/,'PR_WORKSPACE_REGRESSION = PASS');
assert.match(app,/\{:else if globalWorkspace && activeGlobalTab==='WP'\}/,'WP_WORKSPACE_REGRESSION = PASS');
assert.match(app,/\{:else if globalWorkspace && activeGlobalTab==='BLUEPRINT'\}/,'BLUEPRINT_WORKSPACE_REGRESSION = PASS');
console.log('Task right context workspace replacement contract passed');
