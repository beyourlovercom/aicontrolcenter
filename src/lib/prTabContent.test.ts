import assert from 'node:assert/strict';
import {createProjectSnapshot,LOCAL_DEMO_PR} from './model/projectModel.ts';
import {resolveEntityContext} from './context/entityContext.ts';
import {prTabIds,resolvePrTabView} from './context/prTabContent.ts';
const roadmap='## Active V2 Milestones\n### M1 — Control Surface Finalization\nWork Packages: `AICC-V2-DUAL-PANEL-001`\n## Legacy Historical Milestones';
const snapshot=createProjectSnapshot({localDevelopment:true,roadmap:{source:'roadmap',content:roadmap}});
const context=resolveEntityContext(snapshot,{type:'pull_request',id:LOCAL_DEMO_PR.id});
assert.equal(context.type,'pull_request');
if(context.type==='pull_request'){assert.deepEqual(prTabIds,['运行','UAT','概览','证据','Diff','Review','CI','Merge']);assert.equal((prTabIds as readonly string[]).includes('流程'),false);const views=prTabIds.map(tab=>resolvePrTabView(context,tab));assert.equal(new Set(views.map(view=>JSON.stringify(view.rows))).size,8);assert.equal(views.find(view=>view.tab==='Diff')?.rows.find(row=>row[0]==='Diff')?.[1],'NOT_BOUND / ABSENT');assert.equal(views.find(view=>view.tab==='Review')?.rows.find(row=>row[0]==='Review')?.[1],'NOT_AVAILABLE');assert.equal(views.find(view=>view.tab==='CI')?.rows.find(row=>row[0]==='Exact-head CI')?.[1],'NOT_AVAILABLE');assert.equal(views.find(view=>view.tab==='Merge')?.rows.find(row=>row[0]==='Mergeability')?.[1],'NOT_RUN');}
const review={review_id:'r1',repository:'org/repo',pr_number:7,head_sha:'A',reviewer:'bot',review_provider:'reviewer',review_status:'PASS' as const,review_summary:'ok',reviewed_at:'now'};
const ci={ci_run_id:'c1',repository:'org/repo',pr_number:7,head_sha:'A',provider:'github',workflow:'test',status:'COMPLETED',conclusion:'SUCCESS',started_at:'now',completed_at:'now'};
const exactPr={...LOCAL_DEMO_PR,id:'pr-exact',fixture:false,number:7,repository:'org/repo',headSha:'A',workPackageId:'AICC-V2-PR-RUNNER-001'};
const exactSnapshot=createProjectSnapshot({roadmap:{source:'roadmap',content:roadmap}, pullRequests:[exactPr], reviewEvidence:[review], ciEvidence:[ci]});
const exactContext=resolveEntityContext(exactSnapshot,{type:'pull_request',id:exactPr.id});
assert.equal(exactContext.type,'pull_request');
if(exactContext.type==='pull_request'){assert.equal(exactContext.exactHeadValidation?.review.current_for_head,true);assert.equal(resolvePrTabView(exactContext,'Review').rows.find(row=>row[0]==='Head match')?.[1],'CURRENT_FOR_HEAD');assert.equal(resolvePrTabView(exactContext,'CI').rows.find(row=>row[0]==='Head match')?.[1],'CURRENT_FOR_HEAD');}
console.log('PR tab content routing tests passed');
