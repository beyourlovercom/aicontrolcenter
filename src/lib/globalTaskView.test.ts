import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {buildGlobalTaskGroups,summarizeGlobalTasks} from './globalTaskView.ts';
import {scopeTasksToEntity} from './entityScope.ts';

const groups=buildGlobalTaskGroups([
  {id:'running',state:'RUNNING',runId:'run-a',instruction:{workPackageId:'WP-A',title:'A'}},
  {id:'ready',state:'READY',instruction:{workPackageId:'WP-B',title:'B'}},
  {id:'failed',state:'FAILED',instruction:{workPackageId:'WP-A',title:'C'}},
  {id:'done',state:'COMPLETED',runId:'run-b',instruction:{workPackageId:'WP-B',title:'D'}},
  {id:'raw',state:'READY',instruction:{title:'raw'}}
]);
assert.equal(groups.inProgress[0].workPackageId,'WP-A');
assert.equal(groups.waitingOwner[0].workPackageId,'WP-B');
assert.equal(groups.needsAction[0].state,'FAILED');
assert.equal(groups.recentCompleted[0].runId,'run-b');
assert.equal(groups.waitingOwner[1].scope,'GLOBAL_TASK');
assert.equal(Object.keys(groups).length,4);
assert.equal(groups.inProgress[0].entity?.id,'WP-A');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const prNavigation=readFileSync(new URL('../components/PrNavigation.svelte',import.meta.url),'utf8');
const detail=readFileSync(new URL('../components/GlobalTaskDetail.svelte',import.meta.url),'utf8');
const inspector=readFileSync(new URL('../components/TaskRightContextInspector.svelte',import.meta.url),'utf8');
const nav=readFileSync(new URL('../components/GlobalTaskView.svelte',import.meta.url),'utf8');
const runtimeWorkspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const canonicalFeedRow=readFileSync(new URL('../components/CanonicalTaskFeedRow.svelte',import.meta.url),'utf8');
const appCss=readFileSync(new URL('../app.css',import.meta.url),'utf8');
const blueprint=readFileSync(new URL('../components/GlobalBlueprintWorkspace.svelte',import.meta.url),'utf8');
const wp=readFileSync(new URL('../components/GlobalWpWorkspace.svelte',import.meta.url),'utf8');
assert.match(nav,/全局 PR#/,'global PR navigation entry');
assert.match(app,/PrNavigation records=\{\(prLayer2\?\.records\?\?\[\]\)\}/,'global PR navigation is connected to the Layer 2 left sidebar');
assert.match(prNavigation,/PR #\{record\.prNumber\}/,'global PR rows expose repository PR numbers');
assert.match(app,/import GlobalPrWorkspace/,'the global PR workspace remains the canonical center PR surface');
assert.match(detail,/task_id/);assert.match(detail,/run_id/);assert.match(detail,/Original Instruction/);assert.match(detail,/Canonical Result/);assert.match(detail,/resultProjection\?\.result/,'Task detail uses the canonical result projection pipeline');
assert.match(app,/selectedTaskId/);assert.match(app,/onSelectTask=\{selectCanonicalTask\}/);assert.match(app,/TaskRightContextInspector/,'task right inspector wiring remains explicit');
assert.match(app,/\{:else if activeGlobalTab==='TASK'&&selectedTask\}<TaskRightContextInspector/,'canonical Task selection temporarily replaces right evidence only in Task workspace after project context is ready');
assert.match(app,/TaskRightContextInspector task=\{selectedTask\} runtime=\{selectedTaskRuntime\} report=\{selectedTaskReport\}/,'right inspector receives the canonical task projection directly');
assert.match(app,/function clearSelectedTask\(\)\{selectedTaskId=null;/,'closing the inspector clears the single canonical selection authority');
assert.match(app,/\{:else\}<div class="panel-header">[\s\S]*EntityEvidencePanel/,'deselecting a Task and non-Task pages retain the evidence panel');
assert.doesNotMatch(app,/<GlobalTaskView[^\n]*\/>\{#if selectedTask\}/,'Task detail is no longer appended below the center task list');
assert.doesNotMatch(app,/function selectCanonicalTask[\s\S]{0,240}(?:setGlobalTab|selectedEntity=|scrollIntoView)/,'Task selection preserves page, entity, and center-page scroll position');
assert.match(nav,/selectedTaskId/,'Task table reflects canonical row selection');
assert.match(nav,/TaskTitleTrigger taskId=\{item\.canonicalTaskId\}[\s\S]*selected=\{selectedTaskId===item\.canonicalTaskId\}/,'selected canonical Task trigger exposes its state accessibly');
assert.match(app,/tasks=\{scopedTaskRecords\} \{selectedTaskId\} onSelectTask=\{selectCanonicalTask\}/,'WP Task projection delegates canonical records and selection');
assert.match(runtimeWorkspace,/CanonicalTaskFeed/,'WP runtime surface reuses the unified canonical Feed');
assert.match(canonicalFeedRow,/TaskTitleTrigger taskId=\{row\.taskId\}/,'shared Feed row reuses the canonical Task trigger');
assert.match(inspector,/GlobalTaskDetail \{task\} \{runtime\} \{report\} \{resultProjection\} embedded/,'inspector reuses the canonical Task detail and result projection');
assert.match(inspector,/\.task-inspector-scroll\{[\s\S]*overflow-y:auto/,'right inspector scrolls independently');
assert.match(inspector,/onClose/,'inspector exposes deselection without owning selection state');
assert.match(detail,/onViewWorkPackage/,'bound WP navigation is delegated to the canonical workspace router');
const globalTabs=app.match(/<nav class="global-tab-switcher"[\s\S]*?<\/nav>/)?.[0]??'';
assert.match(globalTabs,/global-top-tab-switcher/);assert.equal((globalTabs.match(/>蓝图<|>WP<|>PR<|>Task</g)??[]).length,4);assert.match(app,/RoadmapTree nodes/);assert.match(app,/activeGlobalTab/);assert.doesNotMatch(app,/01 \/ ROADMAP/);assert.doesNotMatch(app,/GLOBAL TASKS card/);
assert.match(app,/GlobalBlueprintWorkspace/);assert.match(app,/GlobalWpWorkspace/);assert.match(blueprint,/Milestone Progress/);assert.match(blueprint,/Current Focus/);assert.match(blueprint,/Recent Project Activity/);assert.match(wp,/global-wp-list/);assert.match(wp,/onSelect\(\{type:'work_package'/);assert.match(app,/globalWorkPackages/);assert.match(app,/globalMilestones/);
const naturalUnbound=buildGlobalTaskGroups([{id:'natural-unbound',state:'READY',instruction:{instructionId:'natural-1',entityType:'GLOBAL_TASK',entityId:'GLOBAL_TASK',entityScope:'GLOBAL_TASK',workPackageId:null,prId:null}}]).waitingOwner[0];
assert.equal(naturalUnbound.scope,'GLOBAL_TASK');assert.equal(naturalUnbound.entity,undefined);assert.equal(naturalUnbound.workPackageId,undefined);
const naturalOrigin=buildGlobalTaskGroups([{id:'natural-origin',state:'READY',instruction:{instructionId:'natural-2',entityType:'WORK_PACKAGE',entityId:'WP-A',workPackageId:'WP-A',originContext:{executionContext:{type:'work_package',id:'WP-A'}}}}]).waitingOwner[0];
assert.equal(naturalOrigin.entity?.id,'WP-A');
const legitimate=buildGlobalTaskGroups([{id:'explicit-terminal',state:'READY',instruction:{instructionId:'owner-terminal',entityType:'WORK_PACKAGE',entityId:'AICC-V2-TERMINAL-HANDOFF-001',workPackageId:'AICC-V2-TERMINAL-HANDOFF-001'}}]).waitingOwner[0];
assert.equal(legitimate.entity?.id,'AICC-V2-TERMINAL-HANDOFF-001');
const canonicalGroups=buildGlobalTaskGroups([
  {taskId:'task-old',status:'READY',createdAt:'2026-08-15T00:00:00.000Z',instructionId:'old',workPackageId:null,prId:null,instruction:{entityType:'GLOBAL_TASK',entityId:'GLOBAL_TASK',entityScope:'GLOBAL_TASK'}},
  {taskId:'task-new',status:'RUNNING',createdAt:'2026-08-15T01:00:00.000Z',instructionId:'new',runId:'run-new',workPackageId:'WP-A',prId:null,instruction:{entityType:'WORK_PACKAGE',entityId:'WP-A',entityScope:'WORK_PACKAGE'}}
]);
assert.equal(canonicalGroups.inProgress[0].id,'task-new','canonical task identity is used by All Tasks');
assert.equal(canonicalGroups.inProgress[0].workPackageId,'WP-A','bound canonical task remains in global collection');
assert.equal(canonicalGroups.waitingOwner[0].id,'task-old','unbound canonical task remains globally visible');
const countGroups=buildGlobalTaskGroups([
  {taskId:'task-running',status:'RUNNING',createdAt:'2026-08-15T04:00:00.000Z',workPackageId:'WP-A',instruction:{entityType:'WORK_PACKAGE',entityId:'WP-A',entityScope:'WORK_PACKAGE'}},
  {taskId:'task-waiting',status:'WAITING_OWNER',createdAt:'2026-08-15T03:00:00.000Z',workPackageId:null,instruction:{entityType:'GLOBAL_TASK',entityId:'GLOBAL_TASK',entityScope:'GLOBAL_TASK'}},
  {taskId:'task-completed',status:'COMPLETED',createdAt:'2026-08-15T02:00:00.000Z',runId:'run-completed',workPackageId:'WP-A',instruction:{entityType:'WORK_PACKAGE',entityId:'WP-A',entityScope:'WORK_PACKAGE'}},
  {taskId:'task-failed',status:'FAILED',createdAt:'2026-08-15T01:00:00.000Z',runId:'run-failed',workPackageId:null,instruction:{entityType:'GLOBAL_TASK',entityId:'GLOBAL_TASK',entityScope:'GLOBAL_TASK'}}
]);
const summary=summarizeGlobalTasks(countGroups);
assert.deepEqual(summary,{all:4,running:1,waitingOwner:1,completed:1,failed:1,global:2},'summary lifecycle counts are mutually exclusive while Global remains a separate scope count');
assert.equal(summary.running+summary.waitingOwner+summary.completed+summary.failed,summary.all,'all lifecycle groups total exactly to All Tasks');
const wpTask=countGroups.inProgress[0].task;
const taskProjectScope={projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter'};
assert.equal(scopeTasksToEntity([{...wpTask,...taskProjectScope}],{type:'work_package',id:'WP-A'},taskProjectScope)[0].taskId,'task-running','WP and All Tasks projections retain the same canonical task identity under explicit project scope');
assert.match(nav,/formatOwnerLocalTime/,'task timestamps are rendered in Owner-local time');
assert.match(app,/import GlobalExecutionComposerDock/,'the App Shell imports the singleton composer dock');
assert.equal((app.match(/<GlobalExecutionComposerDock/g)??[]).length,1,'exactly one global composer dock is mounted');
assert.match(app,/class="center-workspace-shell center panel">[\s\S]*<GlobalExecutionComposerDock payload=\{bridgePayload\}/,'the singleton composer is scoped to the center App Shell');
assert.doesNotMatch(app,/data-testid="global-execution-workspace"/,'the former global input card is removed');
assert.match(app,/entityType=\{selectedTaskWorkPackageContext\?'work_package':'global_task'\}/,'Global Task retains its read-only canonical runtime projection');
assert.match(app,/scopeTasksToEntity/,'entity task projection filters canonical task records');
assert.match(app,/request\('\/api\/tasks'\)/,'runtime refresh reads the canonical task registry');
assert.match(app,/tasks=\{scopedTaskRecords\}/,'WP runtime surface projects its canonical tasks');
assert.match(app,/route\?\.entityType\?\.toLowerCase\(\)===selectedEntity\.type/,'global composer never implicitly assigns an explicit entity task to the current selection');
assert.match(app,/startRuntimePolling\(true\)/,'global launch polls only global runtime');
assert.match(nav,/GLOBAL \/ UNMAPPED/,'global projection renders explicit unbound state');
assert.match(nav,/item\.runId\?\?'NOT_STARTED'/,'unexecuted Tasks use explicit NOT_STARTED run semantics');
assert.match(nav,/legacy excluded/,'historical records are disclosed outside the canonical count');
assert.doesNotMatch(nav,/item\.scope==='GLOBAL_TASK'\?'GLOBAL':item\.state/,'scope is never rendered as lifecycle status');
assert.match(nav,/summarizeGlobalTasks/,'summary cards share the canonical grouping helper');
assert.ok((app.match(/createCanonicalTask:true/g)??[]).length>=2,'both Owner composer imports allocate canonical Tasks');
assert.ok((app.match(/legacyTaskCount=tasksResult\.value\.legacyCount\?\?legacyTaskCount/g)??[]).length>=2,'runtime refreshes preserve legacy disclosure counts');
const bridgeCore=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
assert.match(bridgeCore,/export function readTasks\(\):CanonicalTaskRecord\[\]\{return readTaskRegistryProjection\(\)\.items\}/,'Task reads use only the canonical registry projection');
assert.doesNotMatch(bridgeCore,/export function readTasks\(\)[^\n]*readInbox\(/,'Task reads never reconcile Inbox into new Tasks');
assert.match(vite,/readTaskProjectionReadOnly\(\)\.then\(projection=>json\(res,\{items:projection\.items,legacyCount:projection\.legacyCount\}\)\)/,'Task API returns canonical rows and separate legacy evidence count');
assert.match(appCss,/\.workspace\.task-workspace-active \.global-task-workspace,\.workspace\.task-workspace-active \.global-execution-workspace\{width:100%;min-width:0\}/,'task sections share the Task shell width contract');
assert.match(nav,/\.global-task-view\{\}/,'global task view has no outer card styling');
console.log('global task view tests passed');
