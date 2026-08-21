import assert from 'node:assert/strict';
import {createProjectSnapshot} from './model/projectModel.ts';
import {resolveEntityContext} from './context/entityContext.ts';

const roadmap='## Active V2 Milestones\n### M1 — Control Surface Finalization\nWork Packages: `AICC-V2-TEST-001`\n## Legacy Historical Milestones';
const formal={id:'AICC-V2-TEST-001',title:'Persistence test',source:'test',fields:{},sections:{}};
const repository={repository:'/repo',branch:'rebuild/aicc-v2',head:'head-2',localMain:'main-2',remoteMain:'main-2',worktree:'CLEAN' as const,lastCommit:'test'};
const authorization={authorizationId:'auth-test',workPackageId:'AICC-V2-TEST-001',authoritySha:'main-2',branch:'rebuild/aicc-v2',headShaAtAuthorization:'head-2',repositoryRoot:'/repo',authorizedAt:'2026-01-01T00:00:00.000Z'};
const runtime={runId:'run-test',workPackageId:'AICC-V2-TEST-001',authorizationId:'auth-test',authoritySha:'main-2',branch:'rebuild/aicc-v2',startingHeadSha:'head-2',pid:null,threadId:'thread-test',phase:'COMPLETED',currentTask:'完成',latestEvent:'done',startedAt:'2026-01-01T00:00:00.000Z',lastActivityAt:'2026-01-01T00:01:00.000Z',implementationResult:'CODE_CHANGE_PRESENT',codeChangePresent:true};

function snapshot(extra:Record<string,unknown>={}){return createProjectSnapshot({roadmap:{source:'test',content:roadmap},formalWorkPackages:{'AICC-V2-TEST-001':formal},repository,...extra} as Parameters<typeof createProjectSnapshot>[0]);}

const authSnapshot=snapshot({authorization});
const authContext=resolveEntityContext(authSnapshot,{type:'work_package',id:'AICC-V2-TEST-001'});
assert.equal(authContext.type,'work_package');
if(authContext.type!=='work_package')throw new Error('work package context required');
assert.equal(authContext.authorization.state,'VALID');
assert.ok((authContext.progress??0)>0,'persisted authorization must advance lifecycle');
assert.equal(authSnapshot.roadmap.value?.[0].children.find(node=>node.id==='AICC-V2-TEST-001')?.progress,null,'Roadmap does not infer progress from persisted authorization');
assert.equal(authSnapshot.roadmap.value?.[0].progress,null,'Milestone does not average child lifecycle progress');

const implementationSnapshot=snapshot({authorization,runtime});
const implementationContext=resolveEntityContext(implementationSnapshot,{type:'work_package',id:'AICC-V2-TEST-001'});
assert.equal(implementationContext.type,'work_package');
if(implementationContext.type!=='work_package')throw new Error('work package context required');
assert.equal(implementationContext.lifecycle.stages.find(stage=>stage.id==='IMPLEMENTATION')?.status,'COMPLETE');
assert.ok((implementationContext.progress??0)>0,'persisted implementation must advance lifecycle');
assert.equal(implementationSnapshot.roadmap.value?.[0].children.find(node=>node.id==='AICC-V2-TEST-001')?.progress,null,'Roadmap remains Markdown-authoritative after implementation');

const restartedSnapshot=snapshot({authorization,runtime});
const restartedContext=resolveEntityContext(restartedSnapshot,{type:'work_package',id:'AICC-V2-TEST-001'});
assert.equal(JSON.stringify(restartedContext),JSON.stringify(implementationContext),'reconstructed store must rehydrate the same lifecycle truth');
console.log('lifecycle persistence integration tests passed');
