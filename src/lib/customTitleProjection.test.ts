import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProjectSnapshot,normalizeRoadmap,type EntityDisplayMetadata} from './model/projectModel.ts';

const wpId='AICC-V2-PR-RUNNER-001';
const prId='beyourlovercom/aicontrolcenter#42';
const roadmap=`## Active V2 Milestones\n### M4 — PR Runner Foundation\nWork Packages: \`${wpId}\`\n## Legacy Historical Milestones`;
const formal={[wpId]:{id:wpId,title:'Canonical PR Runner',source:'formal-wp',fields:{},sections:{}}};
const prs=[{id:prId,workPackageId:wpId,number:42,title:'Actual GitHub PR title',status:'IN_PROGRESS' as const,repository:'beyourlovercom/aicontrolcenter'}];
const descriptions:EntityDisplayMetadata[]=[
  {repositoryKey:'beyourlovercom/aicontrolcenter',entityType:'work_package',entityId:wpId,description:'Owner WP display title'},
  {repositoryKey:'beyourlovercom/aicontrolcenter',entityType:'pull_request',entityId:prId,description:'Owner PR display title'}
];

const custom=normalizeRoadmap(roadmap,false,prs,null,formal,descriptions);
const customWp=custom[0].children[0],customPr=customWp.children[0];
assert.equal(customWp.id,wpId,'custom WP title does not change canonical WP id');
assert.equal(customWp.title,'Owner WP display title');
assert.equal(customWp.displayTitle,'Owner WP display title');
assert.equal(customPr.id,prId,'custom PR title does not change canonical PR identity');
assert.equal(customPr.title,'Owner PR display title');

const fallback=normalizeRoadmap(roadmap,false,prs,null,formal,[]);
assert.equal(fallback[0].children[0].title,'Canonical PR Runner','WP falls back to formal title');
assert.equal(fallback[0].children[0].children[0].title,'Actual GitHub PR title','PR falls back to GitHub title');
const idFallback=normalizeRoadmap(roadmap,false,[{...prs[0],title:undefined,number:42}],null,{},[]);
assert.equal(idFallback[0].children[0].children[0].title,'PR #42','PR falls back to PR number');
const cleared=normalizeRoadmap(roadmap,false,prs,null,formal,descriptions.filter(item=>item.entityType!=='work_package'));
assert.equal(cleared[0].children[0].title,'Canonical PR Runner','clearing custom WP title restores canonical fallback');

const snapshot=createProjectSnapshot({roadmap:{source:'roadmap',content:roadmap},formalWorkPackages:formal,pullRequests:prs,entityDescriptions:descriptions});
assert.equal(snapshot.roadmap.value?.[0].children[0].title,'Owner WP display title','snapshot rebuilds with custom title metadata');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
assert.match(app,/boundedRequest\('\/api\/entity-descriptions'\)/,'refresh reads the canonical description source');
assert.match(app,/raw=\{\.\.\.raw,entityDescriptions/,'refresh/save updates the snapshot input');
const tree=readFileSync(new URL('../components/RoadmapTree.svelte',import.meta.url),'utf8');
assert.equal(tree.includes(wpId),false,'RoadmapTree has no hard-coded WP title or id');
console.log('custom title projection tests passed');
