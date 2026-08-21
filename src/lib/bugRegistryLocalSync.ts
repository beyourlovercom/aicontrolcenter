import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {existsSync,mkdirSync,readFileSync,renameSync,writeFileSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {resolveAiccStateDir} from './stateDirectory.ts';

export const AICC_BUG_REGISTRY_LOCAL_SYNC_V1='AICC_BUG_REGISTRY_LOCAL_SYNC_V1' as const;
export const CANONICAL_REPOSITORY='beyourlovercom/aicontrolcenter' as const;
export const CANONICAL_BRANCH='rebuild/aicc-v2' as const;
export const CANONICAL_REGISTRY_PATH='docs/80_Bug_Record/01_bug_record.md' as const;
export type LocalSyncRequest={repository:string;branch:string;registryPath:string;sourceCommitSha:string;action:string};
export type LocalSyncResult={sourceCommitSha:string;remoteHeadSha:string;result:'SYNCED'|'ALREADY_SYNCED'|'DIVERGED'|'FAILED';registryPath:typeof CANONICAL_REGISTRY_PATH;remoteBlobSha:string;localSha256:string;localRegistryDiverged:'YES'|'NO';bugFixStarted:'NO';reason?:string};
type Provenance={lastSuccessfulRemoteHead:string;lastSuccessfulRemoteBlobSha:string;lastSuccessfulLocalSha256:string;lastSuccessfulAt:string;lastSourceCommitSha:string;lastResult:string};
export type LocalSyncOptions={repositoryRoot?:string;registryAbsolutePath?:string;provenancePath?:string;runGit?:(args:string[])=>string;now?:()=>string};

function sha(value:string){return createHash('sha256').update(value).digest('hex')}
function atomicWrite(path:string,value:string){mkdirSync(dirname(path),{recursive:true});const temp=`${path}.${process.pid}.${Date.now()}.tmp`;writeFileSync(temp,value,{encoding:'utf8',mode:0o600});renameSync(temp,path)}
function root(options:LocalSyncOptions){return options.repositoryRoot??process.cwd()}
function registry(options:LocalSyncOptions){return options.registryAbsolutePath??join(root(options),CANONICAL_REGISTRY_PATH)}
function provenancePath(options:LocalSyncOptions){return options.provenancePath??join(resolveAiccStateDir(),'bug-registry-local-sync.json')}
function git(options:LocalSyncOptions,args:string[]){return options.runGit?options.runGit(args):execFileSync('git',args,{cwd:root(options),encoding:'utf8'}).trim()}
function readProvenance(options:LocalSyncOptions):Provenance|null{try{return JSON.parse(readFileSync(provenancePath(options),'utf8')) as Provenance}catch{return null}}
function validRegistry(value:string){return value.includes('# AICC Bug Record')&&/^## AICC-BUG-\d+$/m.test(value)}
function block(text:string){const blocks=[...String(text??'').replace(/\r\n?/g,'\n').trim().matchAll(/(?:^|\n)(AICC_BUG_REGISTRY_LOCAL_SYNC_V1\n[\s\S]*?\nEND_AICC_BUG_REGISTRY_LOCAL_SYNC_V1)(?=\n|$)/g)].map(match=>match[1]);if(blocks.length!==1)throw new Error(blocks.length?'LOCAL_SYNC_MULTIPLE_BLOCKS':'LOCAL_SYNC_PROTOCOL_REQUIRED');return blocks[0]}
function value(blockText:string,key:string){return blockText.match(new RegExp(`(?:^|\\n)${key}:\\s*([^\\n]+)`))?.[1]?.trim()??''}
export function parseBugRegistryLocalSyncV1(text:string):LocalSyncRequest{const source=block(text),request={repository:value(source,'REPOSITORY'),branch:value(source,'BRANCH'),registryPath:value(source,'REGISTRY_PATH'),sourceCommitSha:value(source,'SOURCE_COMMIT_SHA'),action:value(source,'ACTION')};validateLocalSyncRequest(request);return request}
export function validateLocalSyncRequest(request:LocalSyncRequest){if(request.repository!==CANONICAL_REPOSITORY)throw new Error('FIXED_REPOSITORY_REQUIRED');if(request.branch!==CANONICAL_BRANCH)throw new Error('FIXED_BRANCH_REQUIRED');if(request.registryPath!==CANONICAL_REGISTRY_PATH)throw new Error('FIXED_REGISTRY_PATH_REQUIRED');if(request.action!=='SYNC')throw new Error('FIXED_SYNC_ACTION_REQUIRED');if(!/^[a-f0-9]{40}$/i.test(request.sourceCommitSha))throw new Error('SOURCE_COMMIT_SHA_INVALID')}
export function formatBugRegistryLocalSyncResult(result:LocalSyncResult){return `AICC_BUG_REGISTRY_LOCAL_SYNC_RESULT_V1\nSOURCE_COMMIT_SHA: ${result.sourceCommitSha}\nREMOTE_HEAD_SHA: ${result.remoteHeadSha}\nRESULT: ${result.result}\nREGISTRY_PATH: ${result.registryPath}\nREMOTE_BLOB_SHA: ${result.remoteBlobSha}\nLOCAL_SHA256: ${result.localSha256}\nLOCAL_REGISTRY_DIVERGED: ${result.localRegistryDiverged}\nBUG_FIX_STARTED: NO\nEND_AICC_BUG_REGISTRY_LOCAL_SYNC_RESULT_V1`}
export function readBugRegistryLocalSyncStatus(options:LocalSyncOptions={}){const prior=readProvenance(options);return prior?{state:prior.lastResult,lastSyncAt:prior.lastSuccessfulAt,remoteHead:prior.lastSuccessfulRemoteHead,sourceCommitSha:prior.lastSourceCommitSha}:{state:'NOT_YET_SYNCED'}}
export function syncBugRegistryLocal(request:LocalSyncRequest,options:LocalSyncOptions={}):LocalSyncResult{
  validateLocalSyncRequest(request);const path=registry(options),prior=readProvenance(options);
  try{git(options,['fetch','origin',CANONICAL_BRANCH]);git(options,['merge-base','--is-ancestor',request.sourceCommitSha,`origin/${CANONICAL_BRANCH}`]);const head=git(options,['rev-parse',`origin/${CANONICAL_BRANCH}`]);const remote=git(options,['show',`origin/${CANONICAL_BRANCH}:${CANONICAL_REGISTRY_PATH}`]);const blob=git(options,['rev-parse',`origin/${CANONICAL_BRANCH}:${CANONICAL_REGISTRY_PATH}`]);if(!validRegistry(remote))throw new Error('REMOTE_REGISTRY_STRUCTURE_INVALID');
    const local=existsSync(path)?readFileSync(path,'utf8'):'';const localHash=sha(local),remoteHash=sha(remote);const localDiverged=Boolean(prior&&localHash!==prior.lastSuccessfulLocalSha256);
    if(localDiverged)return {sourceCommitSha:request.sourceCommitSha,remoteHeadSha:head,result:'DIVERGED',registryPath:CANONICAL_REGISTRY_PATH,remoteBlobSha:blob,localSha256:localHash,localRegistryDiverged:'YES',bugFixStarted:'NO'};
    if(prior&&prior.lastSuccessfulRemoteHead===head&&localHash===remoteHash)return {sourceCommitSha:request.sourceCommitSha,remoteHeadSha:head,result:'ALREADY_SYNCED',registryPath:CANONICAL_REGISTRY_PATH,remoteBlobSha:blob,localSha256:localHash,localRegistryDiverged:'NO',bugFixStarted:'NO'};
    if(!prior&&local&&local!==remote&&!validRegistry(local))throw new Error('LOCAL_REGISTRY_STRUCTURE_INVALID');
    atomicWrite(path,remote);const written=readFileSync(path,'utf8');if(written!==remote)throw new Error('REMOTE_LOCAL_CONTENT_MISMATCH');const finalHash=sha(written);const next:Provenance={lastSuccessfulRemoteHead:head,lastSuccessfulRemoteBlobSha:blob,lastSuccessfulLocalSha256:finalHash,lastSuccessfulAt:options.now?.()??new Date().toISOString(),lastSourceCommitSha:request.sourceCommitSha,lastResult:'SYNCED'};atomicWrite(provenancePath(options),`${JSON.stringify(next,null,2)}\n`);return {sourceCommitSha:request.sourceCommitSha,remoteHeadSha:head,result:'SYNCED',registryPath:CANONICAL_REGISTRY_PATH,remoteBlobSha:blob,localSha256:finalHash,localRegistryDiverged:'NO',bugFixStarted:'NO'};
  }catch(error){return {sourceCommitSha:request.sourceCommitSha,remoteHeadSha:'UNKNOWN',result:'FAILED',registryPath:CANONICAL_REGISTRY_PATH,remoteBlobSha:'UNKNOWN',localSha256:existsSync(path)?sha(readFileSync(path,'utf8')):'UNKNOWN',localRegistryDiverged:'NO',bugFixStarted:'NO',reason:error instanceof Error?error.message:'LOCAL_SYNC_FAILED'}}
}
