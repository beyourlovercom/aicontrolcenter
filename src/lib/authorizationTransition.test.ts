import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {authorizationSupersessionBlocker,type Authorization,type RepositoryModel} from './controlService.ts';

const repo:RepositoryModel={repository:'/repo',branch:'rebuild/aicc-v2',head:'current-head',localMain:'main',remoteMain:'main',worktree:'CLEAN',lastCommit:'test'};
const old:Authorization={authorizationId:'old',workPackageId:'AICC-V2-PR-RUNNER-001',authoritySha:'main',branch:repo.branch,headShaAtAuthorization:'old-head',repositoryRoot:repo.repository,scope:[],allowed:[],forbidden:[],authorizedAt:'old',status:'ACTIVE'};
const safe={activeRuntime:false,writerLockHeld:false};
assert.equal(authorizationSupersessionBlocker('AICC-V2-DUAL-PANEL-001',repo,old,safe),null,'different inactive WP can supersede');
assert.equal(authorizationSupersessionBlocker('AICC-V2-DUAL-PANEL-001',repo,old,{activeRuntime:true,writerLockHeld:false}),'ACTIVE_RUNTIME_CONFLICT','active runtime blocks supersession');
assert.equal(authorizationSupersessionBlocker('AICC-V2-DUAL-PANEL-001',repo,old,{activeRuntime:false,writerLockHeld:true}),'WRITER_LOCK_HELD','writer lock blocks supersession');
assert.equal(authorizationSupersessionBlocker('AICC-V2-DUAL-PANEL-001',{...repo,worktree:'DIRTY'},old,safe),'WORKTREE_DIRTY','dirty worktree remains protected');
assert.equal(authorizationSupersessionBlocker('AICC-V2-DUAL-PANEL-001',{...repo,branch:'main'},old,safe),'FEATURE_BRANCH_REQUIRED','main branch remains protected');
assert.equal(authorizationSupersessionBlocker('AICC-V2-DUAL-PANEL-001',repo,{...old,repositoryRoot:'/other'},safe),'AUTHORIZATION_REPOSITORY_MISMATCH','repository mismatch remains protected');
assert.equal(authorizationSupersessionBlocker('AICC-V2-DUAL-PANEL-001',repo,{...old,branch:'other'},safe),'AUTHORIZATION_BRANCH_MISMATCH','branch mismatch remains protected');
assert.equal(authorizationSupersessionBlocker('AICC-V2-DUAL-PANEL-001',repo,{...old,authoritySha:'other'},safe),'AUTHORITY_DRIFT','authority drift remains protected');
const app=readFileSync(new URL('../App.svelte',import.meta.url),'utf8');const server=readFileSync(new URL('../../vite.config.ts',import.meta.url),'utf8');const service=readFileSync(new URL('./controlService.ts',import.meta.url),'utf8');
assert(app.includes('selectedEntityId:requestedId'),'request target echoes selected entity');assert(app.includes('AUTHORIZATION_POSTCONDITION_FAILED'),'success requires refreshed postcondition');assert(app.includes("startContext.authorization.record?.workPackageId!==selectedEntity.id"),'Codex start target gate');assert(server.includes('payload.selectedEntityId !== payload.workPackageId'),'server target integrity gate');assert(server.includes('AUTHORIZATION_PERSISTENCE_INTEGRITY_FAILED'),'server persistence postcondition');assert(service.includes('readAuthorizationHistory'),'history remains queryable');
console.log('authorization transition contract tests passed');
