import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeRoadmap} from './model/projectModel.ts';

const roadmap=readFileSync(new URL('../../docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',import.meta.url),'utf8');
const m8=normalizeRoadmap(roadmap).find(node=>node.id==='M8');
assert.ok(m8,'M8 remains a canonical Milestone');
for(const group of ['8.3','8.4','8.5','8.6','8.7'])assert.ok(m8.roadmapGroups?.some(candidate=>candidate.number===group),`Milestone Progress receives canonical ${group} presentation metadata`);
assert.deepEqual(m8.children.filter(child=>child.roadmapGroupNumber==='8.4').map(child=>child.id),['AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1','AICC_AUTO_LOOP_FEEDBACK_DELIVERY_AND_TURN_CORRELATION_V1'],'8.4 renders exactly its canonical Work Package pair');

const component=readFileSync(new URL('../components/entity/MilestoneProgress.svelte',import.meta.url),'utf8');
const css=readFileSync(new URL('../app.css',import.meta.url),'utf8');
assert.match(component,/milestone-progress-list/,'horizontal milestone track is replaced by a vertical list');
assert.doesNotMatch(component,/milestone-progress-track|milestone-progress-node/,'horizontal timeline nodes are removed');
assert.match(component,/context\.roadmapGroups/,'group headers are read from canonical Roadmap presentation metadata');
assert.match(component,/lifecycleStatus\('WORK_PACKAGE',child\.id,'wp\.progress'\)/,'WP progress is read from the Layer 2 global state model');
assert.match(component,/item\.child\.phaseProgress\?[^]*:'No phase plan'/,'missing phase plans remain explicit and do not fabricate counts');
assert.match(component,/item\.status==='UNKNOWN'\?'UNKNOWN'/,'UNKNOWN lifecycle status is preserved');
assert.match(css,/\.milestone-progress-row\{[^}]*min-height:68px/,'rows use a compact 64–76px vertical-list height');
assert.match(css,/\.milestone-progress-content strong[^}]*text-overflow:ellipsis[^}]*white-space:nowrap/,'long Work Package titles are ellipsized');
assert.doesNotMatch(css,/\.milestone-progress-track|\.milestone-progress-node/,'horizontal timeline CSS is removed');

console.log('Milestone vertical Work Package progress tests passed');
