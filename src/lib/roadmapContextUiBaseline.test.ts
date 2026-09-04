import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeRoadmap} from './model/projectModel.ts';
import {allRoadmapExpanded,expandableRoadmapIds,expandRoadmapAncestors,mapRoadmapStatusToVisualFamily,normalizeRoadmapProgress,roadmapEntityLabel,toggleCollapsedNode} from './roadmapUiBaseline.ts';

const markdown=`## Active V2 Milestones
### M1 — 生命周期开发智能化
Status: \`IN_PROGRESS\`
Progress: \`62%\`
Work Packages: \`AICC-WP-001\`

### AICC-WP-001 Phase Plan
Status: \`IN_PROGRESS\`
Progress: \`40%\`
Phase 1 — Foundation [COMPLETE]
Phase 2 — Auto Control Loop [ACTIVE]
## Legacy Historical Milestones`;
const nodes=normalizeRoadmap(markdown,false,[{id:'repo#12',workPackageId:'AICC-WP-001',number:12,title:'Bridge Runtime',status:'COMPLETE'}]);
const milestone=nodes[0],wp=milestone.children[0];
assert.equal(milestone.children[0].type,'work_package');
assert.equal(wp.children.every(node=>node.parentId===wp.id),true,'PR and Phase share one WP parent');
assert.equal(wp.children.some(node=>node.type==='phase'&&node.children.length>0),false,'Phase never contains Roadmap children');
assert.equal(Math.max(1,2,...wp.children.map(()=>3)),3,'Roadmap maximum visual depth is three');
assert.equal(nodes.flatMap(node=>node.children).some(node=>node.type==='phase'&&node.children.some(child=>child.type==='pull_request')),false);
assert.equal(milestone.progress,62,'Milestone reads explicit Markdown progress');
assert.equal(wp.progress,40,'WP reads explicit Markdown progress');
assert.equal(wp.children.every(node=>node.progress===null),true,'Phase and PR progress remain unavailable without explicit canonical metadata');
assert.equal(normalizeRoadmapProgress(101),null);assert.equal(normalizeRoadmapProgress(25.5),null);assert.equal(normalizeRoadmapProgress(25),25);
assert.equal(mapRoadmapStatusToVisualFamily('FAILED'),'BLOCKED');
assert.equal(mapRoadmapStatusToVisualFamily('RUNNING'),'ACTIVE');
assert.equal(mapRoadmapStatusToVisualFamily('CLOSED'),'COMPLETE');

const collapsed=new Set<string>();
assert.equal(allRoadmapExpanded(nodes,collapsed),true,'empty collapsed set starts fully expanded');
const collapsedMilestone=toggleCollapsedNode(collapsed,milestone.id);
assert.notEqual(collapsedMilestone,collapsed,'single toggle publishes a new Set reference');
assert.equal(collapsedMilestone.has(milestone.id),true);assert.equal(collapsedMilestone.size,1);
assert.equal(toggleCollapsedNode(collapsedMilestone,milestone.id).has(milestone.id),false);
const collapsedWp=toggleCollapsedNode(collapsedMilestone,wp.id);
assert.equal(collapsedWp.has(milestone.id),true);assert.equal(collapsedWp.has(wp.id),true);
const globallyCollapsed=new Set(expandableRoadmapIds(nodes));
assert.notEqual(globallyCollapsed,collapsedMilestone,'global collapse uses a new Set reference');
assert.equal(allRoadmapExpanded(nodes,globallyCollapsed),false);
assert.equal(allRoadmapExpanded(nodes,new Set()),true);
const located=expandRoadmapAncestors(nodes,wp.children[0].id,globallyCollapsed);
assert.equal(located.has(milestone.id),false);assert.equal(located.has(wp.id),false);
assert.equal(roadmapEntityLabel({id:'M1',displayCode:'M1',displayTitle:'Control Surface Finalization',title:'Control Surface Finalization'}),'M1 - Control Surface Finalization');
assert.equal(roadmapEntityLabel({id:'AICC-WP-001',displayCode:'WP',displayTitle:'AICC-WP-001',title:'AICC-WP-001'}),'WP - AICC-WP-001');
assert.equal(roadmapEntityLabel({id:'repo#12',displayCode:'PR12',displayTitle:'Runtime Result Panel',title:'Runtime Result Panel'}),'PR12 - Runtime Result Panel');
assert.equal(roadmapEntityLabel({id:'wp:phase:2',displayCode:'Phase 2',displayTitle:'Auto Control Loop',title:'Auto Control Loop'}),'Phase 2 - Auto Control Loop');

const tree=readFileSync(new URL('../components/RoadmapTree.svelte',import.meta.url),'utf8');
const context=readFileSync(new URL('../components/CurrentContextLocator.svelte',import.meta.url),'utf8');
const css=readFileSync(new URL('../roadmapDom.css',import.meta.url),'utf8');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
assert.match(tree,/depth<3/,'tree renderer hard-stops at visual depth three');
assert.match(tree,/class="tree-children"/,'children retain recursive DOM ownership');
assert.match(tree,/data-testid="roadmap-progress-column"/);assert.match(tree,/data-testid="roadmap-status-column"/);
assert.match(tree,/onclick=\{\(event\)=>\{event\.stopPropagation\(\);onToggle\(node\.id,event\)\}\}/,'fold has an isolated click path');
assert.match(tree,/!collapsedNodeIds\.has\(node\.id\)/,'render uses collapsed membership semantics');
assert.match(tree,/\{#if node\.children\.length&&!collapsedNodeIds\.has\(node\.id\)&&depth<3\}/,'child render condition directly tracks collapsed membership');
assert.match(tree,/onclick=\{\(\)=>onSelect\(node\)\}/,'row body selects without toggling');
assert.match(tree,/roadmap-status-tooltip/);assert.match(tree,/data-visual-family/);
assert.match(css,/grid-template-columns:18px minmax\(0,1fr\) 42px 24px/,'fixed progress and status columns');
assert.match(css,/\.tree-select\{[^}]*white-space:nowrap[^}]*overflow:hidden[^}]*text-overflow:ellipsis/,'entity label is one-line and overflow-safe');
assert.doesNotMatch(tree,/tree-code|tree-title/,'Roadmap label has no split code/title elements');
assert.doesNotMatch(css,/\.tree-code|\.tree-title/,'obsolete split-label CSS is removed');
assert.match(tree,/roadmapEntityLabel\(node\)/,'all entity types use the shared label formatter');
assert.match(context,/primaryLabel\|\|context\.id/,'Current Context uses the formatted primary label');
assert.match(css,/\.tree-toggle\{[^}]*opacity:0/);assert.match(css,/\.tree-row:hover \.tree-toggle/);assert.match(css,/\.tree-toggle\.expanded\{color:#159447/);
assert.doesNotMatch(context,/当前定位|Current Context/,'tutorial headings are removed');
assert.equal((context.match(/class="context-icon-button/g)??[]).length,4,'exactly four icon-only controls');
assert.doesNotMatch(context,/>定位<|>锁定<|>已锁定</,'controls expose no visible text labels');
assert.match(context,/executionContextLock\.locked\?'🔓':'🔒'/,'lock icon represents next action');
assert.match(context,/定位到当前上下文/,'locate action tooltip is explicit');
assert.match(context,/roadmapExpanded\?'▶️':'↕️'/,'expand icon represents next action');
assert.match(context,/roadmapExpanded\?'全部折叠':'全部展开'/,'expand action tooltip is explicit');
assert.match(context,/更新 Roadmap/,'refresh action tooltip is explicit');
assert.match(css,/\.current-context-actions\{[^}]*align-items:center[^}]*\}/);
assert.match(css,/\.current-context-actions\{[^}]*margin:0[^}]*padding:0[^}]*white-space:nowrap/);
assert.match(css,/\.context-icon-button\{[^}]*margin:0[^}]*padding:0/);
assert.match(app,/collapsedNodeIds/);assert.match(app,/selectedEntity/);assert.match(app,/executionContextLock/);
assert.match(app,/collapsedNodeIds=toggleCollapsedNode\(collapsedNodeIds,id\)/,'single fold updates only collapsed membership');
assert.match(app,/collapsedNodeIds=roadmapFullyExpanded\?new Set\(expandableRoadmapIds\(roadmapNodes\)\):new Set\(\)/,'global fold replaces the shared collapsed set');
assert.doesNotMatch(app,/roadmapExpandedNodes|initializeRoadmapExpandedNodes|AICC_FOLD_TRACE|AICC_FOLD_VALUE_TRACE/,'obsolete fold state and diagnostics are removed');
assert.match(app,/expandRoadmapAncestors/);assert.match(app,/scrollTo\(\{top:/);assert.match(app,/await select\(targetId\)/);
assert.match(app,/CurrentContextLocator[\s\S]*onToggleRoadmap=\{toggleEntireRoadmap\}/);
assert.match(context,/onSyncRoadmap/,'manual Roadmap sync control is present');
assert.match(app,/method:'POST'/,'manual sync uses the owner-only sync endpoint');
assert.match(app,/deserializeRoadmapProjection/,'manual sync accepts only a validated persisted projection');
console.log('Roadmap + Current Context frozen UI baseline tests passed');
