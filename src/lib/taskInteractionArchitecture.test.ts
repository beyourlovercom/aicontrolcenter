import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const trigger=readFileSync(new URL('../components/TaskTitleTrigger.svelte',import.meta.url),'utf8');
const globalTask=readFileSync(new URL('../components/GlobalTaskView.svelte',import.meta.url),'utf8');
const inspector=readFileSync(new URL('../components/TaskRightContextInspector.svelte',import.meta.url),'utf8');
const detail=readFileSync(new URL('../components/GlobalTaskDetail.svelte',import.meta.url),'utf8');
const roadmap=readFileSync(new URL('../components/RoadmapTree.svelte',import.meta.url),'utf8');
const globalPr=readFileSync(new URL('../components/GlobalPrWorkspace.svelte',import.meta.url),'utf8');
const runtime=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const feed=readFileSync(new URL('../components/CanonicalTaskFeed.svelte',import.meta.url),'utf8');
const feedRow=readFileSync(new URL('../components/CanonicalTaskFeedRow.svelte',import.meta.url),'utf8');
const taskProjection=readFileSync(new URL('./globalTaskView.ts',import.meta.url),'utf8');

assert.match(trigger,/<button class="task-title-trigger"/,'shared Task Title Primitive uses a semantic button');
assert.match(trigger,/onclick=\{\(\)=>onSelect\(canonicalTaskId\)\}/,'shared primitive delegates canonical task_id');
assert.match(trigger,/\{#if canonicalTaskId\}[\s\S]*\{:else\}[\s\S]*task-title-unresolved/,'unresolved text never fabricates a Task trigger');
assert.match(trigger,/UNKNOWN \/ UNMAPPED/,'combined unresolved Task identity fails closed');
assert.match(trigger,/text-overflow:ellipsis;white-space:nowrap/,'long Task identity remains compact');
assert.match(trigger,/:focus-visible/,'keyboard users retain visible focus');
assert.doesNotMatch(trigger,/fetch\(|selectedTask|TaskRightContextInspector|GlobalTaskDetail/,'shared primitive owns no data, selection, or Inspector state');

assert.match(globalTask,/import TaskTitleTrigger/,'Global Task uses the shared primitive');
assert.match(globalTask,/taskId=\{item\.canonicalTaskId\}/,'Global Task resolves only canonical task_id');
assert.doesNotMatch(globalTask,/onclick=\{\(\)=>onSelectTask\(item\.id\)\}/,'Global Task has no page-specific detail trigger');
assert.match(taskProjection,/const canonicalTaskId=typeof item\?\.taskId===['"]string['"]/,'projection distinguishes canonical task_id from fallback display identity');

assert.match(app,/function selectCanonicalTask\(taskId:string\)\{if\(!taskRecords\.some\(item=>item\.taskId===taskId\)\)return;/,'one global authority rejects unresolved task IDs');
assert.equal((app.match(/let selectedTaskId=/g)??[]).length,1,'one selected Task authority');
assert.equal((app.match(/function selectCanonicalTask/g)??[]).length,1,'one Task selection function');
const selectionAuthority=app.match(/function selectCanonicalTask\(taskId:string\)\{[^}]+\}/)?.[0]??'';
assert.match(app,/<GlobalTaskView[^\n]*onSelectTask=\{selectCanonicalTask\}/,'Global Task delegates to canonical authority');
assert.match(app,/tasks=\{scopedTaskRecords\} \{selectedTaskId\} onSelectTask=\{selectCanonicalTask\}/,'WP Task feed delegates to the same shared primitive and authority');
assert.match(feed,/CanonicalTaskFeedRow/,'WP Task feed reuses one shared row');
assert.match(feedRow,/TaskTitleTrigger taskId=\{row\.taskId\}[\s\S]*onSelect=\{onSelectTask\}/,'shared row delegates canonical task_id');
assert.doesNotMatch(selectionAuthority,/setGlobalTab|selectedEntity=/,'Task inspection preserves the current page');
assert.match(app,/\{:else if activeGlobalTab==='TASK'&&selectedTask\}<TaskRightContextInspector/,'one selected Task owns the existing right rail only in Task workspace');
assert.match(app,/function clearSelectedTask\(\)\{selectedTaskId=null;/,'close deselects the Task without route mutation');
assert.match(app,/\{:else\}<div class="panel-header">[\s\S]*EntityEvidencePanel/,'close restores the prior page right-side projection');
assert.equal((app.match(/<TaskRightContextInspector/g)??[]).length,1,'one Inspector mount point');
assert.equal((inspector.match(/<GlobalTaskDetail/g)??[]).length,1,'Inspector reuses one canonical detail owner');
assert.match(detail,/workPackageId=task\?\.formalWpId[\s\S]*task\?\.workPackageId[\s\S]*instruction\?\.formalWpId/,'Task binding comes from canonical Task data');
assert.doesNotMatch(detail,/selectedEntity|context\.|currentWorkPackage/,'current page context cannot overwrite Task binding');

assert.match(feedRow,/grid-template-columns:[^;}]*minmax\(160px,1\.7fr\)/,'WP Task feed preserves stable columns');
assert.match(feedRow,/min-height:36px/,'WP Task feed preserves compact row height');
assert.match(globalTask,/grid-template-columns:minmax\(150px,1\.4fr\) 48px 48px/,'Global Task center table keeps the compact ten-column contract');
assert.doesNotMatch(app,/scrollIntoView[\s\S]{0,120}selectCanonicalTask|selectCanonicalTask[\s\S]{0,120}scrollIntoView/,'Task title selection does not move source scroll');

assert.doesNotMatch(roadmap,/TaskTitleTrigger|onSelectTask|selectCanonicalTask/,'Roadmap does not fabricate Task links without canonical Task records');
assert.doesNotMatch(globalPr,/TaskTitleTrigger|onSelectTask|selectCanonicalTask/,'PR projection does not infer task_id from PR text');
assert.match(runtime,/focusedTask=focused\?tasks\.find\(task=>\(task\?\.latestRunId\?\?task\?\.runId\?\?task\?\.executionId\)===focused\.runId\|\|task\?\.runs\?\.some\(\(run:any\)=>run\?\.runId===focused\.runId\)\)\?\?null:null/,'Current Execution uses explicit canonical Task↔Run identities, including durable run history');
assert.doesNotMatch(runtime,/runtime-history-card|runtime-outbox/,'execution history and Outbox do not become competing Task lists');

const componentFiles=readdirSync(new URL('../components/',import.meta.url),{recursive:true}).filter(file=>typeof file==='string'&&file.endsWith('.svelte')) as string[];
const inspectorOwners=componentFiles.filter(file=>readFileSync(new URL(`../components/${file}`,import.meta.url),'utf8').includes('data-testid="task-right-context-inspector"'));
assert.deepEqual(inspectorOwners,['TaskRightContextInspector.svelte'],'no duplicate Task Detail Inspector');
console.log('canonical Task interaction architecture tests passed');
