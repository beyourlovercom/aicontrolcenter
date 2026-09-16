import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdirSync,mkdtempSync,rmSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAiccV3Server} from '../server.mjs';
import {EXTERNAL_PROJECT_REGISTRY_SCHEMA} from '../lib/external-project-registry.mjs';

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
test('external projects API exposes registered clean worktrees without mutating project context',async()=>{
  const root=mkdtempSync(join(tmpdir(),'aicc-external-api-')),repo=join(root,'family-plan'),home=join(root,'state'),web=join(root,'family-web');mkdirSync(repo);mkdirSync(home);
  git(repo,'init','-b','main');git(repo,'config','user.email','aicc@example.invalid');git(repo,'config','user.name','AICC Test');writeFileSync(join(repo,'README.md'),'family\n');git(repo,'add','.');git(repo,'commit','-m','fixture');git(repo,'remote','add','origin','git@github.com:beyourlovercom/family-plan.git');git(repo,'worktree','add','-b','feature/family-web-v1-3',web,'main');
  writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'aicc-v5-workbench',name:'AICC',repositoryIdentity:'beyourlovercom/family-plan',repositoryPath:repo}));
  writeFileSync(join(home,'external-projects.json'),JSON.stringify({schema:EXTERNAL_PROJECT_REGISTRY_SCHEMA,projects:[{id:'family-plan',name:'Family Plan',repositoryIdentity:'beyourlovercom/family-plan',repositoryRoots:[repo],workstreams:[{id:'family-web',name:'Family Web',branchPattern:'(?:^|/)family-web-'}]}]}));
  const server=createAiccV3Server({env:{AICC_V3_HOME:home}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const {port}=server.address();
  try{const response=await fetch(`http://127.0.0.1:${port}/api/external-projects`),body=await response.json();assert.equal(response.status,200);assert.equal(body.available,true);assert.equal(body.catalog.projects[0].id,'family-plan');assert.equal(body.catalog.projects[0].workstreams[0].runtimes[0].branch,'feature/family-web-v1-3');assert.equal(body.catalog.projects[0].workstreams[0].runtimes[0].executable,true);const project=await fetch(`http://127.0.0.1:${port}/api/project`).then(r=>r.json());assert.equal(project.context.repository.path,repo);}finally{await new Promise(resolve=>server.close(resolve));rmSync(root,{recursive:true,force:true});}
});
