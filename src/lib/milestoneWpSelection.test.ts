import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const progress=readFileSync(new URL('../components/entity/MilestoneProgress.svelte',import.meta.url),'utf8');
const tree=readFileSync(new URL('../components/RoadmapTree.svelte',import.meta.url),'utf8');
const css=readFileSync(new URL('../app.css',import.meta.url),'utf8');

assert.match(app,/let selectedEntity:SelectedEntityRef=/,'App selectedEntity remains the single canonical selection authority');
assert.match(app,/function inspectMilestoneWorkPackage\(milestoneId:string,workPackageId:string\)/,'center row clicks use the explicit inspect flow');
assert.match(app,/selectedEntity=\{type:'work_package',id:workPackageId\}/,'inspect flow writes the exact canonical WP identity');
assert.match(app,/centerViewMode='MILESTONE_OVERVIEW'/,'inspect flow keeps the center in Milestone Overview mode');
assert.match(app,/MilestoneView context=\{milestoneOverviewContext\}/,'the center remains the Milestone View after WP selection');
const inspectFlow=app.match(/function inspectMilestoneWorkPackage\([\s\S]*?\n  \}/)?.[0]??'';
assert.doesNotMatch(inspectFlow,/(?:readFormalWorkPackage|refreshRuntimeProjection)/,'WP inspection does not launch a runtime read or execution path');
assert.match(app,/if\(node\.type==='milestone'\)\{centerViewMode='MILESTONE_OVERVIEW';milestoneOverviewId=node\.id;\}/,'Milestone root selection restores the overview and clears concrete WP selection');
assert.match(progress,/class:selected=\{item\.child\.id===selectedWorkPackageId\}/,'the selected canonical WP is highlighted in the center row');
assert.match(progress,/aria-pressed=\{item\.child\.id===selectedWorkPackageId\}/,'selected state is exposed accessibly');
assert.match(css,/\.milestone-progress-row\.selected\{[^}]*background:var\(--accent-soft\)/,'selection visual is distinct from status-dot lifecycle visuals');
assert.match(tree,/data-roadmap-subsection/,'Roadmap groups remain display-only sections');
assert.doesNotMatch(tree,/onSelect\(entry\)/,'Roadmap groups cannot become a selected entity');
assert.match(app,/RoadmapTree nodes=\{roadmapNodes\} selectedId=\{selectedEntity\.id\}/,'left tree highlighting reads the same canonical selectedEntity');
assert.match(progress,/milestone-progress-list/,'Phase 1 vertical list is preserved');

console.log('Milestone canonical WP selection tests passed');
