import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAiccV3Server} from '../server.mjs';

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function roadmapText(){return `# AICC V3 Living Roadmap
Roadmap-Revision: 3
Updated-At: 2026-09-04
Status: \`ACTIVE\`
## Current milestone
\`V3.3 — Canonical Roadmap\`
Current Work Package: \`AICC-V3-CANONICAL-ROADMAP-001\`
Current implementation phase: \`V3.3.1 — read-only canonical roadmap projection\`
## Milestones
### V3.3 — Canonical Roadmap
Goal: read-only.
Estimate: 4–5h.
`;}

function fixture(withRoadmap=true){
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-server-'));
  const repo=join(root,'repo');const home=join(root,'state');
  mkdirSync(repo);mkdirSync(home);
  git(repo,'init','-b','test/server');
  git(repo,'config','user.email','aicc-v3@example.invalid');
  git(repo,'config','user.name','AICC V3 Test');
  writeFileSync(join(repo,'README.md'),'server\n');
  if(withRoadmap){
    const dir=join(repo,'docs/10_Planning_Roadmap');
    mkdirSync(dir,{recursive:true});
    writeFileSync(join(dir,'AICC-V3-LIVING-ROADMAP.md'),roadmapText());
  }
  git(repo,'add','.');git(repo,'commit','-m','fixture');
  writeFileSync(join(home,'project.json'),JSON.stringify({
    schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',
    repositoryIdentity:'example/server',repositoryPath:repo
  }));
  return {home,repo};
}

async function withServer(home,run){
  const server=createAiccV3Server({env:{AICC_V3_HOME:home}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const {port}=server.address();
  try{await run(`http://127.0.0.1:${port}`);}
  finally{await new Promise(resolve=>server.close(resolve));}
}
test('single server exposes health, project, roadmap and static UI',async()=>{
  const {home}=fixture(true);
  await withServer(home,async base=>{
    const health=await fetch(`${base}/api/health`).then(r=>r.json());
    assert.equal(health.service,'AICC_V3');
    assert.equal(health.project.available,true);

    const projectResponse=await fetch(`${base}/api/project`);
    const project=await projectResponse.json();
    assert.equal(projectResponse.status,200);
    assert.equal(project.context.repository.branch,'test/server');

    const roadmapResponse=await fetch(`${base}/api/roadmap`);
    const roadmap=await roadmapResponse.json();
    assert.equal(roadmapResponse.status,200);
    assert.equal(roadmap.roadmap.current.milestone,'V3.3 — Canonical Roadmap');
    assert.equal(roadmap.roadmap.authority.repositoryHead,project.context.repository.head);

    const page=await fetch(`${base}/`).then(r=>r.text());
    assert.match(page,/V3 · Single Authority/);
    assert.match(page,/Canonical Roadmap/);
  });
});
test('roadmap API returns explicit NOT_AVAILABLE when source is missing',async()=>{
  const {home}=fixture(false);
  await withServer(home,async base=>{
    const response=await fetch(`${base}/api/roadmap`);
    const body=await response.json();
    assert.equal(response.status,503);
    assert.equal(body.available,false);
    assert.equal(body.status,'NOT_AVAILABLE');
    assert.equal(body.errorCode,'ROADMAP_SOURCE_MISSING');
  });
});
