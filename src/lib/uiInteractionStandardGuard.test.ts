import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';

const standard=readFileSync(new URL('../../docs/00_Governance/AICC-V2-UI-INTERACTION-STANDARD-001.md',import.meta.url),'utf8');
const registry=readFileSync(new URL('../../docs/00_Governance/AICC-V2-BASELINE-REGISTRY.md',import.meta.url),'utf8');
const wpActions=readFileSync(new URL('../components/entity/OwnerActionZone.svelte',import.meta.url),'utf8');
const prActions=readFileSync(new URL('../components/entity/PrOwnerActionZone.svelte',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const header=readFileSync(new URL('../components/entity/EntityHeader.svelte',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../components/WorkflowTimeline.svelte',import.meta.url),'utf8');
const roadmap=readFileSync(new URL('../components/RoadmapTree.svelte',import.meta.url),'utf8');
const taskInteractionContract=readFileSync(new URL('../../docs/00_Governance/AICC_CANONICAL_TASK_INTERACTION_CONTRACT.md',import.meta.url),'utf8');
const taskFeedContract=readFileSync(new URL('../../docs/00_Governance/AICC_UNIFIED_CANONICAL_TASK_FEED_UI_CONTRACT.md',import.meta.url),'utf8');
const agents=readFileSync(new URL('../../AGENTS.md',import.meta.url),'utf8');
const coreControlLoop=readFileSync(new URL('../../docs/00_Governance/AICC_V2_CORE_CONTROL_LOOP.md',import.meta.url),'utf8');
const taskTitleTrigger=readFileSync(new URL('../components/TaskTitleTrigger.svelte',import.meta.url),'utf8');
const globalTaskView=readFileSync(new URL('../components/GlobalTaskView.svelte',import.meta.url),'utf8');
const canonicalTaskFeed=readFileSync(new URL('../components/CanonicalTaskFeed.svelte',import.meta.url),'utf8');
const canonicalTaskFeedRow=readFileSync(new URL('../components/CanonicalTaskFeedRow.svelte',import.meta.url),'utf8');
const runtimeWorkspace=readFileSync(new URL('../components/entity/RuntimeWorkspace.svelte',import.meta.url),'utf8');
const bridgeCore=readFileSync(new URL('./bridgeCore.ts',import.meta.url),'utf8');

assert.match(standard,/Version: `1\.5`/);
assert.match(standard,/Owner Action Zone is contextual, not a command toolbar/i);
assert.match(standard,/PRIMARY OWNER ACTION <= 1/);
assert.match(standard,/当前操作区/);
assert.match(standard,/刷新、local-main sync|Refresh, local-main sync/);
assert.match(standard,/Authorization appears only when/);
assert.match(standard,/Stop appears only while/);
assert.match(standard,/Retry appears[\s\S]*only after/);
assert.match(standard,/action surface consumes canonical state and remains a projection/i);
assert.match(standard,/Owner blocked status single source/i);
assert.match(registry,/AICC-V2-UI-INTERACTION-STANDARD-001 \| 1\.5(?: \(`AICC_ROADMAP_CONTEXT_UI_BASELINE = V1\.0`\))? \| FROZEN \/ APPROVED_BASELINE/);
assert.match(wpActions,/context\.availableActions/);
assert.match(prActions,/context\.availableActions/);
assert.match(app,/resolveOwnerStatusProjection\(context,bridgeOutbox\)/);
assert.match(app,/resolveOwnerWorkflowStages\(context,bridgeOutbox\)/);
assert.match(app,/projectWpRoadmapNodes\(roadmapProjection\?\.nodes\?\?\[\],wpProjection\)/,'Roadmap state consumes canonical WP Layer 2');
assert.doesNotMatch(app,/projectOwnerRoadmapNodes\(/,'Owner status must not override canonical Roadmap projection');
assert.match(header,/statusOverride/);
assert.match(workflow,/getStatusPresentationMeta\(stage\.status\)/);
assert.match(roadmap,/mapRoadmapStatusToVisualFamily/);
for(const source of [app,header,workflow,roadmap,wpActions,prActions]){
  assert.equal(/context\.status\s*===\s*['"]BLOCKED['"]/.test(source),false,'direct Owner blocked derivation');
  assert.equal(/lifecycle\.(?:effectiveStatus|status)\s*===\s*['"]BLOCKED['"]/.test(source),false,'direct lifecycle blocked derivation');
}
assert.equal((standard.match(/OwnerStatusProjection/g)??[]).length>=3,true);
assert.equal((standard.match(/PRIMARY OWNER ACTION <= 1/g)??[]).length>=1,true);
for(const invariant of [
  'CANONICAL_TASK_INTERACTION_HIERARCHY = PASS',
  'SHARED_TASK_TITLE_PRIMITIVE_REQUIRED = TRUE',
  'CANONICAL_TASK_TITLE_RENDERING_AUTHORITY = SHARED_TASK_TITLE_PRIMITIVE',
  'GLOBAL_TASK_SELECTION_AUTHORITY = SINGLE',
  'EXISTING_SELECTED_TASK_DETAIL_INSPECTOR = SINGLE_VISUAL_OWNER',
  'TASK_DETAIL_LOCATION = EXISTING_RIGHT_INSPECTOR',
  'FUTURE_TASK_SURFACE_CONTRACT',
  'NEW_TASK_SURFACE_REUSES_SHARED_TASK_TRIGGER = TRUE',
  'UNKNOWN_TASK_NOT_FABRICATED = PASS',
  'TASK_SWITCH_USES_EXISTING_INSPECTOR = TRUE',
  'PREVIOUS_RIGHT_CONTEXT_RESTORATION = REQUIRED',
  'TASK_INTERACTION_ARCHITECTURE_TEST_CONTRACT = PASS',
  'M8_2_1_9_GOVERNANCE_PRECONDITION = PASS'
]) assert.ok(taskInteractionContract.includes(invariant),`canonical Task interaction invariant: ${invariant}`);
assert.match(taskInteractionContract,/Task data[\s\S]*Canonical task_id[\s\S]*Shared Task Title Primitive[\s\S]*Global Task Selection Authority[\s\S]*Existing Selected Task Detail Inspector/);
assert.match(registry,/AICC_CANONICAL_TASK_INTERACTION_CONTRACT \| 1\.0 \| OWNER_APPROVED_BASELINE/);
assert.match(agents,/## Canonical Task Interaction Authority[\s\S]*AICC_CANONICAL_TASK_INTERACTION_CONTRACT\.md[\s\S]*NEW_TASK_SURFACE_REUSES_SHARED_TASK_TRIGGER = TRUE/);
assert.equal((agents.match(/FUTURE_TASK_SURFACE_CONTRACT/g)??[]).length,0,'AGENTS keeps only the mandatory summary');
assert.match(coreControlLoop,/## 16\. Canonical Task UI Interaction Reference[\s\S]*AICC_CANONICAL_TASK_INTERACTION_CONTRACT\.md/);
assert.equal((coreControlLoop.match(/SHARED_TASK_TITLE_PRIMITIVE_REQUIRED/g)??[]).length,0,'Core Control Loop keeps only a cross-reference');
const governanceFiles=readdirSync(new URL('../../docs/00_Governance/',import.meta.url)).filter(file=>file.endsWith('.md'));
const completeTaskContracts=governanceFiles.filter(file=>readFileSync(new URL(`../../docs/00_Governance/${file}`,import.meta.url),'utf8').includes('TASK_INTERACTION_ARCHITECTURE_TEST_CONTRACT = PASS'));
assert.deepEqual(completeTaskContracts,['AICC_CANONICAL_TASK_INTERACTION_CONTRACT.md'],'one complete canonical Task interaction rule body');
assert.match(taskTitleTrigger,/onclick=\{\(\)=>onSelect\(canonicalTaskId\)\}/,'shared Task title primitive delegates canonical task_id');
assert.match(globalTaskView,/TaskTitleTrigger taskId=\{item\.canonicalTaskId\}/,'known Global Task surface reuses the shared primitive');
assert.match(app,/tasks=\{scopedTaskRecords\} \{selectedTaskId\} onSelectTask=\{selectCanonicalTask\}/,'known WP Task surface receives canonical scoped records');
assert.match(runtimeWorkspace,/<CanonicalTaskFeed \{tasks\} \{selectedTaskId\} \{onSelectTask\}/,'Runtime workspace reuses the shared canonical feed');
assert.match(canonicalTaskFeed,/<CanonicalTaskFeedRow /,'canonical feed reuses one shared row');
assert.match(canonicalTaskFeedRow,/TaskTitleTrigger taskId=\{row\.taskId\}/,'canonical feed row reuses the shared Task title primitive');
assert.equal((runtimeWorkspace.match(/<CanonicalTaskFeed /g)??[]).length,1,'one canonical Feed mount per shared workspace');
assert.equal((app.match(/let selectedTaskId=/g)??[]).length,1,'global Task selection remains a single authority');
assert.equal((app.match(/<TaskRightContextInspector/g)??[]).length,1,'one existing Selected Task Detail Inspector mount point');
for(const invariant of [
  'WP_WORKSPACE_UI_STRUCTURE = PASS',
  'UNIFIED_TASK_FEED_CANONICAL_SOURCE = PASS',
  'ONE_CANONICAL_TASK_FEED_PER_WORKSPACE = TRUE',
  'TASK_SOURCE_IS_METADATA_NOT_NAVIGATION = TRUE',
  'TASK_SOURCE_MUST_NOT_CREATE_SEPARATE_TASK_LIST = TRUE',
  'SOURCE_PRESENTATION_MAPPING = PASS',
  'CANONICAL_SOURCE_VALUES_PRESERVED = PASS',
  'TASK_ROW_MODE = ONE_LINE',
  'TASK_FEED_COMPACT = PASS',
  'SHARED_ONE_LINE_TASK_ROW = REQUIRED',
  'SHARED_TASK_TITLE_PRIMITIVE = REQUIRED',
  'EXISTING_SELECTED_TASK_DETAIL_INSPECTOR = SINGLE_VISUAL_OWNER',
  'REDUNDANT_TASK_ROW_DETAIL_ACTIONS = FORBIDDEN',
  'DUPLICATE_PRIMARY_TASK_PROJECTIONS = NONE',
  'RUN_RESULT_CANONICAL_DATA_PRESERVED = PASS',
  'CURRENT_EXECUTION_SUMMARY_PRESERVED = PASS',
  'RUNTIME_MONITOR_PRESERVED = PASS',
  'EXECUTION_PROVIDER_PRESERVED = PASS',
  'NEW_TASK_COLLECTION_REUSES_CANONICAL_TASK_FEED = TRUE',
  'TASK_FEED_ARCHITECTURE_GUARD_CONTRACT = PASS',
  'M8_2_1_10_GOVERNANCE_PRECONDITION = PASS'
]) assert.ok(taskFeedContract.includes(invariant),`canonical Task feed invariant: ${invariant}`);
assert.match(taskFeedContract,/All Task Sources[\s\S]*Canonical Task Registry[\s\S]*Unified Canonical Task Feed Projection[\s\S]*Shared One-Line Task Row[\s\S]*Shared Task Title Primitive[\s\S]*Global Task Selection Authority[\s\S]*Existing Selected Task Detail Inspector/);
for(const source of ['CLIPBOARD','CLIPBOARD_DIRECT','WEB_BRIDGE','GPT_BLOCK','GPT_AUTO_CONTROL_LOOP']){
  assert.match(bridgeCore,new RegExp(`['"]${source}['"]`),`canonical Task source remains registered: ${source}`);
  assert.match(taskFeedContract,new RegExp(`\\x60${source}\\x60`),`registered Task source has an explicit presentation mapping: ${source}`);
}
assert.match(registry,/AICC_UNIFIED_CANONICAL_TASK_FEED_UI_CONTRACT \| 1\.0 \| OWNER_APPROVED_BASELINE/);
assert.match(agents,/## Unified Canonical Task Feed Authority[\s\S]*AICC_UNIFIED_CANONICAL_TASK_FEED_UI_CONTRACT\.md[\s\S]*ONE_CANONICAL_TASK_FEED_PER_WORKSPACE = TRUE[\s\S]*NEW_TASK_COLLECTION_REUSES_CANONICAL_TASK_FEED = TRUE/);
assert.equal((agents.match(/TASK_ROW_MODE = ONE_LINE/g)??[]).length,0,'AGENTS keeps only the mandatory Task feed summary');
assert.match(taskInteractionContract,/## Task Collection Projection Reference[\s\S]*AICC_UNIFIED_CANONICAL_TASK_FEED_UI_CONTRACT\.md[\s\S]*unified feed contract owns\s+Task collection composition/);
assert.equal((taskInteractionContract.match(/ONE_CANONICAL_TASK_FEED_PER_WORKSPACE/g)??[]).length,0,'Task interaction contract does not duplicate Task feed rules');
const completeTaskFeedContracts=governanceFiles.filter(file=>readFileSync(new URL(`../../docs/00_Governance/${file}`,import.meta.url),'utf8').includes('TASK_FEED_ARCHITECTURE_GUARD_CONTRACT = PASS'));
assert.deepEqual(completeTaskFeedContracts,['AICC_UNIFIED_CANONICAL_TASK_FEED_UI_CONTRACT.md'],'one complete canonical Task feed rule body');
console.log('UI interaction contextual action guard passed');
