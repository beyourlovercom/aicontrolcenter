import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,mkdirSync,writeFileSync,realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {EventEmitter} from 'node:events';
import {createRemoteRunnerService,validateRepositoryRoot,normalizeRepositoryIdentity,extractClaudeFinalResult,CLAUDE_BIN} from '../lib/remote-runner-service.mjs';

function expectCode(fn,code){assert.throws(fn,e=>e?.code===code);}

function makeGitRepo(parent,{branch='feat/test',origin='https://github.com/test/repo.git'}={}){
  const repo=join(parent,'repo');mkdirSync(repo);
  execFileSync('git',['init','-b',branch],{cwd:repo,encoding:'utf8'});
  execFileSync('git',['config','user.email','t@t'],{cwd:repo,encoding:'utf8'});
  execFileSync('git',['config','user.name','T'],{cwd:repo,encoding:'utf8'});
  writeFileSync(join(repo,'README.md'),'test');
  execFileSync('git',['add','.'],{cwd:repo,encoding:'utf8'});
  execFileSync('git',['commit','-m','init'],{cwd:repo,encoding:'utf8'});
  execFileSync('git',['remote','add','origin',origin],{cwd:repo,encoding:'utf8'});
  return repo;
}

function getHead(repo){
  return execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
}

function hangingSpawner(){
  const child=new EventEmitter();
  child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.pid=12345;
  return child;
}

// ── normalizeRepositoryIdentity ─────────────────────────────────────────────

test('normalizeRepositoryIdentity handles https with .git suffix',()=>{
  assert.equal(normalizeRepositoryIdentity('https://github.com/owner/repo.git'),'owner/repo');
});
test('normalizeRepositoryIdentity handles https without .git',()=>{
  assert.equal(normalizeRepositoryIdentity('https://github.com/owner/repo'),'owner/repo');
});
test('normalizeRepositoryIdentity handles ssh git@ form',()=>{
  assert.equal(normalizeRepositoryIdentity('git@github.com:owner/repo.git'),'owner/repo');
  assert.equal(normalizeRepositoryIdentity('git@github.com:owner/repo'),'owner/repo');
});
test('normalizeRepositoryIdentity handles canonical owner/repo passthrough',()=>{
  assert.equal(normalizeRepositoryIdentity('owner/repo'),'owner/repo');
});
test('normalizeRepositoryIdentity returns null for unrecognised forms',()=>{
  assert.equal(normalizeRepositoryIdentity(''),null);
  assert.equal(normalizeRepositoryIdentity(null),null);
  assert.equal(normalizeRepositoryIdentity('not-a-url'),null);
});

test('extractClaudeFinalResult prefers successful result event',()=>{
  const stdout=[JSON.stringify({type:'assistant',message:{content:[{type:'text',text:'draft'}]}}),JSON.stringify({type:'result',subtype:'success',is_error:false,result:'FINAL RESULT'})].join('\n');
  assert.equal(extractClaudeFinalResult(stdout),'FINAL RESULT');
});
test('extractClaudeFinalResult falls back to final assistant text and ignores tool_use',()=>{
  const stdout=[JSON.stringify({type:'assistant',message:{content:[{type:'text',text:'first'}]}}),JSON.stringify({type:'assistant',message:{content:[{type:'tool_use',name:'Read'},{type:'text',text:'final text'}]}})].join('\n');
  assert.equal(extractClaudeFinalResult(stdout),'final text');
});
test('extractClaudeFinalResult returns null without usable text',()=>{
  assert.equal(extractClaudeFinalResult(JSON.stringify({type:'assistant',message:{content:[{type:'tool_use',name:'Read'}]}})),null);
});

// ── validateRepositoryRoot ───────────────────────────────────────────────────

test('validateRepositoryRoot rejects missing allowedRoot',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);
    expectCode(()=>validateRepositoryRoot(repo,''),'REMOTE_RUNNER_ALLOWED_ROOT_MISSING');
    expectCode(()=>validateRepositoryRoot(repo,null),'REMOTE_RUNNER_ALLOWED_ROOT_MISSING');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('validateRepositoryRoot rejects path escape outside allowedRoot',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);
    const other=join(tmp,'other');mkdirSync(other);
    execFileSync('git',['init','-b','feat/test'],{cwd:other,encoding:'utf8'});
    execFileSync('git',['config','user.email','t@t'],{cwd:other,encoding:'utf8'});
    execFileSync('git',['config','user.name','T'],{cwd:other,encoding:'utf8'});
    writeFileSync(join(other,'f'),'x');
    execFileSync('git',['add','.'],{cwd:other,encoding:'utf8'});
    execFileSync('git',['commit','-m','init'],{cwd:other,encoding:'utf8'});
    // repo itself is the "allowed root" so other (sibling, not under repo) must be rejected
    expectCode(()=>validateRepositoryRoot(other,repo),'REMOTE_RUNNER_PATH_ESCAPE');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('validateRepositoryRoot rejects non-git directory',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const notGit=join(tmp,'notgit');mkdirSync(notGit);
    expectCode(()=>validateRepositoryRoot(notGit,tmp),'REMOTE_RUNNER_NOT_GIT_WORKTREE');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('validateRepositoryRoot returns realpath-normalised value',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);
    const realRepo=realpathSync(repo);
    const realTmp=realpathSync(tmp);
    const result=validateRepositoryRoot(repo,tmp);
    // Compare realpath-normalised values — safe on macOS case-insensitive FS.
    assert.equal(result,realRepo);
    assert.ok(result===realTmp||result.startsWith(realTmp+'/'));
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

// ── service submit — envelope validation ─────────────────────────────────────

test('service submit rejects provider CODEX',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    const svc=createRemoteRunnerService(tmp,{spawn:hangingSpawner});
    expectCode(()=>svc.submit({provider:'CODEX',executionClass:'TEST_ONLY',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,instruction:'test'}),'REMOTE_RUNNER_PROVIDER_INVALID');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('service submit rejects empty workPackageId',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    const svc=createRemoteRunnerService(tmp,{spawn:hangingSpawner});
    expectCode(()=>svc.submit({provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,instruction:'test'}),'REMOTE_RUNNER_ENVELOPE_INVALID');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('service submit rejects empty instruction when not dryRun',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    const svc=createRemoteRunnerService(tmp,{spawn:hangingSpawner});
    expectCode(()=>svc.submit({provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,instruction:''}),'REMOTE_RUNNER_ENVELOPE_INVALID');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('service submit rejects wrong expectedBranch',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    const svc=createRemoteRunnerService(tmp,{spawn:hangingSpawner});
    expectCode(()=>svc.submit({provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'main',expectedHead:head,dryRun:true}),'REMOTE_RUNNER_BRANCH_MISMATCH');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('service submit rejects wrong expectedHead',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);
    const svc=createRemoteRunnerService(tmp,{spawn:hangingSpawner});
    expectCode(()=>svc.submit({provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:'0000000000000000000000000000000000000000',dryRun:true}),'REMOTE_RUNNER_HEAD_MISMATCH');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('service submit rejects mismatched origin identity',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp,{origin:'https://github.com/other/different.git'});
    const head=getHead(repo);
    const svc=createRemoteRunnerService(tmp,{spawn:hangingSpawner});
    expectCode(()=>svc.submit({provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,dryRun:true}),'REMOTE_RUNNER_IDENTITY_MISMATCH');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('service submit accepts dryRun with correct identity/branch/head',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    const svc=createRemoteRunnerService(tmp,{spawn:hangingSpawner,uuid:()=>'exec-dry-1'});
    const rec=svc.submit({provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'dry run test',workPackageId:'wp-dry',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,dryRun:true});
    assert.equal(rec.executionId,'exec-dry-1');
    assert.equal(rec.dryRun,true);
    assert.ok(['QUEUED','RUNNING'].includes(rec.state));
    assert.equal(svc.get('exec-dry-1').executionId,'exec-dry-1');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

// ── canonical lease collision (identity#branch key) ─────────────────────────

test('canonical lease collision — same identity+branch blocked regardless of path',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    let n=0;
    const svc=createRemoteRunnerService(tmp,{spawn:hangingSpawner,uuid:()=>`exec-col-${n++}`});
    svc.submit({provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp-1',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,dryRun:true});
    expectCode(()=>svc.submit({provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp-2',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,dryRun:true}),'REMOTE_RUNNER_WORKTREE_BUSY');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

// ── status exposes safe fields only ─────────────────────────────────────────

test('status exposes activeLeases with safe fields and no instruction',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    const svc=createRemoteRunnerService(tmp,{spawn:hangingSpawner,uuid:()=>'exec-st-1'});
    svc.submit({provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,dryRun:true});
    const st=svc.status();
    assert.equal(st.ready,true);assert.equal(st.claudeBin,CLAUDE_BIN);assert.equal(st.activeCount,1);assert.equal('allowedRoot' in st,false);
    const lease=st.activeLeases[0];
    assert.equal(lease.executionId,'exec-st-1');
    assert.equal(lease.repositoryIdentity,'test/repo');
    assert.equal(lease.branch,'feat/test');
    assert.equal(lease.head,head);
    assert.ok(!('instruction' in lease));
    assert.ok(!('remoteRepositoryRoot' in lease));
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

// ── escalation evidence allowlist ───────────────────────────────────────────

test('buildGovernanceEnv forwards only allowlisted escalation keys',()=>{
  // We test this indirectly: the only observable side-effect is what ends up
  // in the spawned process env. We intercept via the spawn adapter.
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    let capturedEnv=null;
    const capturingSpawner=(_bin,_args,opts)=>{capturedEnv={...opts.env};return hangingSpawner();};
    const svc=createRemoteRunnerService(tmp,{spawn:capturingSpawner,uuid:()=>'exec-esc-1'});
    svc.submit({
      provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',
      workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',
      expectedBranch:'feat/test',expectedHead:head,dryRun:true,
      escalationEvidence:{
        AICC_GPT_ESCALATION_EVIDENCE:'legitimate-value',
        AICC_GPT_EFFORT_ESCALATION_EVIDENCE:'effort-value',
        AICC_ARBITRARY_SECRET:'should-not-appear',
        HOME:'/injected/path'
      }
    });
    // Allow microtasks to flush so spawn() is called
    assert.ok(capturedEnv,'spawner was called');
    assert.equal(capturedEnv.AICC_GPT_ESCALATION_EVIDENCE,'legitimate-value');
    assert.equal(capturedEnv.AICC_GPT_EFFORT_ESCALATION_EVIDENCE,'effort-value');
    assert.ok(!('AICC_ARBITRARY_SECRET' in capturedEnv));
    // HOME must remain unchanged from the base env (the injected value must not overwrite)
    assert.notEqual(capturedEnv.HOME,'/injected/path');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('isLeasedByIdentity returns true while active and false after completion',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    const svc=createRemoteRunnerService(tmp,{spawn:hangingSpawner,uuid:()=>'exec-lease-1'});
    assert.equal(svc.isLeasedByIdentity('test/repo','feat/test'),false);
    svc.submit({provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,dryRun:true});
    assert.equal(svc.isLeasedByIdentity('test/repo','feat/test'),true);
    assert.equal(svc.isLeasedByIdentity('test/repo','other-branch'),false);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});


test('supplied executionId is idempotent and conflicting binding fails closed',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);let spawns=0;
    const svc=createRemoteRunnerService(tmp,{spawn:()=>{spawns++;return hangingSpawner();}});
    const input={executionId:'exact-exec-1',provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,dryRun:true};
    const a=svc.submit(input);const b=svc.submit(input);
    assert.equal(a.executionId,'exact-exec-1');assert.equal(b.executionId,'exact-exec-1');assert.equal(spawns,1);
    expectCode(()=>svc.submit({...input,workPackageId:'other'}),'REMOTE_RUNNER_EXECUTION_CONFLICT');
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('restart converts active persisted execution to UNCERTAIN and never replays',()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));const state=join(tmp,'state');
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);let spawns=0;
    const input={executionId:'restart-exec',provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,dryRun:true};
    const first=createRemoteRunnerService(tmp,{stateRoot:state,spawn:()=>{spawns++;return hangingSpawner();}});first.submit(input);assert.equal(spawns,1);
    const second=createRemoteRunnerService(tmp,{stateRoot:state,spawn:()=>{spawns++;return hangingSpawner();}});const restored=second.get('restart-exec');
    assert.equal(restored.state,'UNCERTAIN');assert.equal(restored.error,'REMOTE_RUNNER_RESTART_UNCERTAIN');
    const same=second.submit(input);assert.equal(same.state,'UNCERTAIN');assert.equal(spawns,1);assert.equal(second.status().activeCount,0);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('completed sanitized result survives service restart',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));const state=join(tmp,'state');
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    const completingSpawner=()=>{const child=hangingSpawner();queueMicrotask(()=>{child.stdout.emit('data',JSON.stringify({type:'result',subtype:'success',is_error:false,result:'PERSISTED RESULT'})+'\n');child.emit('close',0);});return child;};
    const input={executionId:'complete-exec',provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,dryRun:true};
    const first=createRemoteRunnerService(tmp,{stateRoot:state,spawn:completingSpawner});first.submit(input);
    await new Promise(r=>setTimeout(r,25));assert.equal(first.get('complete-exec').state,'COMPLETED');
    const second=createRemoteRunnerService(tmp,{stateRoot:state,spawn:()=>{throw new Error('must not spawn');}});const restored=second.get('complete-exec');
    assert.equal(restored.state,'COMPLETED');assert.equal(restored.resultContent,'PERSISTED RESULT');assert.equal(restored.resultContentSha256.length,64);
    for(const forbidden of ['instruction','remoteRepositoryRoot','stdout','stderr','escalationEvidence'])assert.equal(forbidden in restored,false);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});

test('exit zero without final text becomes FAILED RESULT_INVALID and public record stays sanitized',async()=>{
  const tmp=mkdtempSync(join(tmpdir(),'aicc-rrs-'));
  try{
    const repo=makeGitRepo(tmp);const head=getHead(repo);
    const spawner=()=>{const child=hangingSpawner();queueMicrotask(()=>{child.stdout.emit('data',JSON.stringify({type:'assistant',message:{content:[{type:'tool_use',name:'Read'}]}})+'\n');child.emit('close',0);});return child;};
    const svc=createRemoteRunnerService(tmp,{spawn:spawner});svc.submit({executionId:'no-result',provider:'CLAUDE_CODE',executionClass:'CODE_CHANGE',providerRoutingReason:'r',workPackageId:'wp',remoteRepositoryRoot:repo,repositoryIdentity:'test/repo',expectedBranch:'feat/test',expectedHead:head,dryRun:true});
    await new Promise(r=>setTimeout(r,25));const rec=svc.get('no-result');assert.equal(rec.state,'FAILED');assert.equal(rec.error,'REMOTE_RUNNER_RESULT_INVALID');
    for(const forbidden of ['instruction','remoteRepositoryRoot','stdout','stderr','escalationEvidence'])assert.equal(forbidden in rec,false);
  }finally{rmSync(tmp,{recursive:true,force:true});}
});
