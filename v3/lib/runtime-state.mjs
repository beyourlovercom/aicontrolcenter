import {createHash} from 'node:crypto';
import {existsSync,realpathSync} from 'node:fs';
import {resolve} from 'node:path';

function fail(code){const error=new Error(code);error.code=code;throw error;}

export function runtimeBinding(context){
  const projectId=context?.project?.id;
  const repositoryIdentity=context?.repository?.identity;
  const rawPath=context?.repository?.path;
  if(typeof projectId!=='string'||!projectId.trim()||typeof repositoryIdentity!=='string'||!repositoryIdentity.trim()||typeof rawPath!=='string'||!rawPath.trim())fail('RUNTIME_CONTEXT_INVALID');
  const repositoryPath=existsSync(rawPath)?realpathSync(rawPath):resolve(rawPath);
  return {projectId:projectId.trim(),repositoryIdentity:repositoryIdentity.trim(),repositoryPath};
}

export function runtimeStateKey(context){
  const binding=runtimeBinding(context);
  return createHash('sha256').update(binding.projectId).update('\0').update(binding.repositoryIdentity).update('\0').update(binding.repositoryPath).digest('hex');
}
