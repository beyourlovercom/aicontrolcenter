import assert from 'node:assert/strict';
import {createProjectSnapshot,normalizeRoadmap} from './model/projectModel.ts';

const roadmap=`## Active V2 Milestones
### M3 — Self Development
Work Packages: \`AICC-V2-GPT-BRIDGE-001\` \`AICC-V2-AUTOPILOT-UNTIL-UAT-001\`
## Legacy Historical Milestones
`;
const nodes=normalizeRoadmap(roadmap);
assert.deepEqual(nodes[0].children.map(node=>node.id),['AICC-V2-GPT-BRIDGE-001','AICC-V2-AUTOPILOT-UNTIL-UAT-001'],'runtime read discovers new formal WPs');
assert.equal(nodes[0].children[0].type,'work_package','discovered WP is selectable entity');
assert.throws(()=>normalizeRoadmap('not a roadmap'),/ROADMAP_PARSE_FAILED/,'malformed roadmap is explicit');
const failed=createProjectSnapshot({roadmap:{source:'old',content:roadmap},sourceErrors:{roadmap:'ROADMAP_PARSE_FAILED'}});
assert.equal(failed.roadmap.availability,'UNAVAILABLE','parse failure clears stale roadmap');
assert.equal(failed.roadmap.errorCode,'ROADMAP_PARSE_FAILED','parse failure preserves stable code');
assert.equal(createProjectSnapshot({roadmap:{source:'live',content:roadmap}}).roadmap.availability,'AVAILABLE','valid refresh rebuilds roadmap');
console.log('roadmap runtime read tests passed');
