import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {readWorkPackage} from './controlService.ts';
import {projectGlobalWorkPackages} from './globalWorkspaceProjection.ts';
import {createProjectSnapshot,normalizeRoadmap} from './model/projectModel.ts';
import {resolveEntityContext} from './context/entityContext.ts';

const homepageId='WP-WORK-PACKAGE-Homepage-001';
const roadmap=readFileSync(new URL('../../docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',import.meta.url),'utf8');
const nodes=normalizeRoadmap(roadmap);
const snapshot=createProjectSnapshot({roadmapNodes:nodes,formalWorkPackages:{[homepageId]:readWorkPackage(homepageId)}});
const projected=projectGlobalWorkPackages(snapshot);
const homepage=projected.find(item=>item.wp_id===homepageId);
const context=resolveEntityContext(snapshot,{type:'work_package',id:homepageId});

assert.equal(projected.length,nodes.flatMap(node=>node.children).filter(node=>node.type==='work_package').length);
assert.equal(nodes.find(node=>node.id==='M3.86')?.children.some(node=>node.id===homepageId),true);
assert.equal(homepage?.milestone_id,'M3.86');
assert.equal(homepage?.title,'Work Package Homepage');
assert.equal(context.type,'work_package');
assert.equal(context.formalWorkPackage?.id,homepageId);
console.log('live Work Package runtime projection reconciliation tests passed');
