import assert from 'node:assert/strict';
import {createProjectSnapshot,LOCAL_DEMO_PR} from './model/projectModel.ts';
import {resolveEntityContext} from './context/entityContext.ts';
import {prTabIds,resolvePrTabView} from './context/prTabContent.ts';
const roadmap='## Active V2 Milestones\n### M1 — Control Surface Finalization\nWork Packages: `AICC-V2-DUAL-PANEL-001`\n## Legacy Historical Milestones';
const snapshot=createProjectSnapshot({localDevelopment:true,roadmap:{source:'roadmap',content:roadmap}});
const context=resolveEntityContext(snapshot,{type:'pull_request',id:LOCAL_DEMO_PR.id});
assert.equal(context.type,'pull_request');
if(context.type==='pull_request'){const views=prTabIds.map(tab=>resolvePrTabView(context,tab));assert.equal(new Set(views.map(view=>JSON.stringify(view.rows))).size,7);assert.equal(views.find(view=>view.tab==='Diff')?.rows.find(row=>row[0]==='Diff')?.[1],'NOT_BOUND / ABSENT');assert.equal(views.find(view=>view.tab==='Review')?.rows.find(row=>row[0]==='Review')?.[1],'NOT_RUN');assert.equal(views.find(view=>view.tab==='CI')?.rows.find(row=>row[0]==='Exact-head CI')?.[1],'NOT_RUN');}
console.log('PR tab content routing tests passed');
