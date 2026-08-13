import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProjectSnapshot} from './model/projectModel.ts';
import {resolveEntityContext} from './context/entityContext.ts';

const header=readFileSync(new URL('../components/entity/EntityHeader.svelte',import.meta.url),'utf8');
const evidence=readFileSync(new URL('../components/entity/EntityEvidencePanel.svelte',import.meta.url),'utf8');
const workflow=readFileSync(new URL('../components/WorkflowTimeline.svelte',import.meta.url),'utf8');
const css=readFileSync(new URL('../app.css',import.meta.url),'utf8');
assert.match(header,/StatusDot status=\{displayedStatus\} label=\{false\}/);assert.equal((header.match(/context\.statusLabel/g)??[]).length,1,'context status label is only the fallback source');
assert.equal((evidence.match(/class="metric-value"/g)??[]).length,6,'all milestone metric values render');assert.match(evidence,/summary\.complete\?\?'—'/,'zero uses nullish fallback');assert.match(evidence,/progress!==null/,'unavailable progress has explicit fallback');
assert.match(workflow,/\{#each stages as stage,i\}/);assert.match(css,/repeat\(9,minmax\(0,1fr\)\)/);assert.match(css,/@media \(max-width:767px\)\{\.workflow-timeline\{grid-template-columns:1fr/);assert.match(css,/grid-template-columns:0 0 minmax\(0,1fr\) 0 0/,'mobile shell maps all five children');assert.match(css,/\.center\{grid-column:3\}/,'center remains on the center track when drawers are fixed');
const roadmap='## Active V2 Milestones\n### M1 — Control Surface Finalization\nWork Packages: `AICC-V2-UI-WORKFLOW-001`, `AICC-V2-DUAL-PANEL-001`\n## Legacy Historical Milestones';
const snapshot=createProjectSnapshot({roadmap:{source:'roadmap.md',content:roadmap},formalWorkPackages:{}});
const milestone=resolveEntityContext(snapshot,{type:'milestone',id:'M1'});assert.equal(milestone.type,'milestone');if(milestone.type!=='milestone')throw Error('milestone expected');assert.deepEqual(milestone.summary,{workPackages:2,complete:0,waiting:1,blocked:0,pullRequests:0});
const current=resolveEntityContext(snapshot,{type:'work_package',id:'AICC-V2-UI-WORKFLOW-001'});assert.equal(current.type,'work_package');if(current.type!=='work_package')throw Error('WP expected');assert.equal(current.lifecycle.stages.length,9);assert.equal(current.lifecycle.currentStage,'HUMAN_UAT');assert.equal(current.lifecycle.stages.at(-1)?.id,'CLOSED');assert.equal(current.lifecycle.stages.at(-1)?.status,'NOT_STARTED');
const planned=resolveEntityContext(snapshot,{type:'work_package',id:'AICC-V2-DUAL-PANEL-001'});assert.equal(planned.type,'work_package');if(planned.type!=='work_package')throw Error('WP expected');assert.equal(planned.formalization,'PLANNED_ONLY');
console.log('final visual cleanup tests passed');
