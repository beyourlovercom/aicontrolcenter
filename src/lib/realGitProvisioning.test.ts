import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createLocalCanaryRuntimeInput,triggerCanaryRuntime} from './canaryRuntimeTrigger.ts';
import type {DeliveryContextStore,ProvisionedExecutionBinding} from './deliveryProvisioning.ts';

const repository=mkdtempSync(join(tmpdir(),'aicc-real-git-'));const worktreeRoot=mkdtempSync(join(tmpdir(),'aicc-delivery-root-'));
try{
  execFileSync('git',['init','-b','rebuild/aicc-v2'],{cwd:repository,stdio:'ignore'});
  execFileSync('git',['config','user.email','aicc-tests@example.invalid'],{cwd:repository});
  execFileSync('git',['config','user.name','AICC Tests'],{cwd:repository});
  writeFileSync(join(repository,'README.md'),'delivery test\n');execFileSync('git',['add','README.md'],{cwd:repository});execFileSync('git',['commit','-m','base'],{cwd:repository,stdio:'ignore'});
  const local=createLocalCanaryRuntimeInput(repository,'rebuild/aicc-v2','exec-real-1');
  const contexts=new Map<string,any>();const bindings=new Map<string,ProvisionedExecutionBinding>();
  const store:DeliveryContextStore={get:id=>contexts.get(id)??null,put:value=>contexts.set(value.workPackageId,value)};
  const first=triggerCanaryRuntime({...local,worktreeRoot,store,bindings:{get:id=>bindings.get(id)??null,put:value=>bindings.set(value.work_package_id,value)}});
  assert.notEqual(first.deliveryContext.worktreePath,repository);assert.equal(first.deliveryContext.deliveryBranch,'delivery/aicc-m6-autonomous-delivery-canary-001');assert.equal(local.git.worktreeExists(first.deliveryContext.worktreePath),true);assert.equal(local.git.branchExists(first.deliveryContext.deliveryBranch),true);assert.equal(local.git.worktreeHead?.(first.deliveryContext.worktreePath),first.deliveryContext.baseSha);
  const second=triggerCanaryRuntime({...local,worktreeRoot,executionId:'exec-real-2',store,bindings:{get:id=>bindings.get(id)??null,put:value=>bindings.set(value.work_package_id,value)}});assert.equal(second.deliveryContext.deliveryContextId,first.deliveryContext.deliveryContextId);assert.equal(second.deliveryContext.worktreePath,first.deliveryContext.worktreePath);assert.equal(second.executionBinding.execution_id,'exec-real-2');
  execFileSync('git',['worktree','remove','--force',first.deliveryContext.worktreePath],{cwd:repository,stdio:'ignore'});execFileSync('git',['branch','-D',first.deliveryContext.deliveryBranch],{cwd:repository,stdio:'ignore'});
  console.log('real git delivery provisioning matrix passed');
}finally{rmSync(repository,{recursive:true,force:true});rmSync(worktreeRoot,{recursive:true,force:true});}
