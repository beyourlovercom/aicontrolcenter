import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,mkdirSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {loadProjectContext} from '../lib/project-context.mjs';
import {createDraftPr,normalizeGitHubIdentity,readPrDeliveryFacts} from '../lib/github-delivery.mjs';

function git(cwd,...args){return execFileSync('git',args,{cwd,encoding:'utf8'}).trim();}
function fixture(){
  const root=mkdtempSync(join(tmpdir(),'aicc-v3-pr-'));const repo=join(root,'repo');const home=join(root,'state');mkdirSync(repo);mkdirSync(home);
  git(repo,'init','-b','test/pr');git(repo,'config','user.email','aicc@example.invalid');git(repo,'config','user.name','AICC Test');writeFileSync(join(repo,'README.md'),'pr\n');git(repo,'add','.');git(repo,'commit','-m','fixture');
  writeFileSync(join(home,'project.json'),JSON.stringify({schema:'aicc.v3.project.v1',id:'fixture',name:'Fixture',repositoryIdentity:'example/pr',repositoryPath:repo}));
  const env={AICC_V3_HOME:home};const context=loadProjectContext(env);let created=false;let duplicate=false;const calls=[];
  const pr={number:42,url:'https://github.com/example/pr/pull/42',state:'OPEN',isDraft:true,headRefName:'test/pr',headRefOid:context.repository.head,baseRefName:'main',title:'Draft title',createdAt:'2026-09-04T00:00:00Z',updatedAt:'2026-09-04T00:00:00Z'};
  const exec=(file,args)=>{calls.push({file,args:[...args]});const key=args.join(' ');
    if(file==='git'&&key==='remote get-url origin')return 'https://github.com/example/pr.git';
    if(file==='git'&&key.includes('ls-remote --heads origin refs/heads/test/pr'))return `${context.repository.head}\trefs/heads/test/pr`;
    if(file==='git'&&key.includes('ls-remote --heads origin refs/heads/main'))return `${'b'.repeat(40)}\trefs/heads/main`;
    if(file==='/opt/homebrew/bin/gh'&&args[0]==='auth')return '';
    if(file==='/opt/homebrew/bin/gh'&&args[0]==='repo')return JSON.stringify({nameWithOwner:'example/pr',defaultBranchRef:{name:'main'},url:'https://github.com/example/pr',isPrivate:true});
    if(file==='/opt/homebrew/bin/gh'&&args[0]==='api')return JSON.stringify({check_runs:[{id:7,name:'verify-v3',head_sha:context.repository.head,status:'completed',conclusion:'success',html_url:'https://github.com/example/pr/actions/7'},{id:8,name:'stale',head_sha:'a'.repeat(40),status:'completed',conclusion:'failure'}]});
    if(file==='/opt/homebrew/bin/gh'&&args[0]==='pr'&&args[1]==='list')return JSON.stringify((created||duplicate)?[pr]:[]);
    if(file==='/opt/homebrew/bin/gh'&&args[0]==='pr'&&args[1]==='create'){created=true;return pr.url;}
    throw Object.assign(new Error(`unexpected ${file} ${key}`),{code:'UNEXPECTED'});
  };
  return {env,context,calls,options:{exec},setDuplicate:v=>duplicate=v};
}
function code(fn,value){assert.throws(fn,error=>error?.code===value);}

test('GitHub delivery facts are exact-head transport facts only',()=>{
  const f=fixture();const facts=readPrDeliveryFacts(f.context,f.env,f.options);
  assert.equal(facts.repository.identity,'example/pr');assert.equal(facts.repository.defaultBranch,'main');assert.equal(facts.origin.exactHeadMatch,true);assert.equal(facts.origin.remoteHeadSha,f.context.repository.head);
  assert.deepEqual(facts.checks.map(c=>c.name),['verify-v3']);assert.equal(facts.checks[0].headSha,f.context.repository.head);assert.equal(facts.draftPrerequisites.ready,true);
  const text=JSON.stringify(facts);assert.doesNotMatch(text,/token|credential|mergeReady|safeToMerge|approved/i);
});

test('Draft creation forces exact ProjectContext head and draft mode',()=>{
  const f=fixture();const pr=createDraftPr(f.context,{title:' Draft title ',body:'Body',baseRef:'main'},f.env,f.options);
  assert.equal(pr.number,42);assert.equal(pr.isDraft,true);
  const create=f.calls.find(c=>c.args[0]==='pr'&&c.args[1]==='create');assert.ok(create);assert.ok(create.args.includes('--draft'));
  assert.equal(create.args[create.args.indexOf('--head')+1],f.context.repository.branch);assert.equal(create.args[create.args.indexOf('--base')+1],'main');
  assert.equal(create.args[create.args.indexOf('--title')+1],'Draft title');
});

test('Draft creation fails closed on browser head override, dirty, stale remote, and duplicate',()=>{
  let f=fixture();code(()=>createDraftPr(f.context,{title:'x',body:'',baseRef:'main',head:'evil'},f.env,f.options),'PR_INPUT_INVALID');
  f=fixture();const dirty={...f.context,repository:{...f.context.repository,dirty:true}};code(()=>createDraftPr(dirty,{title:'x',body:'',baseRef:'main'},f.env,f.options),'PR_LOCAL_WORKTREE_DIRTY');
  f=fixture();const staleExec=(file,args,meta)=>{if(file==='git'&&args.join(' ').includes('refs/heads/test/pr'))return `${'c'.repeat(40)}\trefs/heads/test/pr`;return f.options.exec(file,args,meta);};code(()=>createDraftPr(f.context,{title:'x',body:'',baseRef:'main'},f.env,{exec:staleExec}),'PR_REMOTE_HEAD_MISMATCH');
  f=fixture();f.setDuplicate(true);code(()=>createDraftPr(f.context,{title:'x',body:'',baseRef:'main'},f.env,f.options),'PR_ALREADY_EXISTS');
});


test('repository and origin identity mismatches fail closed',()=>{
  let f=fixture();const badOrigin=(file,args,meta)=>file==='git'&&args.join(' ')==='remote get-url origin'?'https://github.com/example/other.git':f.options.exec(file,args,meta);code(()=>readPrDeliveryFacts(f.context,f.env,{exec:badOrigin}),'GITHUB_ORIGIN_MISMATCH');
  f=fixture();const badRepo=(file,args,meta)=>file==='/opt/homebrew/bin/gh'&&args[0]==='repo'?JSON.stringify({nameWithOwner:'example/other',defaultBranchRef:{name:'main'},url:'https://github.com/example/other',isPrivate:true}):f.options.exec(file,args,meta);code(()=>readPrDeliveryFacts(f.context,f.env,{exec:badRepo}),'GITHUB_REPOSITORY_MISMATCH');
});

test('GitHub remote URL normalization accepts supported origin forms only',()=>{
  assert.equal(normalizeGitHubIdentity('https://github.com/example/pr.git'),'example/pr');assert.equal(normalizeGitHubIdentity('git@github.com:example/pr.git'),'example/pr');assert.equal(normalizeGitHubIdentity('ssh://git@github.com/example/pr.git'),'example/pr');assert.equal(normalizeGitHubIdentity('https://gitlab.com/example/pr'),null);
});
