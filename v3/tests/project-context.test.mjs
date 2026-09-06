import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadProjectContext} from '../lib/project-context.mjs';

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}

function fixture(){
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-context-'));
  const repo=join(root,'repo');
  const home=join(root,'state');
  mkdirSync(repo);mkdirSync(home);
  git(repo,'init','-b','test/v3');
  git(repo,'config','user.email','aicc-v3@example.invalid');
  git(repo,'config','user.name','AICC V3 Test');
  writeFileSync(join(repo,'README.md'),'v3\n');
  git(repo,'add','README.md');git(repo,'commit','-m','fixture');
  writeFileSync(join(home,'project.json'),JSON.stringify({
    schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',
    repositoryIdentity:'example/aicc-v3',repositoryPath:repo
  }));
  return {home,repo};
}

test('missing project config fails closed',()=>{
  const home=mkdtempSync(join(tmpdir(),'aicc-v3-missing-'));
  assert.throws(()=>loadProjectContext({AICC_V3_HOME:home}),/PROJECT_CONFIG_MISSING/);
});

test('one ProjectContext owns repository facts',()=>{
  const {home,repo}=fixture();
  const env={AICC_V3_HOME:home};
  const clean=loadProjectContext(env);
  assert.equal(clean.project.id,'fixture');
  assert.equal(clean.repository.identity,'example/aicc-v3');
  assert.equal(clean.repository.branch,'test/v3');
  assert.equal(clean.repository.head,git(repo,'rev-parse','HEAD'));
  assert.equal(clean.repository.dirty,false);

  writeFileSync(join(repo,'README.md'),'v3 dirty\n');
  const dirty=loadProjectContext(env);
  assert.equal(dirty.repository.head,clean.repository.head);
  assert.equal(dirty.repository.dirty,true);
});
