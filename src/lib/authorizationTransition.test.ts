import assert from 'node:assert/strict';
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
console.log('authorization transition contract tests passed');
