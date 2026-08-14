import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProjectSnapshot} from './model/projectModel.ts';
import {resolveEntityContext} from './context/entityContext.ts';
import {parseOwnerHumanUatPlan} from './humanUat.ts';
import {resolveAvailableActions} from './context/actionEligibility.ts';
import {deterministicPrDeliveryBranch} from './controlService.ts';

const wpA='AICC-V2-PR-RUNNER-001',wpB='AICC-V2-RUNTIME-OPERATIONS-001';
const roadmap=`## Active V2 Milestones\n### M4 — PR Runner Foundation\nWork Packages: \`${wpA}\`, \`${wpB}\`\n## Legacy Historical Milestones`;
const repository={repository:'/repo',branch:'rebuild/aicc-v2',head:'head',localMain:'main',remoteMain:'main',worktree:'CLEAN' as const,lastCommit:'latest'};
const prs=[
  {id:'pr-12',number:12,workPackageId:wpA,status:'IN_PROGRESS' as const,state:'OPEN' as const,title:'PR Runner foundation',repository:'/repo',url:'https://github.com/example/repo/pull/12',sourceBranch:'feature/pr-runner',targetBranch:'main',headSha:'sha-12',correlationSource:'EXTERNAL_FACT' as const},
  {id:'pr-13',number:13,workPackageId:wpA,status:'WAITING_OWNER' as const,state:'DRAFT' as const,title:'PR Runner follow-up',repository:'/repo',sourceBranch:'feature/pr-runner-2',targetBranch:'main',headSha:'sha-13',correlationSource:'EXTERNAL_FACT' as const},
  {id:'pr-99',number:99,workPackageId:wpB,status:'COMPLETE' as const,state:'MERGED' as const,title:'Runtime unrelated PR',repository:'/repo',sourceBranch:'runtime',targetBranch:'main',headSha:'sha-99',correlationSource:'EXTERNAL_FACT' as const}
];
const snapshot=createProjectSnapshot({roadmap:{source:'roadmap',content:roadmap},repository,formalWorkPackages:{[wpA]:{id:wpA,title:'PR Runner',source:'wp',fields:{},sections:{}},[wpB]:{id:wpB,title:'Runtime',source:'wp',fields:{},sections:{}}},pullRequests:prs});
const roadmapPr=snapshot.roadmap.value?.find(node=>node.id==='M4')?.children.find(node=>node.id===wpA)?.children.map(node=>node.id);
assert.deepEqual(roadmapPr,['pr-12','pr-13']);
const wpContext=resolveEntityContext(snapshot,{type:'work_package',id:wpA});
assert.equal(wpContext.type,'work_package');
if(wpContext.type==='work_package'){
  assert.deepEqual(wpContext.relatedPullRequests.map(pr=>pr.id),['pr-12','pr-13']);
  assert.equal(wpContext.relatedPullRequests.some(pr=>pr.id==='pr-99'),false);
}
const prContext=resolveEntityContext(snapshot,{type:'pull_request',id:'pr-12'});
assert.equal(prContext.type,'pull_request');
if(prContext.type==='pull_request'){
  assert.equal(prContext.parentWorkPackageId,wpA);
  assert.equal(prContext.record?.headSha,'sha-12');
  assert.equal(prContext.record?.url,'https://github.com/example/repo/pull/12');
  assert.equal(resolveAvailableActions(prContext.entity,snapshot).find(item=>item.id==='PR_CREATE_DRAFT')?.enabled,false);
}
const unknown=resolveEntityContext(snapshot,{type:'pull_request',id:'pr-unknown'});
assert.equal(unknown.type,'pull_request');
if(unknown.type==='pull_request')assert.equal(unknown.parentWorkPackageId,null);
const plan=readFileSync(new URL('../../docs/60_Operations/work-packages/AICC-V2-PR-RUNNER-001.md',import.meta.url),'utf8');
assert.equal(parseOwnerHumanUatPlan(plan).length,5);
assert.equal(parseOwnerHumanUatPlan(plan).every(item=>item.id.startsWith('HUA-PR-')),true);
const sourceBranch='rebuild/aicc-v2',deliveryBranch=deterministicPrDeliveryBranch(wpA,'pr-workspace-001');
assert.notEqual(sourceBranch,deliveryBranch,'PR delivery branch is isolated from integration branch');
assert.equal(deterministicPrDeliveryBranch(wpA,'pr-workspace-001'),deliveryBranch,'reconnect reuses deterministic delivery branch');
assert.match(readFileSync(new URL('./context/prTabContent.ts',import.meta.url),'utf8'),/deliveryBranch/,'PR workspace projects delivery branch metadata');
const vite=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');
assert(vite.includes("readPrCreationRequest(p.prId)"));
assert(vite.includes("status:'ALREADY_REQUESTED'"));
assert(vite.includes('AUTO_PR_MERGE')===false);
console.log('PR Runner foundation matrix passed');
