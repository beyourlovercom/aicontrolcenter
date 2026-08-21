import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {normalizeRoadmap} from './model/projectModel.ts';
import {projectGlobalStateReadModel,createEmptyGlobalStateReadModel} from './globalStateReadModel.ts';
import {projectWpLayer2} from './wpCanonicalProjection.ts';
import {createProjectSnapshot} from './model/projectModel.ts';
import {expandableRoadmapIds,roadmapGroupKey} from './roadmapUiBaseline.ts';

const source=readFileSync(new URL('../../docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',import.meta.url),'utf8');
const nodes=normalizeRoadmap(source);
const m8=nodes.find(node=>node.id==='M8');
assert.equal(m8?.type,'milestone','M8 is the canonical Milestone entity');
assert.equal(nodes.some(node=>node.id==='8.3'||node.id==='M8.3'),false,'8.3 is not a Roadmap entity');
assert.equal(nodes.some(node=>node.id==='M8.3'),false,'M8.3 is not a Milestone entity');
assert.ok(m8?.children.some(node=>node.id==='AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1'&&node.roadmapGroupNumber==='8.3'),'8.3 presentation grouping binds its exact Work Package');
assert.deepEqual(m8?.children.filter(node=>node.roadmapGroupNumber==='8.4').map(node=>node.id),['AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1','AICC_AUTO_LOOP_FEEDBACK_DELIVERY_AND_TURN_CORRELATION_V1'],'8.4 keeps its exact two Work Packages');
assert.ok(m8?.children.some(node=>node.id==='WP-WORK-PACKAGE-Homepage-001'&&node.roadmapGroupNumber==='8.5'),'unprefixed Work Package remains canonical under 8.5');
for(const group of ['8.3','8.4','8.5','8.6','8.7'])assert.ok(source.includes(`#### ${group} —`)||source.includes(`##### ${group} —`),`${group} is a presentation heading`);
assert.ok(m8?.roadmapGroups?.some(group=>group.number==='8.7'),'an empty subsection remains presentation metadata, never an entity');
assert.equal((source.match(/^#{3,6}\s+M\d+\.\d+(?:\.\d+)*\s+—/gm)??[]).length,0,'active structural subsection labels omit the M entity prefix');

const snapshot=createProjectSnapshot({roadmap:{source:'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',content:source},formalWorkPackages:{}});
const scope={projectId:'aicc',repositoryIdentity:'beyourlovercom/aicontrolcenter',projectContextRevision:0};
const projection=projectWpLayer2(createEmptyGlobalStateReadModel(scope),snapshot,[],scope);
assert.ok(projection.records.every(record=>record.milestoneId!=='M8.3'),'Layer 2 binds Work Packages directly to M8');
assert.equal(projection.model.entities.some(entity=>entity.identity.id==='8.3'||entity.identity.id==='M8.3'),false,'no subsection enters the Global State Read Model');
assert.equal(projectGlobalStateReadModel(createEmptyGlobalStateReadModel(scope),{entities:[],bindings:[]}).entities.length,0,'no hidden subsection lifecycle authority is synthesized');
assert.ok(expandableRoadmapIds(nodes).includes(roadmapGroupKey('M8','8.4')),'display grouping may fold without becoming selectable');

const agents=readFileSync(new URL('../../AGENTS.md',import.meta.url),'utf8');
for(const rule of ['AICC_ROADMAP_HIERARCHY_SEMANTICS_V2 = FROZEN','ROADMAP_SUBSECTION_IS_ENTITY = FALSE','ROADMAP_SUBSECTION_IS_GLOBAL_STATE_ENTITY = FALSE','ROADMAP_SUBSECTION_LIFECYCLE_AUTHORITY = NONE','TRACK_ENTITY = NOT_USED'])assert.equal((agents.match(new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'g'))??[]).length,1,`${rule} is the only active governance rule`);
assert.doesNotMatch(agents,/MILESTONE\s*->\s*ROADMAP_SECTION\s*->\s*WORK_PACKAGE|ROADMAP_SECTION_IS_STRUCTURAL_NODE\s*=\s*TRUE|milestones\[\]\s*->\s*sections\[\]/,'conflicting Roadmap hierarchy governance is absent');

const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
const tree=readFileSync(new URL('../components/RoadmapTree.svelte',import.meta.url),'utf8');
assert.match(app,/type GlobalTab='BLUEPRINT'\|'WP'\|'PR'\|'TASK'/,'global navigation remains Blueprint | WP | PR | Task');
assert.match(app,/expandableRoadmapIds\(roadmapNodes\)\.includes\(id\)/,'subsection folding is presentation-only');
assert.match(tree,/data-roadmap-subsection/);assert.doesNotMatch(tree,/onSelect\(entry\)/,'subsection headings have no selection authority');
console.log('Roadmap hierarchy semantics simplification tests passed');
