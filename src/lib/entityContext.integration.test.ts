import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createProjectSnapshot,resolveMilestoneStatus} from './model/projectModel.ts';
import {resolveEntityContext} from './context/entityContext.ts';
import {createEmptyGlobalStateReadModel} from './globalStateReadModel.ts';
import {projectWpLayer2} from './wpCanonicalProjection.ts';

const authorization={authorizationId:'auth-1',workPackageId:'AICC-V2-PR-RUNNER-001',authoritySha:'main-sha',branch:'rebuild/aicc-v2',headShaAtAuthorization:'head-sha',repositoryRoot:'/repo',authorizedAt:'now'};
const runtime={runId:'run-1',projectId:'entity-context-fixture',repositoryIdentity:'/repo',workPackageId:'AICC-V2-PR-RUNNER-001',authorizationId:'auth-1',authoritySha:'main-sha',branch:'rebuild/aicc-v2',startingHeadSha:'head-sha',pid:1,threadId:'thread',phase:'COMPLETED',currentTask:'done',latestEvent:'done',startedAt:'now',lastActivityAt:'now'};
const roadmap=readFileSync(new URL('../../docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',import.meta.url),'utf8');
const snapshot=createProjectSnapshot({roadmap:{source:'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md',content:roadmap},repository:{repository:'/repo',branch:'rebuild/aicc-v2',head:'head-sha',localMain:'main-sha',remoteMain:'main-sha',worktree:'CLEAN',lastCommit:'test'},formalWorkPackages:{'AICC-V2-PR-RUNNER-001':{id:'AICC-V2-PR-RUNNER-001',title:'PR Runner',source:'wp.md',fields:{},sections:{}},'AICC-V2-UI-WORKFLOW-001':{id:'AICC-V2-UI-WORKFLOW-001',title:'UI Workflow',source:'wp.md',fields:{REQUIRES_AUTHORIZATION:'false'},sections:{}}},authorization,runtime,lifecycleEvidence:[{repository:'/repo',workPackageId:'AICC-V2-UI-WORKFLOW-001',implementation:{status:'COMPLETE',recordedAt:'now'},validation:{status:'COMPLETE',checks:['test'],recordedAt:'now'}}],humanUat:[{repository:'/repo',workPackageId:'AICC-V2-UI-WORKFLOW-001',entityType:'work_package',status:'IN_PROGRESS',items:[],createdAt:'now',updatedAt:'now',source:'test'}]});

const scope={projectId:'entity-context-fixture',repositoryIdentity:'/repo',projectContextRevision:0} as const;
const wpProjection=projectWpLayer2(createEmptyGlobalStateReadModel(scope),snapshot,[],scope);
const resolveFixtureContext=(entity:any)=>resolveEntityContext(snapshot,entity,undefined,wpProjection,scope);
const milestone=resolveFixtureContext({type:'milestone',id:'M1'});assert.equal(milestone.type,'milestone');assert.equal(milestone.status,'UNAVAILABLE','Milestone lifecycle remains unavailable without explicit canonical lifecycle evidence');assert.equal(milestone.availableActions.length,1);assert.equal(resolveMilestoneStatus([]),'NOT_STARTED');
const current=resolveFixtureContext({type:'work_package',id:'AICC-V2-UI-WORKFLOW-001'});assert.equal(current.type,'work_package');if(current.type!=='work_package')throw Error('WP expected');assert.equal(current.lifecycle.currentStage,'HUMAN_UAT');assert.equal(current.authorization.state,'NONE');assert.equal(current.runtime,null);assert.equal(current.availableActions.find(action=>action.id==='AUTHORIZE')?.enabled,false);
const planned=resolveFixtureContext({type:'work_package',id:'AICC-V2-DUAL-PANEL-001'});assert.equal(planned.type,'work_package');if(planned.type!=='work_package')throw Error('WP expected');assert.equal(planned.formalization,'PLANNED_ONLY');assert.equal(planned.availableActions.find(action=>action.id==='AUTHORIZE')?.reasonCode,'FORMAL_WP_DOCUMENT_MISSING');
for(const entity of [{type:'milestone',id:'M1'},{type:'work_package',id:'AICC-V2-UI-WORKFLOW-001'},{type:'milestone',id:'M2'},{type:'work_package',id:'AICC-V2-HUMAN-UAT-001'},{type:'milestone',id:'M4'},{type:'work_package',id:'AICC-V2-PR-RUNNER-001'},{type:'milestone',id:'M1'}] as const){const context=resolveFixtureContext(entity);assert.equal(context.id,entity.id);assert.equal(context.type,entity.type)}
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');assert.equal((app.match(/let selectedEntity:/g)??[]).length,1);assert.equal(app.includes('selectedWp'),false);assert.equal(app.includes('resolveLifecycle'),false);assert.equal(app.includes('Parent Milestone: M4'),false);
console.log('entity context production-path integration tests passed');
