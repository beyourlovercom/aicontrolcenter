import assert from 'node:assert/strict';
import {readExternalProjects} from './externalProjects.ts';

const catalog={schema:'aicc.v5.external-project-registry.v1',projects:[{id:'family-plan',name:'Family Plan',repositoryIdentity:'beyourlovercom/family-plan',repositoryRoots:['/family'],workstreams:[{id:'family-web',name:'Family Web',runtimes:[{path:'/family/web',branch:'feature/family-web-v1-3',head:'a'.repeat(40),dirty:false,detached:false,executable:true,committedAt:null}]}]}]};
const ok=await readExternalProjects(async()=>new Response(JSON.stringify({available:true,catalog}),{status:200,headers:{'content-type':'application/json'}}) as any);
assert.equal(ok.projects[0].workstreams[0].runtimes[0].executable,true);
await assert.rejects(()=>readExternalProjects(async()=>new Response(JSON.stringify({available:false,errorCode:'EXTERNAL_PROJECT_REGISTRY_INVALID'}),{status:503,headers:{'content-type':'application/json'}}) as any),/EXTERNAL_PROJECT_REGISTRY_INVALID/);
console.log('externalProjects.test.ts PASS');
