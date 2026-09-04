import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAiccV3Server} from '../server.mjs';

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-server-'));
  const repo=join(root,'repo');const home=join(root,'state');
  mkdirSync(repo);mkdirSync(home);
  git(repo,'init','-b','test/server');
  git(repo,'config','user.email','aicc-v3@example.invalid');
  git(repo,'config','user.name','AICC V3 Test');
  writeFileSync(join(repo,'README.md'),'server\n');
  git(repo,'add','README.md');git(repo,'commit','-m','fixture');
  writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',repositoryIdentity:'example/server',repositoryPath:repo}));
  return {home};
}

test('single server exposes health, project and static UI',async()=>{
  const {home}=fixture();
  const server=createAiccV3Server({env:{AICC_V3_HOME:home}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address();
  try{
    const health=await fetch(`http://127.0.0.1:${port}/api/health`).then(r=>r.json());
    assert.equal(health.service,'AICC_V3');
    assert.equal(health.project.available,true);

    const projectResponse=await fetch(`http://127.0.0.1:${port}/api/project`);
    const project=await projectResponse.json();
    assert.equal(projectResponse.status,200);
    assert.equal(project.context.repository.branch,'test/server');

    const pageResponse=await fetch(`http://127.0.0.1:${port}/`);
    const page=await pageResponse.text();
    assert.equal(pageResponse.status,200);
    assert.match(page,/V3 · Single Authority/);
  }finally{
    await new Promise(resolve=>server.close(resolve));
  }
});
