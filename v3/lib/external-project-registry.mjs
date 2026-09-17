import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync} from 'node:fs';
import {join} from 'node:path';
import {stateRoot} from './project-context.mjs';

export const EXTERNAL_PROJECT_REGISTRY_SCHEMA='aicc.v5.external-project-registry.v1';

function fail(code,detail=''){
  const error=new Error(detail?`${code}: ${detail}`:code);error.code=code;throw error;
}
function git(cwd,args){
  try{return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
  catch(error){fail('EXTERNAL_PROJECT_GIT_FAILED',error?.stderr?.toString().trim()||String(error));}
}
function normalizeIdentity(value=''){
  return String(value).trim().replace(/\.git$/,'').replace(/^git@github\.com:/,'').replace(/^ssh:\/\/git@github\.com\//,'').replace(/^https?:\/\/github\.com\//,'');
}
export function externalProjectRegistryPath(env=process.env){
  return env.AICC_EXTERNAL_PROJECT_REGISTRY_PATH?.trim()||join(stateRoot(env),'external-projects.json');
}
function validateRegistry(value){
  if(value?.schema!==EXTERNAL_PROJECT_REGISTRY_SCHEMA||!Array.isArray(value.projects))fail('EXTERNAL_PROJECT_REGISTRY_INVALID');
  const ids=new Set();
  for(const project of value.projects){
    for(const key of ['id','name','repositoryIdentity'])if(typeof project?.[key]!=='string'||!project[key].trim())fail('EXTERNAL_PROJECT_REGISTRY_INVALID',key);
    const roots=Array.isArray(project.repositoryRoots)?project.repositoryRoots:(typeof project.repositoryRoot==='string'?[project.repositoryRoot]:[]);
    if(!roots.length||roots.some(root=>typeof root!=='string'||!root.trim()))fail('EXTERNAL_PROJECT_REGISTRY_INVALID','repositoryRoots');
    if(ids.has(project.id))fail('EXTERNAL_PROJECT_REGISTRY_DUPLICATE',project.id);ids.add(project.id);
    if(!Array.isArray(project.workstreams)||!project.workstreams.length)fail('EXTERNAL_PROJECT_WORKSTREAMS_INVALID',project.id);
    for(const workstream of project.workstreams){
      for(const key of ['id','name','branchPattern'])if(typeof workstream?.[key]!=='string'||!workstream[key].trim())fail('EXTERNAL_PROJECT_WORKSTREAM_INVALID',`${project.id}.${key}`);
      try{new RegExp(workstream.branchPattern);}catch{fail('EXTERNAL_PROJECT_BRANCH_PATTERN_INVALID',`${project.id}.${workstream.id}`);}
    }
  }
  return value;
}
export function loadExternalProjectRegistry(env=process.env){
  const file=externalProjectRegistryPath(env);if(!existsSync(file))return Object.freeze({schema:EXTERNAL_PROJECT_REGISTRY_SCHEMA,projects:[]});
  let value;try{value=JSON.parse(readFileSync(file,'utf8'));}catch{fail('EXTERNAL_PROJECT_REGISTRY_INVALID_JSON',file);}
  return validateRegistry(value);
}
function parseWorktrees(text){
  return text.split(/\n\n+/).map(block=>block.trim()).filter(Boolean).map(block=>{
    const out={path:null,head:null,branch:null,detached:false};
    for(const line of block.split('\n')){
      if(line.startsWith('worktree '))out.path=line.slice(9);
      else if(line.startsWith('HEAD '))out.head=line.slice(5);
      else if(line.startsWith('branch refs/heads/'))out.branch=line.slice(18);
      else if(line==='detached')out.detached=true;
    }
    return out;
  }).filter(item=>item.path&&item.head);
}
function runtimeFacts(item){
  const dirty=git(item.path,['status','--porcelain']).length>0;
  let committedAt=null;try{committedAt=git(item.path,['log','-1','--format=%cI'])||null;}catch{}
  return {path:item.path,branch:item.branch,head:item.head,dirty,detached:item.detached,executable:Boolean(item.branch)&&!dirty&&!item.detached,committedAt};
}
export function externalProjectCatalog(env=process.env){
  const registry=loadExternalProjectRegistry(env);
  const projects=registry.projects.map(project=>{
    const repositoryRoots=Array.isArray(project.repositoryRoots)?project.repositoryRoots:[project.repositoryRoot];
    const byPath=new Map();
    for(const repositoryRoot of repositoryRoots){
      if(!existsSync(repositoryRoot))fail('EXTERNAL_PROJECT_REPOSITORY_MISSING',repositoryRoot);
      const origin=normalizeIdentity(git(repositoryRoot,['remote','get-url','origin']));
      if(origin!==project.repositoryIdentity)fail('EXTERNAL_PROJECT_REPOSITORY_IDENTITY_MISMATCH',project.id);
      for(const item of parseWorktrees(git(repositoryRoot,['worktree','list','--porcelain'])))if(!byPath.has(item.path))byPath.set(item.path,item);
    }
    const worktrees=[...byPath.values()].map(runtimeFacts);
    const workstreams=project.workstreams.map(workstream=>{
      const pattern=new RegExp(workstream.branchPattern);
      const runtimes=worktrees.filter(runtime=>runtime.branch&&pattern.test(runtime.branch)).sort((a,b)=>String(b.committedAt||'').localeCompare(String(a.committedAt||'')));
      return {id:workstream.id,name:workstream.name,runtimes};
    });
    return {id:project.id,name:project.name,repositoryIdentity:project.repositoryIdentity,repositoryRoots,workstreams};
  });
  return {schema:EXTERNAL_PROJECT_REGISTRY_SCHEMA,projects};
}
