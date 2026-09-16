import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {EXTERNAL_PROJECT_REGISTRY_SCHEMA,externalProjectCatalog,loadExternalProjectRegistry} from '../lib/external-project-registry.mjs';

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
function repo(root,name){const path=join(root,name);mkdirSync(path);git(path,'init','-b','main');git(path,'config','user.email','aicc@example.invalid');git(path,'config','user.name','AICC Test');writeFileSync(join(path,'README.md'),name+'\n');git(path,'add','.');git(path,'commit','-m','fixture');git(path,'remote','add','origin','git@github.com:beyourlovercom/family-plan.git');return path;}
const root=mkdtempSync(join(tmpdir(),'aicc-external-projects-'));const state=join(root,'state');mkdirSync(state);const repoA=repo(root,'family-a'),repoB=repo(root,'family-b');
const web=join(root,'family-web'),sync=join(root,'family-sync'),dirty=join(root,'family-sync-dirty');git(repoA,'worktree','add','-b','feature/family-web-v1-3',web,'main');git(repoB,'worktree','add','-b','feature/family-sync-v1-g4',sync,'main');git(repoB,'worktree','add','-b','fix/family-sync-dirty',dirty,'main');writeFileSync(join(dirty,'dirty.txt'),'dirty');
const registry={schema:EXTERNAL_PROJECT_REGISTRY_SCHEMA,projects:[{id:'family-plan',name:'Family Plan',repositoryIdentity:'beyourlovercom/family-plan',repositoryRoots:[repoA,repoB],workstreams:[{id:'family-web',name:'Family Web',branchPattern:'(?:^|/)family-web-'},{id:'family-sync',name:'Family Sync',branchPattern:'(?:^|/)family-sync'}]}]};writeFileSync(join(state,'external-projects.json'),JSON.stringify(registry));const env={AICC_V3_HOME:state};
assert.equal(loadExternalProjectRegistry(env).projects[0].id,'family-plan');const project=externalProjectCatalog(env).projects[0];assert.equal(project.repositoryRoots.length,2);
const webStream=project.workstreams.find(x=>x.id==='family-web'),syncStream=project.workstreams.find(x=>x.id==='family-sync');assert.equal(webStream.runtimes.length,1);assert.equal(webStream.runtimes[0].executable,true);assert.equal(syncStream.runtimes.length,2);assert.equal(syncStream.runtimes.filter(x=>x.executable).length,1);assert.equal(syncStream.runtimes.find(x=>x.branch==='fix/family-sync-dirty').dirty,true);
rmSync(root,{recursive:true,force:true});console.log('external-project-registry.test.mjs PASS');
