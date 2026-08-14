import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProjectSnapshot,LOCAL_DEMO_PR,normalizeRoadmap} from './model/projectModel.ts';
import {resolveEntityContext} from './context/entityContext.ts';
const roadmap='## Active V2 Milestones\n### M1 — Control Surface Finalization\nWork Packages: `AICC-V2-DUAL-PANEL-001`\n## Legacy Historical Milestones';
const local=createProjectSnapshot({localDevelopment:true,roadmap:{source:'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',content:roadmap}});
const m1=local.roadmap.value?.find(node=>node.id==='M1');
assert.equal(m1?.children[0]?.children[0]?.id,LOCAL_DEMO_PR.id);
assert.equal(resolveEntityContext(local,{type:'pull_request',id:LOCAL_DEMO_PR.id}).type,'pull_request');
const normalized=normalizeRoadmap(roadmap,true,[]);
assert.equal(normalized[0]?.children[0]?.children[0]?.id,LOCAL_DEMO_PR.id,'local Roadmap restores the existing Demo PR mapping');
assert.equal(normalized[0]?.children[0]?.children[0]?.type,'pull_request');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');
assert.match(app,/localDevelopment:true/,'the app enables the existing local Demo PR fixture boundary');
assert.match(app,/findRoadmapNode\(roadmapNodes,id\)/,'Roadmap selection keeps nested PR entities selectable');
if(m1){const ctx=resolveEntityContext(local,{type:'milestone',id:'M1'});assert.equal(ctx.type,'milestone');if(ctx.type==='milestone')assert.equal(ctx.summary.pullRequests,0);}
const production=createProjectSnapshot({localDevelopment:false,roadmap:{source:'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',content:roadmap}});
assert.equal(production.pullRequests.value?.length,0);
console.log('demo PR fixture boundary tests passed');
