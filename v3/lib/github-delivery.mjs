import {execFileSync} from 'node:child_process';

export const PR_DELIVERY_SCHEMA='aicc.v3.pr-delivery.v1';

function fail(code,detail=''){
  const error=new Error(detail?`${code}: ${detail}`:code);error.code=code;throw error;
}
function defaultExec(file,args,{cwd,env}={}){
  return execFileSync(file,args,{cwd,env:{...process.env,...env},encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
}
function run(options,file,args,context,env){
  try{return String((options.exec||defaultExec)(file,args,{cwd:context.repository.path,env})??'').trim();}
  catch(error){throw error;}
}
function json(text,code){try{return JSON.parse(text);}catch{fail(code);}}
export function normalizeGitHubIdentity(value){
  if(typeof value!=='string')return null;let v=value.trim().replace(/\.git$/,'');
  v=v.replace(/^git@github\.com:/,'').replace(/^ssh:\/\/git@github\.com\//,'').replace(/^https?:\/\/github\.com\//,'');
  return /^[^/\s]+\/[^/\s]+$/.test(v)?v:null;
}
function ghPath(env,options){return options.ghPath||env.AICC_GH_PATH||'/opt/homebrew/bin/gh';}
function gitPath(options){return options.gitPath||'git';}
function originFacts(context,env,options){
  let url;try{url=run(options,gitPath(options),['remote','get-url','origin'],context,env);}catch{fail('GITHUB_ORIGIN_MISMATCH');}
  const identity=normalizeGitHubIdentity(url);if(identity!==context.repository.identity)fail('GITHUB_ORIGIN_MISMATCH');
  return {url,identity};
}
function repoFacts(context,env,options){
  try{run(options,ghPath(env,options),['auth','status','--hostname','github.com'],context,env);}catch{fail('GITHUB_AUTH_UNAVAILABLE');}
  let value;try{value=json(run(options,ghPath(env,options),['repo','view',context.repository.identity,'--json','nameWithOwner,defaultBranchRef,url,isPrivate'],context,env),'GITHUB_NOT_READY');}
  catch(error){if(error?.code==='GITHUB_NOT_READY')throw error;fail('GITHUB_NOT_READY');}
  if(value?.nameWithOwner!==context.repository.identity)fail('GITHUB_REPOSITORY_MISMATCH');
  const defaultBranch=value?.defaultBranchRef?.name;if(typeof defaultBranch!=='string'||!defaultBranch)fail('GITHUB_NOT_READY');
  return {identity:value.nameWithOwner,defaultBranch,url:value.url||null,isPrivate:Boolean(value.isPrivate)};
}
function remoteRefSha(context,ref,env,options){
  let out;try{out=run(options,gitPath(options),['ls-remote','--heads','origin',`refs/heads/${ref}`],context,env);}catch{fail('GITHUB_NOT_READY');}
  if(!out)return null;const sha=out.split(/\s+/)[0];return /^[0-9a-f]{40}$/i.test(sha)?sha:null;
}
function openPrs(context,env,options){
  let value;try{value=json(run(options,ghPath(env,options),['pr','list','--repo',context.repository.identity,'--head',context.repository.branch,'--state','open','--limit','100','--json','number,url,state,isDraft,headRefName,headRefOid,baseRefName,title,createdAt,updatedAt'],context,env),'GITHUB_NOT_READY');}
  catch(error){if(error?.code==='GITHUB_NOT_READY')throw error;fail('GITHUB_NOT_READY');}
  if(!Array.isArray(value))fail('GITHUB_NOT_READY');
  return value.map(pr=>({number:pr.number,url:pr.url,state:pr.state,isDraft:Boolean(pr.isDraft),headRefName:pr.headRefName,headRefOid:pr.headRefOid,baseRefName:pr.baseRefName,title:pr.title,createdAt:pr.createdAt||null,updatedAt:pr.updatedAt||null}));
}
function exactChecks(context,env,options){
  let value;try{value=json(run(options,ghPath(env,options),['api','-H','Accept: application/vnd.github+json',`repos/${context.repository.identity}/commits/${context.repository.head}/check-runs`],context,env),'CI_FACTS_UNAVAILABLE');}
  catch(error){if(error?.code==='CI_FACTS_UNAVAILABLE')throw error;fail('CI_FACTS_UNAVAILABLE');}
  if(!Array.isArray(value?.check_runs))fail('CI_FACTS_UNAVAILABLE');
  return value.check_runs.filter(c=>c?.head_sha===context.repository.head).map(c=>({id:c.id,name:c.name,headSha:c.head_sha,status:c.status,conclusion:c.conclusion??null,detailsUrl:c.html_url||c.details_url||null}));
}
export function readPrDeliveryFacts(context,env=process.env,options={}){
  const origin=originFacts(context,env,options);const repository=repoFacts(context,env,options);
  const remoteHeadSha=remoteRefSha(context,context.repository.branch,env,options);
  const pullRequests=openPrs(context,env,options);const checks=exactChecks(context,env,options);
  const blockers=[];
  if(context.repository.dirty)blockers.push('PR_LOCAL_WORKTREE_DIRTY');
  if(context.repository.branch===repository.defaultBranch)blockers.push('PR_HEAD_IS_DEFAULT_BRANCH');
  if(!remoteHeadSha)blockers.push('PR_REMOTE_HEAD_NOT_FOUND');
  else if(remoteHeadSha!==context.repository.head)blockers.push('PR_REMOTE_HEAD_MISMATCH');
  return {schema:PR_DELIVERY_SCHEMA,repository,local:{branch:context.repository.branch,head:context.repository.head,dirty:context.repository.dirty},origin:{...origin,remoteHeadSha,exactHeadMatch:remoteHeadSha===context.repository.head},pullRequests,checks,draftPrerequisites:{ready:blockers.length===0,blockers}};
}
function validateDraftInput(input){
  if(!input||typeof input.title!=='string'||!input.title.trim()||typeof input.baseRef!=='string'||!input.baseRef.trim()||typeof input.body!=='string')fail('PR_INPUT_INVALID');
  if(['head','headRef','headSha','draft'].some(k=>Object.prototype.hasOwnProperty.call(input,k)))fail('PR_INPUT_INVALID');
  return {title:input.title.trim(),baseRef:input.baseRef.trim(),body:input.body};
}
export function createDraftPr(context,input,env=process.env,options={}){
  const value=validateDraftInput(input);const facts=readPrDeliveryFacts(context,env,options);
  if(context.repository.dirty)fail('PR_LOCAL_WORKTREE_DIRTY');
  if(context.repository.branch===facts.repository.defaultBranch)fail('PR_HEAD_IS_DEFAULT_BRANCH');
  if(!facts.origin.remoteHeadSha)fail('PR_REMOTE_HEAD_NOT_FOUND');
  if(facts.origin.remoteHeadSha!==context.repository.head)fail('PR_REMOTE_HEAD_MISMATCH');
  if(value.baseRef===context.repository.branch)fail('PR_BASE_EQUALS_HEAD');
  if(!remoteRefSha(context,value.baseRef,env,options))fail('PR_BASE_NOT_FOUND');
  const duplicate=facts.pullRequests.find(pr=>pr.headRefName===context.repository.branch&&pr.baseRefName===value.baseRef);
  if(duplicate){const error=new Error('PR_ALREADY_EXISTS');error.code='PR_ALREADY_EXISTS';error.existingPr=duplicate;throw error;}
  try{run(options,ghPath(env,options),['pr','create','--draft','--repo',context.repository.identity,'--head',context.repository.branch,'--base',value.baseRef,'--title',value.title,'--body',value.body],context,env);}catch{fail('PR_CREATE_FAILED');}
  const after=openPrs(context,env,options);const created=after.find(pr=>pr.headRefName===context.repository.branch&&pr.baseRefName===value.baseRef);
  if(!created||created.isDraft!==true)fail('PR_CREATE_FAILED');
  return created;
}
