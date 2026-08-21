import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeRoadmap} from './model/projectModel.ts';
import {parseFormalWorkPackageRegistry} from './taskEntityBinding.ts';

const roadmap=`## Active V2 Milestones
### M1 — Existing
Work Packages: \`AICC-EXISTING-001\` — \`ACTIVE\`; Existing Work Package

### M3 — First Usable Version Closure

#### 3.86 — Work Package Lifecycle
\`WP-WORK-PACKAGE-Homepage-001\` — \`PLANNED\`; Work Package Homepage.
Phase 1 — Canonical Selection + Root Contract [PLANNED]
Random prose mentions \`WP-NOT-DECLARED-001\` but does not declare it.
## Legacy Historical Milestones
`;

const first=normalizeRoadmap(roadmap);
const second=normalizeRoadmap(roadmap);
assert.deepEqual(first,second,'canonical Work Package projection is deterministic');
assert.deepEqual(first.flatMap(milestone=>milestone.children.map(node=>node.id)),['AICC-EXISTING-001','WP-WORK-PACKAGE-Homepage-001']);
assert.equal(first[1]?.children[0]?.parentId,'M3');
assert.equal(first[1]?.children[0]?.title,'Work Package Homepage');
assert.equal(first[1]?.children[0]?.phaseProgress?.totalPhases,1);
assert.equal(first.flatMap(milestone=>milestone.children).some(node=>node.id==='WP-NOT-DECLARED-001'),false,'unstructured WP-like prose cannot create a Work Package');
const registry=parseFormalWorkPackageRegistry(roadmap);
assert.equal(registry.get('AICC-EXISTING-001')?.milestoneId,'M1');
assert.deepEqual(registry.get('WP-WORK-PACKAGE-Homepage-001'),{formalWpId:'WP-WORK-PACKAGE-Homepage-001',title:'Work Package Homepage',milestoneId:'M3',milestoneTitle:'M3 — First Usable Version Closure'});

const numberedListRoadmap=`## Active V2 Milestones
### M8 — AICC Lifecycle Intelligence

#### 8.3 — Global Canonical Lifecycle Projection
Work Package: \`AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1\`

#### 8.4 — Bridge Result Return & Auto Loop Reliability
Work Packages, in strict order:

1. \`AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1\`
2. \`AICC_AUTO_LOOP_FEEDBACK_DELIVERY_AND_TURN_CORRELATION_V1\`

Historical trace mentions \`AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1\` again, but is not a declaration.
\`\`\`
1. \`AICC-NOT-A-WORK-PACKAGE\`
\`\`\`

#### 8.5 — Work Package Homepage
Work Packages:

- Delivery group
  - \`WP-WORK-PACKAGE-Homepage-001\`
  - \`custom_work_package.2\`

#### 8.6 — Repository Contract Hygiene
\`AICC_REPOSITORY_STALE_TEST_DEBT_CLEANUP_V1\` — \`PLANNED\`; Repository Contract Hygiene

#### 8.7 — AICC V2 Final Real End-to-End Human UAT
Status: \`PLANNED\`
## Legacy Historical Milestones
### M8.4 — Historical trace
Work Packages:
1. \`AICC-HISTORICAL-NOT-PROJECTED\`
`;
const numbered=normalizeRoadmap(numberedListRoadmap);
const m8=numbered.find(node=>node.id==='M8');
assert.deepEqual(m8?.children.filter(node=>node.roadmapGroupNumber==='8.4').map(node=>node.id),['AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1','AICC_AUTO_LOOP_FEEDBACK_DELIVERY_AND_TURN_CORRELATION_V1'],'numbered-list Work Packages retain canonical order without duplicates');
assert.equal(m8?.children.some(node=>node.id==='AICC-NOT-A-WORK-PACKAGE'),false,'prose and code-block examples are not projected');
assert.deepEqual(m8?.children.filter(node=>node.roadmapGroupNumber==='8.5').map(node=>node.id),['WP-WORK-PACKAGE-Homepage-001','custom_work_package.2'],'nested bullet declarations discover underscore and non-AICC-prefix IDs');
assert.equal(numbered.some(node=>node.id==='M8.7'),false,'subsections never become Roadmap entities');
assert.equal(numbered.flatMap(node=>node.children).some(node=>node.id==='AICC-HISTORICAL-NOT-PROJECTED'),false,'Legacy Historical Milestones are non-authoritative');

const canonical=normalizeRoadmap(readFileSync(new URL('../../docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',import.meta.url),'utf8'));
const canonicalM8=canonical.find(node=>node.id==='M8');
assert.ok(canonicalM8,'M8 is the only M8 lifecycle entity in Revision 5 canonical source');
assert.equal(canonical.some(node=>['M8.3','M8.4','M8.5','M8.6','M8.7'].includes(node.id)),false,'M8 subsections never project as entities');
assert.deepEqual(canonicalM8?.children.filter(node=>node.roadmapGroupNumber==='8.4').map(node=>node.id),['AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1','AICC_AUTO_LOOP_FEEDBACK_DELIVERY_AND_TURN_CORRELATION_V1'],'Revision 5 8.4 has exactly its two canonical Work Packages');
assert.ok(canonicalM8?.children.some(node=>node.id==='WP-WORK-PACKAGE-Homepage-001'&&node.roadmapGroupNumber==='8.5'),'existing non-AICC-prefix Work Package remains discovered under its display grouping');
console.log('roadmap structural Work Package discovery tests passed');
