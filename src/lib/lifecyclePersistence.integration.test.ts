import assert from 'node:assert/strict';
import {createProjectSnapshot} from './model/projectModel.ts';
import {resolveEntityContext} from './context/entityContext.ts';
import {createEmptyGlobalStateReadModel} from './globalStateReadModel.ts';
import {projectWpLayer2} from './wpCanonicalProjection.ts';

const roadmap='## Active V2 Milestones\n### M1 — Control Surface Finalization\nWork Packages: `AICC-V2-TEST-001`\n## Legacy Historical Milestones';
const formal={id:'AICC-V2-TEST-001',title:'Persistence test',source:'test',fields:{},sections:{}};
const repository={repository:'/repo',branch:'rebuild/aicc-v2',head:'head-2',localMain:'main-2',remoteMain:'main-2',worktree:'CLEAN' as const,lastCommit:'test'};
const authorization={authorizationId:'auth-test',workPackageId:'AICC-V2-TEST-001',authoritySha:'main-2',branch:'rebuild/aicc-v2',headShaAtAuthorization:'head-2',repositoryRoot:'/repo',authorizedAt:'2026-01-01T00:00:00.000Z'};
const scope={projectId:'lifecycle-persistence-fixture',repositoryIdentity:'/repo',projectContextRevision:0} as const;
const runtime={runId:'run-test',projectId:scope.projectId,repositoryIdentity:scope.repositoryIdentity,workPackageId:'AICC-V2-TEST-001',authorizationId:'auth-test',authoritySha:'main-2',branch:'rebuild/aicc-v2',startingHeadSha:'head-2',pid:null,threadId:'thread-test',phase:'COMPLETED',currentTask:'完成',latestEvent:'done',startedAt:'2026-01-01T00:00:00.000Z',lastActivityAt:'2026-01-01T00:01:00.000Z',implementationResult:'CODE_CHANGE_PRESENT',codeChangePresent:true};

function snapshot(extra:Record<string,unknown>={}){return createProjectSnapshot({roadmap:{source:'test',content:roadmap},formalWorkPackages:{'AICC-V2-TEST-001':formal},repository,...extra} as Parameters<typeof createProjectSnapshot>[0]);}
function resolveTestContext(value:ReturnType<typeof snapshot>){const projection=projectWpLayer2(createEmptyGlobalStateReadModel(scope),value,[],scope);return resolveEntityContext(value,{type:'work_package',id:'AICC-V2-TEST-001'},undefined,projection,scope)}

const authSnapshot=snapshot({authorization});
const authContext=resolveTestContext(authSnapshot);
assert.equal(authContext.type,'work_package');
if(authContext.type!=='work_package')throw new Error('work package context required');
assert.equal(authContext.authorization.state,'VALID');
assert.equal(authContext.progress,null,'authorization may advance lifecycle state but cannot infer WP progress');
assert.equal(authSnapshot.roadmap.value?.[0].children.find(node=>node.id==='AICC-V2-TEST-001')?.progress,null,'Roadmap does not infer progress from persisted authorization');
assert.equal(authSnapshot.roadmap.value?.[0].progress,null,'Milestone does not average child lifecycle progress');

const implementationSnapshot=snapshot({authorization,runtime});
const implementationContext=resolveTestContext(implementationSnapshot);
assert.equal(implementationContext.type,'work_package');
if(implementationContext.type!=='work_package')throw new Error('work package context required');
assert.equal(implementationContext.lifecycle.stages.find(stage=>stage.id==='IMPLEMENTATION')?.status,'COMPLETE');
assert.equal(implementationContext.progress,null,'implementation evidence may advance lifecycle state but cannot infer WP progress');
assert.equal(implementationSnapshot.roadmap.value?.[0].children.find(node=>node.id==='AICC-V2-TEST-001')?.progress,null,'Roadmap remains Markdown-authoritative after implementation');

const restartedSnapshot=snapshot({authorization,runtime});
const restartedContext=resolveTestContext(restartedSnapshot);
assert.equal(JSON.stringify(restartedContext),JSON.stringify(implementationContext),'reconstructed store must rehydrate the same lifecycle truth');
console.log('lifecycle persistence integration tests passed');
