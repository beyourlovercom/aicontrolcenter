import test from 'node:test';
import assert from 'node:assert/strict';
import {createTrustedDevAuthority} from './dev-allowlist-trusted-authority.mjs';
const repo='beyourlovercom/YBY-Core';
const SHA='c'.repeat(40),DIGEST='a'.repeat(64);
const paths=['wp-content/plugins/yby-core/admin/class-yby-project-studio.php'];
const now=1_800_000_000_000;
const checks=['Release Package Validation','Andy Core Regression',
 'Newsletter M1 Disposable WordPress MySQL','Inquiry Inbox WordPress MySQL Validation'];
const manifest=()=>({
 environment:'dev',project:'byl-wordpress-core',releaseId:'release-20261014-001',
 authorizationReceipt:'owner-20261014-001',
 github:{repo,commitSha:SHA,prNumber:103,ciRunId:1234},
 artifact:{id:'artifact-20261014-001',sha256:'d'.repeat(64)},
 files:paths.map(path=>({path}))
});
function setup(){
 const m=manifest();
 const receipt={id:m.authorizationReceipt,environment:'dev',project:m.project,
  repo,commitSha:SHA,releaseId:m.releaseId,manifestSha256:DIGEST,
  issuedAtMs:now-1000,expiresAtMs:now+60_000,actions:['prepare','apply','rollback'],
  approvedPaths:paths};
 const pr={repo,number:103,headSha:SHA,merged:false,base:'feature/business-os-b1-1-content-consolidation'};
 const workflow={id:1234,headSha:SHA,status:'completed',conclusion:'success'};
 const workflowChecks=checks.map(name=>({name,headSha:SHA,status:'completed',conclusion:'success'}));
 const artifact={repo,commitSha:SHA,id:m.artifact.id,sha256:m.artifact.sha256,immutable:true,paths};
 const state={receipt,pr,workflow,workflowChecks,artifact};
 const a=createTrustedDevAuthority({clock:()=>now,
  github:{getPullRequest:async()=>state.pr,getWorkflowRun:async()=>state.workflow,
    listCommitChecks:async()=>state.workflowChecks},
  approvals:{getReceipt:async()=>state.receipt,canView:async()=>false},
  artifacts:{getImmutableArtifact:async()=>state.artifact}});
 return {state,m,authority:a};
}
const attest=f=>f.authority.attest({action:'apply',manifest:f.m,manifestSha256:DIGEST});
test('trusted exact identity and all required CI checks approve Dev',async()=>{
 const f=setup();const a=await attest(f);
 assert.equal(a.allowed,true);assert.deepEqual(a.approvedPaths,paths);
});
test('Owner expired, revoked and wrong approved file scope deny',async()=>{
 for(const key of ['expiresAtMs','revoked','approvedPaths']){
  const f=setup();f.state.receipt[key]=key==='expiresAtMs'?now:key==='revoked'?true:['wp-config.php'];
  await assert.rejects(attest(f));
 }
});
test('scope mismatch and fake PR HEAD deny',async()=>{
 for(const key of ['headSha','merged']){
  const f=setup();f.state.pr[key]=key==='headSha'?'e'.repeat(40):true;
  await assert.rejects(attest(f));
 }
});
test('CI incomplete or failure denies',async()=>{
 for(const name of checks){
  const f=setup();f.state.workflowChecks=f.state.workflowChecks.filter(x=>x.name!==name);
  await assert.rejects(attest(f),{message:'REQUIRED_CI_INCOMPLETE'});
 }
 const f=setup();f.state.workflow.conclusion='failure';
 await assert.rejects(attest(f),{message:'CI_NOT_SUCCESS'});
});
test('unverified or different artifact denies',async()=>{
 for(const key of ['immutable','sha256','paths']){
  const f=setup();f.state.artifact[key]=key==='immutable'?false:key==='sha256'?'e'.repeat(64):['wp-config.php'];
  await assert.rejects(attest(f),{message:'ARTIFACT_IDENTITY_DENIED'});
 }
});
test('an Owner receipt cannot grant an action not in approved scope',async()=>{
 const f=setup();f.state.receipt.actions=['prepare'];
 await assert.rejects(attest(f),{message:'OWNER_SCOPE_OR_EXPIRY_DENIED'});
});
test('read-only status requires independent explicit authorization',async()=>{
 const f=setup();assert.equal(await f.authority.canView({project:f.m.project,releaseId:f.m.releaseId,principal:{id:'role'}}),false);
});
test('cannot construct authority with an omitted trusted provider',()=>{
 assert.throws(()=>createTrustedDevAuthority({}),{message:'AUTHORITY_ADAPTER_MISSING'});
});
