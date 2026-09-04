import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createAiccV3Server} from '../server.mjs';
function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fixture(){
 const root=mkdtempSync(join(tmpdir(),'aicc-v3-pr-api-')),repo=join(root,'repo'),home=join(root,'state');mkdirSync(repo);mkdirSync(home);git(repo,'init','-b','test/pr-api');git(repo,'config','user.email','aicc@example.invalid');git(repo,'config','user.name','AICC Test');writeFileSync(join(repo,'README.md'),'api\n');git(repo,'add','.');git(repo,'commit','-m','fixture');const head=git(repo,'rev-parse','HEAD');
 writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',repositoryIdentity:'example/api',repositoryPath:repo}));let created=false;const pr={number:9,url:'https://github.com/example/api/pull/9',state:'OPEN',isDraft:true,headRefName:'test/pr-api',headRefOid:head,baseRefName:'main',title:'API draft'};
 const exec=(file,args)=>{const key=args.join(' ');if(file==='git'&&key==='remote get-url origin')return 'https://github.com/example/api.git';if(file==='git'&&key.includes('refs/heads/test/pr-api'))return `${head}\trefs/heads/test/pr-api`;if(file==='git'&&key.includes('refs/heads/main'))return `${'b'.repeat(40)}\trefs/heads/main`;if(args[0]==='auth')return '';if(args[0]==='repo')return JSON.stringify({nameWithOwner:'example/api',defaultBranchRef:{name:'main'},url:'https://github.com/example/api',isPrivate:true});if(args[0]==='api')return JSON.stringify({check_runs:[{id:1,name:'verify',head_sha:head,status:'completed',conclusion:'success'}]});if(args[0]==='pr'&&args[1]==='list')return JSON.stringify(created?[pr]:[]);if(args[0]==='pr'&&args[1]==='create'){assert.ok(args.includes('--draft'));created=true;return pr.url;}throw new Error(`unexpected ${file} ${key}`);};return {home,options:{exec}};
}
async function server(home,options,run){const s=createAiccV3Server({env:{AICC_V3_HOME:home},prDeliveryOptions:options});await new Promise(r=>s.listen(0,'127.0.0.1',r));try{await run(`http://127.0.0.1:${s.address().port}`);}finally{await new Promise(r=>s.close(r));}}
test('PR Delivery APIs expose facts and Draft-only creation; forbidden mutations remain absent',async()=>{const f=fixture();await server(f.home,f.options,async base=>{let r=await fetch(`${base}/api/pr-delivery`);let b=await r.json();assert.equal(r.status,200);assert.equal(b.delivery.origin.exactHeadMatch,true);assert.equal(b.delivery.checks[0].conclusion,'success');assert.equal(JSON.stringify(b).includes('mergeReady'),false);
 r=await fetch(`${base}/api/prs/draft`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({title:'API draft',body:'',baseRef:'main'})});b=await r.json();assert.equal(r.status,201);assert.equal(b.pullRequest.isDraft,true);
 for(const [method,path] of [['POST','/api/prs/9/merge'],['POST','/api/prs/9/close'],['PATCH','/api/prs/9'],['POST','/api/prs/9/ready']]){const x=await fetch(base+path,{method});assert.equal(x.status,404);}
});});
