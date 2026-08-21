import assert from 'node:assert/strict';
import {projectGlobalCounts,projectGlobalFocus,projectGlobalWorkPackages} from './globalWorkspaceProjection.ts';
import {createProjectSnapshot} from './model/projectModel.ts';

const roadmap=`## Active V2 Milestones
### M5 — Review + Exact-head CI
Work Packages: \`AICC-V2-REVIEW-EXACT-HEAD-CI-001\`
Current implementation phase: \`Phase 6 — Owner Human UAT\`

### AICC-V2-REVIEW-EXACT-HEAD-CI-001 Phase Plan
Phase 1 — Exact-head Evidence Model [COMPLETE]
Phase 6 — Owner Human UAT [ACTIVE]

### M1 — Foundation
Work Packages: \`AICC-V2-FOUNDATION-001\`
`;
const snapshot=createProjectSnapshot({roadmap:{content:roadmap,source:'01_LIVING_ROADMAP.md'},localDevelopment:false,formalWorkPackages:{'AICC-V2-REVIEW-EXACT-HEAD-CI-001':{id:'AICC-V2-REVIEW-EXACT-HEAD-CI-001',title:'Exact-head CI custom title',source:'formal',fields:{},sections:{}}},pullRequests:[{id:'pr-1',workPackageId:'AICC-V2-REVIEW-EXACT-HEAD-CI-001',status:'IN_PROGRESS'}]});
const tasks=[{taskId:'task-1',bindingState:'BOUND',formalWpId:'AICC-V2-REVIEW-EXACT-HEAD-CI-001',instruction:{formalWpId:'AICC-V2-REVIEW-EXACT-HEAD-CI-001',bindingState:'BOUND'}},{taskId:'unknown',bindingState:'UNMAPPED',instruction:{formalWpId:'UNKNOWN_WP',bindingState:'UNMAPPED'}}];
const rows=projectGlobalWorkPackages(snapshot,tasks);
const exactHead=rows.find(row=>row.wp_id==='AICC-V2-REVIEW-EXACT-HEAD-CI-001')!;
assert.equal(exactHead.custom_title,'Exact-head CI custom title');
assert.equal(exactHead.milestone_title,'M5 — Review + Exact-head CI'); assert.equal(exactHead.current_phase,'Owner Human UAT');
assert.equal(exactHead.phase_plan_availability,'AVAILABLE','real canonical phase plan is available to the WP row');
assert.equal(exactHead.roadmap_group_number,null); assert.equal(exactHead.roadmap_group_title,null);
const noPlan=rows.find(row=>row.wp_id==='AICC-V2-FOUNDATION-001')!;
assert.equal(noPlan.phase_plan_availability,'NOT_AVAILABLE','missing phase plan is truthful');
assert.equal(noPlan.current_phase,'—','missing phase plan does not fabricate a phase');
assert.equal(exactHead.related_pr_count,1); assert.equal(exactHead.related_task_count,1); assert.equal(exactHead.evidence_state,'NOT_BOUND');
assert.deepEqual(projectGlobalFocus(snapshot),{milestone:'M5 — Review + Exact-head CI',workPackage:'AICC-V2-REVIEW-EXACT-HEAD-CI-001',phase:'Owner Human UAT'});
assert.deepEqual((snapshot.roadmap.value??[]).map(m=>m.id),['M1','M5']);
assert.deepEqual(projectGlobalCounts(snapshot,tasks),{workPackages:2,pullRequests:1,tasks:2});
assert.equal(rows.some(row=>row.wp_id==='UNKNOWN_WP'),false);
console.log('global workspace projection tests passed');
