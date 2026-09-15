import {execFileSync} from 'node:child_process';
import {existsSync,readFileSync,statSync} from 'node:fs';
import {homedir} from 'node:os';
import {isAbsolute,join} from 'node:path';

export const PROJECT_CONFIG_SCHEMA='aicc.v3.project.v1';
export const PROJECT_CONTEXT_SCHEMA='aicc.v3.project-context.v1';

function fail(code,detail=''){
  const error=new Error(detail?`${code}: ${detail}`:code);
  error.code=code;
  throw error;
}

export function stateRoot(env=process.env){
  return env.AICC_V3_HOME?.trim()||join(homedir(),'.aicc-v3');
}

function git(cwd,args){
  try{return execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();}
  catch(error){fail('PROJECT_REPOSITORY_INVALID',error?.stderr?.toString().trim()||String(error));}
}

export function loadProjectConfig(env=process.env){
  const file=join(stateRoot(env),'project.json');
  if(!existsSync(file))fail('PROJECT_CONFIG_MISSING',file);
  let value;
  try{value=JSON.parse(readFileSync(file,'utf8'));}catch{fail('PROJECT_CONFIG_INVALID_JSON',file);}
  if(value?.schema!==PROJECT_CONFIG_SCHEMA)fail('PROJECT_CONFIG_SCHEMA_INVALID');
  for(const key of ['id','name','repositoryIdentity','repositoryPath']){
    if(typeof value[key]!=='string'||!value[key].trim())fail('PROJECT_CONFIG_FIELD_INVALID',key);
  }
  if(!isAbsolute(value.repositoryPath))fail('PROJECT_REPOSITORY_PATH_NOT_ABSOLUTE');
  return Object.freeze({...value,repositoryPath:value.repositoryPath.trim()});
}

function contextFromConfig(config){
  if(!config||typeof config!=='object')fail('PROJECT_CONFIG_FIELD_INVALID','config');
  for(const key of ['id','name','repositoryIdentity','repositoryPath']){
    if(typeof config[key]!=='string'||!config[key].trim())fail('PROJECT_CONFIG_FIELD_INVALID',key);
  }
  if(!isAbsolute(config.repositoryPath))fail('PROJECT_REPOSITORY_PATH_NOT_ABSOLUTE');
  if(!existsSync(config.repositoryPath))fail('PROJECT_REPOSITORY_MISSING',config.repositoryPath);
  const configuredRoot=config.repositoryPath.trim();
  const gitRoot=git(configuredRoot,['rev-parse','--show-toplevel']);
  const configuredStat=statSync(configuredRoot),gitStat=statSync(gitRoot);
  if(configuredStat.dev!==gitStat.dev||configuredStat.ino!==gitStat.ino)fail('PROJECT_REPOSITORY_ROOT_MISMATCH',gitRoot);
  const branch=git(configuredRoot,['symbolic-ref','--quiet','--short','HEAD']);
  if(!branch)fail('PROJECT_BRANCH_REQUIRED');
  const head=git(configuredRoot,['rev-parse','HEAD']);
  const dirty=git(configuredRoot,['status','--porcelain']).length>0;
  return Object.freeze({
    schema:PROJECT_CONTEXT_SCHEMA,
    project:Object.freeze({id:config.id.trim(),name:config.name.trim()}),
    repository:Object.freeze({identity:config.repositoryIdentity.trim(),path:configuredRoot,branch,head,dirty})
  });
}

export function loadProjectContextFromBinding(binding){
  return contextFromConfig({
    id:binding?.projectId,
    name:binding?.projectName||binding?.projectId,
    repositoryIdentity:binding?.repositoryIdentity,
    repositoryPath:binding?.repositoryPath
  });
}

export function loadProjectContext(env=process.env){return contextFromConfig(loadProjectConfig(env));}
