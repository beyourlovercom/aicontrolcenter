import { execFile, execFileSync } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import type {ExecutionPreflight} from './fastExecution.ts';
import {canonicalExecutionDecision,grantExecutionLease,readWorktreeFiles,resolveExecutionScopes,revokeExecutionLease} from './fastExecution.ts';
import {resolveAiccStateDir} from './stateDirectory.ts';
import {parseFormalWorkPackageRegistry,type FormalWorkPackageRegistration} from './taskEntityBinding.ts';
import {deserializeRoadmapProjection,type RoadmapProjection} from './roadmapProjection.ts';
import {deserializeRoadmapReadModel,ensureRoadmapReadModel,roadmapReadModelPath,type AiccRoadmapReadModel} from './roadmapReadModel.ts';
import {buildPrNavigationSnapshot,deserializePrNavigationSnapshot,toPullRequestRecordLike,type PrNavigationSnapshot,type PrNavigationSnapshotInput} from './prNavigationSnapshot.ts';
import {createJsonDeliveryContextRecordStore} from './deliveryContextPersistence.ts';
import {createProjectRegistryAuthority,type ProjectRecord} from './projectRegistryAuthority.ts';
import {sameCanonicalPath} from './canonicalPathIdentity.ts';

export const REPOSITORY_ROOT = '/Users/a/AI/007/AIcontrolcenter';
export const LOCAL_SERVICE_LABEL = 'com.aicc.v2.local-service';
const ROADMAP = join(REPOSITORY_ROOT, 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md');
const WORK_PACKAGES = join(REPOSITORY_ROOT, 'docs/60_Operations/work-packages');
const GITHUB_MAIN_REF = 'refs/remotes/origin/main';
const ROADMAP_GITHUB_REF = 'refs/remotes/origin/rebuild/aicc-v2';
const ROADMAP_GITHUB_BRANCH = 'rebuild/aicc-v2';
const ROADMAP_PATH = 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md';
const LOCAL_SERVICE_SUPERVISOR_SCRIPT = join(REPOSITORY_ROOT, 'scripts/aicc-local-service-supervisor.sh');
const WORK_PACKAGE_ROOTS = ['docs/10_Planning_Roadmap/WorkPackages', 'docs/60_Operations/work-packages'] as const;
const execFileAsync = promisify(execFile);
export const HEALTH_CHILD_PROCESS_TIMEOUT_MS=500;
export const HEALTH_DIAGNOSTIC_TIMEOUT_MS=750;

export type WorkPackage = { id: string; title: string; source: string; rawMarkdown: string; fields: Record<string, string>; sections: Record<string, string>; status: string; goal: string; scope: string; dependencies: string; acceptanceCriteria: string; risks: string; allowed: string; forbidden: string };
export type FormalWorkPackageValidationError={code:string;severity:'AUTO_REMEDIATE'|'WARN'|'HARD_BLOCK';message:string;nextAction?:string};
export type RepositoryModel = { repository: string; branch: string; head: string; localMain: string; remoteMain: string; worktree: 'CLEAN' | 'DIRTY' | 'UNAVAILABLE'; lastCommit: string };
export type LocalServiceSupervisorState = { state: 'PROCESS_DEAD'|'PROCESS_ALIVE_HEALTHY'|'PROCESS_ALIVE_HEALTH_DEGRADED'|'SERVICE_UNHEALTHY'|'RESTARTING'|'RECOVERED'|'HEALTHY'|'RECOVERY_FAILED'; managedPid: number|null; consecutiveFailures: number; recoveryEpoch: number; recoveryAttempts: number; lastHealthFailure?: string; lastHealthDetail?: string; previousEpoch?: number; previousEpochFailures?: number; lastTransitionAt?: string };
export type LocalServiceStatus = { processRunning: boolean; serviceHealthy: boolean; repositoryAvailable: boolean; codexAvailable: boolean; port: number; binding: '127.0.0.1'; supervisor?: LocalServiceSupervisorState; portOwner?: 'CANONICAL_AICC_SERVICE'|'FOREIGN_PROCESS'|'UNAVAILABLE'; conflict?: { pid: string; command: string } };
export type Authorization = { authorizationId: string; workPackageId: string; authoritySha: string; branch: string; headShaAtAuthorization: string; repositoryRoot: string; scope: string[]; allowed: string[]; forbidden: string[]; authorizedAt: string; supersededAt?: string; status?: 'ACTIVE'|'SUPERSEDED' };
export type AuthorizationTransitionSafety = { activeRuntime: boolean; writerLockHeld: boolean };
const AICC_STATE_DIR=resolveAiccStateDir();
export const PR_LOCAL_READ_MODEL_FILE=join(REPOSITORY_ROOT,'docs/10_Planning_Roadmap/03_AICC_PR_READ_MODEL.json');
function activePrProject():ProjectRecord{return createProjectRegistryAuthority().getActiveProject()}
function projectPrReadModelFile(project:ProjectRecord):string{return project.projectId==='aicc'?PR_LOCAL_READ_MODEL_FILE:join(REPOSITORY_ROOT,'docs/10_Planning_Roadmap',`03_AICC_PR_READ_MODEL.${project.projectId}.json`)}
const AUTH_FILE = join(AICC_STATE_DIR, 'authorization.json'); const AUTH_HISTORY_FILE = join(AICC_STATE_DIR, 'authorization-history.json');
function atomicWriteJson(path:string,value:unknown){const tmp=`${path}.${process.pid}.tmp`;writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});renameSync(tmp,path)}
export type EntityDescriptionRecord={repositoryKey:string;entityType:'milestone'|'work_package'|'pull_request';entityId:string;description:string;updatedAt:string;updatedBy:'owner'};
const DESCRIPTION_FILE=join(AICC_STATE_DIR,'entity-descriptions.json');
export function readEntityDescriptions():EntityDescriptionRecord[]{try{return JSON.parse(readFileSync(DESCRIPTION_FILE,'utf8')) as EntityDescriptionRecord[]}catch{return []}}
function writeEntityDescriptions(records:EntityDescriptionRecord[]){mkdirSync(AICC_STATE_DIR,{recursive:true});const tmp=`${DESCRIPTION_FILE}.${process.pid}.tmp`;writeFileSync(tmp,JSON.stringify(records,null,2),{mode:0o600});renameSync(tmp,DESCRIPTION_FILE)}
export function upsertEntityDescription(record:Omit<EntityDescriptionRecord,'updatedAt'|'updatedBy'>){const next=readEntityDescriptions().filter(item=>!(item.repositoryKey===record.repositoryKey&&item.entityType===record.entityType&&item.entityId===record.entityId));next.push({...record,updatedAt:new Date().toISOString(),updatedBy:'owner'});writeEntityDescriptions(next);return next.at(-1)!}
export function clearEntityDescription(repositoryKey:string,entityType:EntityDescriptionRecord['entityType'],entityId:string){writeEntityDescriptions(readEntityDescriptions().filter(item=>!(item.repositoryKey===repositoryKey&&item.entityType===entityType&&item.entityId===entityId)))}
import type {HumanUatRecord,LifecycleEvidenceRecord,PullRequestRecord} from './model/entityTypes.ts';
import type {CiEvidence} from './exactHeadEvidence.ts';
import {dedupeCiEvidence} from './exactHeadEvidence.ts';
const HUMAN_UAT_FILE=join(AICC_STATE_DIR,'human-uat.json');
export function readHumanUatRecords():HumanUatRecord[]{try{return JSON.parse(readFileSync(HUMAN_UAT_FILE,'utf8')) as HumanUatRecord[]}catch{return []}}
export function readHumanUat(repository:string,entityId:string,entityType:'work_package'|'pull_request'='work_package'):HumanUatRecord|null{return readHumanUatRecords().find(item=>item.repository===repository&&item.entityType===entityType&&(item.entityId===entityId||(entityType==='work_package'&&item.workPackageId===entityId)))??null}
export function writeHumanUat(record:HumanUatRecord):HumanUatRecord{const identity=record.entityId??record.workPackageId;const records=readHumanUatRecords().filter(item=>!(item.repository===record.repository&&item.entityType===record.entityType&&(item.entityId??item.workPackageId)===identity));mkdirSync(AICC_STATE_DIR,{recursive:true});atomicWriteJson(HUMAN_UAT_FILE,[...records,record]);return record}
const LIFECYCLE_EVIDENCE_FILE=join(AICC_STATE_DIR,'lifecycle-evidence.json');
const DELIVERY_CONTEXTS_FILE=join(AICC_STATE_DIR,'delivery-context-records.json');
function repositorySlug(repositoryPath=REPOSITORY_ROOT):string|null{try{const remote=execFileSync('git',['config','--get','remote.origin.url'],{cwd:repositoryPath,encoding:'utf8'}).trim();const match=remote.match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/);return match?.[1]??null}catch{return null}}
async function repositorySlugAsync(repositoryPath=REPOSITORY_ROOT):Promise<string|null>{try{const result=await execFileAsync('git',['config','--get','remote.origin.url'],{cwd:repositoryPath,encoding:'utf8'});const match=String(result.stdout).trim().match(/github\.com[/:]([^/]+\/[^/.]+)(?:\.git)?$/);return match?.[1]??null}catch{return null}}
function shortPrTitle(title:string,number:number):string{const normalized=title.replace(/\s+/g,' ').trim();return normalized.slice(0,72)||`PR #${number}`}
function readLatestPrNavigationInputs(project=activePrProject()):PrNavigationSnapshotInput[]{
  const slug=repositorySlug(project.repositoryPath);
  if(!slug)throw new Error('PR_REPOSITORY_UNAVAILABLE');
  try{
    const raw=execFileSync('gh',['api','--paginate','--slurp',`repos/${slug}/pulls?state=all&per_page=100`],{cwd:project.repositoryPath,encoding:'utf8',timeout:10000,stdio:['ignore','pipe','pipe']});
    const response=JSON.parse(raw) as unknown;
    const values=Array.isArray(response)&&response.every(Array.isArray)?response.flat():response;
    if(!Array.isArray(values))throw new Error('PR_FACTS_INVALID');
    return values.filter((item:any)=>Number.isSafeInteger(item?.number)&&item.number>0).map((item:any)=>{
      const prNumber=Number(item.number),title=String(item.title??'');
      const sourceState=item.merged_at?'MERGED':item.draft?'DRAFT':item.state==='open'?'OPEN':'CLOSED';
      const mergeState=typeof item.mergeable_state==='string'?item.mergeable_state:null;
      const explicitBlockingFact=sourceState!=='MERGED'&&['blocked','dirty','unstable'].includes(mergeState?.toLowerCase()??'');
      return {id:`${slug}#${prNumber}`,repository:slug,prNumber,title,shortTitle:shortPrTitle(title,prNumber),sourceState,url:item.html_url,sourceBranch:item.head?.ref,targetBranch:item.base?.ref,deliveryBranch:item.head?.ref,deliveryHeadSha:item.head?.sha,headSha:item.head?.sha,createdAt:item.created_at,updatedAt:item.updated_at,mergeState:mergeState??undefined,explicitBlockingFact} as PrNavigationSnapshotInput;
    });
  }catch(error){
    if(error instanceof Error&&['PR_FACTS_INVALID'].includes(error.message))throw error;
    throw new Error('PR_FACTS_UNAVAILABLE');
  }
}
export function prNavigationSnapshotPath():string{return projectPrReadModelFile(activePrProject())}
export function readPersistedPrNavigationSnapshot(filePath=prNavigationSnapshotPath()):PrNavigationSnapshot|null{try{return deserializePrNavigationSnapshot(JSON.parse(readFileSync(filePath,'utf8')))}catch{return null}}
export function refreshPrNavigationSnapshot(updatedAt=new Date().toISOString(),filePath=prNavigationSnapshotPath(),project=activePrProject()):PrNavigationSnapshot{
  const inputs=readLatestPrNavigationInputs(project);
  const previous=readPersistedPrNavigationSnapshot(filePath);
  const deliveryStore=createJsonDeliveryContextRecordStore(DELIVERY_CONTEXTS_FILE);
  const snapshot=buildPrNavigationSnapshot(inputs,previous,input=>{
    const delivery=deliveryStore.findByPR(input.repository,input.prNumber);
    const explicit=delivery?.work_package_id;
    return explicit&&validWorkPackageId(explicit)?explicit:undefined;
  },updatedAt);
  mkdirSync(dirname(filePath),{recursive:true});
  atomicWriteJson(filePath,snapshot);
  return snapshot;
}
export async function refreshPrNavigationSnapshotAsync(updatedAt=new Date().toISOString(),filePath=prNavigationSnapshotPath(),project=activePrProject()):Promise<PrNavigationSnapshot>{
  const slug=await repositorySlugAsync(project.repositoryPath);
  if(!slug)throw new Error('PR_REPOSITORY_UNAVAILABLE');
  try{
    const result=await execFileAsync('gh',['api','--paginate','--slurp',`repos/${slug}/pulls?state=all&per_page=100`],{cwd:project.repositoryPath,encoding:'utf8',timeout:10000,maxBuffer:4*1024*1024});
    const response=JSON.parse(String(result.stdout)) as unknown;
    const values=Array.isArray(response)&&response.every(Array.isArray)?response.flat():response;
    if(!Array.isArray(values))throw new Error('PR_FACTS_INVALID');
    const inputs=values.filter((item:any)=>Number.isSafeInteger(item?.number)&&item.number>0).map((item:any)=>{const prNumber=Number(item.number),title=String(item.title??'');const sourceState=item.merged_at?'MERGED':item.draft?'DRAFT':item.state==='open'?'OPEN':'CLOSED';const mergeState=typeof item.mergeable_state==='string'?item.mergeable_state:null;const explicitBlockingFact=sourceState!=='MERGED'&&['blocked','dirty','unstable'].includes(mergeState?.toLowerCase()??'');return {id:`${slug}#${prNumber}`,repository:slug,prNumber,title,shortTitle:shortPrTitle(title,prNumber),sourceState,url:item.html_url,sourceBranch:item.head?.ref,targetBranch:item.base?.ref,deliveryBranch:item.head?.ref,deliveryHeadSha:item.head?.sha,headSha:item.head?.sha,createdAt:item.created_at,updatedAt:item.updated_at,mergeState:mergeState??undefined,explicitBlockingFact} as PrNavigationSnapshotInput});
    const previous=readPersistedPrNavigationSnapshot(filePath);
    const deliveryStore=createJsonDeliveryContextRecordStore(DELIVERY_CONTEXTS_FILE);
    const snapshot=buildPrNavigationSnapshot(inputs,previous,input=>{const delivery=deliveryStore.findByPR(input.repository,input.prNumber);const explicit=delivery?.work_package_id;return explicit&&validWorkPackageId(explicit)?explicit:undefined},updatedAt);
    mkdirSync(dirname(filePath),{recursive:true});atomicWriteJson(filePath,snapshot);return snapshot;
  }catch(error){if(error instanceof Error&&error.message==='PR_FACTS_INVALID')throw error;throw new Error('PR_FACTS_UNAVAILABLE')}
}
export async function readOrRebuildPersistedPrNavigationSnapshot():Promise<PrNavigationSnapshot>{return readPersistedPrNavigationSnapshot()??refreshPrNavigationSnapshotAsync();}
export function readPullRequests():PullRequestRecord[]{const snapshot=readPersistedPrNavigationSnapshot();return snapshot?snapshot.records.map(record=>toPullRequestRecordLike(record) as PullRequestRecord):[];}
export async function readPullRequestsAsync():Promise<PullRequestRecord[]>{const snapshot=await readOrRebuildPersistedPrNavigationSnapshot();return snapshot.records.map(record=>toPullRequestRecordLike(record) as PullRequestRecord);}
function readGitHubCiEvidence():CiEvidence[]{const slug=repositorySlug();if(!slug)return[];try{const raw=execFileSync('gh',['api',`repos/${slug}/actions/runs?per_page=100`],{cwd:REPOSITORY_ROOT,encoding:'utf8',timeout:4000,stdio:['ignore','pipe','ignore']});const values=JSON.parse(raw)?.workflow_runs as Array<any>;if(!Array.isArray(values))return[];return dedupeCiEvidence(values.flatMap(run=>{const pullRequests=Array.isArray(run.pull_requests)?run.pull_requests:[];return pullRequests.filter((pr:any)=>Number.isInteger(pr?.number)&&typeof run?.id!=='undefined'&&typeof run?.head_sha==='string').map((pr:any)=>({ci_run_id:String(run.id),repository:slug,pr_number:Number(pr.number),head_sha:String(run.head_sha),provider:'GitHub Actions',workflow:String(run.name??run.workflow_name??'UNKNOWN_WORKFLOW'),status:run.conclusion? 'COMPLETED':String(run.status??'UNKNOWN').toUpperCase(),conclusion:run.conclusion?String(run.conclusion).toUpperCase():'NOT_AVAILABLE',started_at:String(run.run_started_at??run.created_at??''),completed_at:run.updated_at?String(run.updated_at):undefined,url:run.html_url?String(run.html_url):undefined} as CiEvidence));}));}catch{return[]}}
export function readCiEvidence():CiEvidence[]{return readGitHubCiEvidence();}
export async function readCiEvidenceAsync():Promise<CiEvidence[]>{const slug=await repositorySlugAsync();if(!slug)return[];try{const result=await execFileAsync('gh',['api',`repos/${slug}/actions/runs?per_page=100`],{cwd:REPOSITORY_ROOT,encoding:'utf8',timeout:4000,maxBuffer:4*1024*1024});const values=JSON.parse(String(result.stdout))?.workflow_runs as Array<any>;if(!Array.isArray(values))return[];return dedupeCiEvidence(values.flatMap(run=>{const pullRequests=Array.isArray(run.pull_requests)?run.pull_requests:[];return pullRequests.filter((pr:any)=>Number.isInteger(pr?.number)&&typeof run?.id!=='undefined'&&typeof run?.head_sha==='string').map((pr:any)=>({ci_run_id:String(run.id),repository:slug,pr_number:Number(pr.number),head_sha:String(run.head_sha),provider:'GitHub Actions',workflow:String(run.name??run.workflow_name??'UNKNOWN_WORKFLOW'),status:run.conclusion?'COMPLETED':String(run.status??'UNKNOWN').toUpperCase(),conclusion:run.conclusion?String(run.conclusion).toUpperCase():'NOT_AVAILABLE',started_at:String(run.run_started_at??run.created_at??''),completed_at:run.updated_at?String(run.updated_at):undefined,url:run.html_url?String(run.html_url):undefined} as CiEvidence))}))}catch{return[]}}
const PR_CREATION_REQUESTS_FILE=join(AICC_STATE_DIR,'pr-creation-requests.json');
export type PrCreationRequest={prId:string;workPackageId:string;runId:string;requestedAt:string;sourceBranch?:string;deliveryBranch?:string;repository?:string};
export function deterministicPrDeliveryBranch(workPackageId:string,prId:string){const safe=(value:string)=>value.toLowerCase().replace(/[^a-z0-9-]+/g,'-').replace(/^-+|-+$/g,'');return `aicc/pr/${safe(workPackageId)}/${safe(prId).slice(-48)}`;}
export function readPrCreationRequests():PrCreationRequest[]{try{return JSON.parse(readFileSync(PR_CREATION_REQUESTS_FILE,'utf8')) as PrCreationRequest[]}catch{return []}}
export function readPrCreationRequest(prId:string){return readPrCreationRequests().find(item=>item.prId===prId)??null}
export function writePrCreationRequest(record:PrCreationRequest){const records=readPrCreationRequests().filter(item=>item.prId!==record.prId);mkdirSync(AICC_STATE_DIR,{recursive:true});atomicWriteJson(PR_CREATION_REQUESTS_FILE,[...records,record]);return record}
export function readLifecycleEvidenceRecords():LifecycleEvidenceRecord[]{try{return JSON.parse(readFileSync(LIFECYCLE_EVIDENCE_FILE,'utf8')) as LifecycleEvidenceRecord[]}catch{return []}}
export function readLifecycleEvidence(repository:string,workPackageId:string):LifecycleEvidenceRecord|null{return readLifecycleEvidenceRecords().find(item=>item.repository===repository&&item.workPackageId===workPackageId)??null}
export function writeLifecycleEvidence(record:LifecycleEvidenceRecord):LifecycleEvidenceRecord{const records=readLifecycleEvidenceRecords().filter(item=>!(item.repository===record.repository&&item.workPackageId===record.workPackageId));mkdirSync(AICC_STATE_DIR,{recursive:true});atomicWriteJson(LIFECYCLE_EVIDENCE_FILE,[...records,record]);return record}

export function validWorkPackageId(id: string): boolean { return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id) && !id.includes('..') && !id.includes('/') && !id.includes('\\'); }
/** Read canonical product truth from local main without changing the active checkout. */
export function readCanonicalMainFile(relativePath: string): string {
  if (!/^[A-Za-z0-9._/-]+$/.test(relativePath) || relativePath.includes('..')) throw new Error('CANONICAL_PATH_INVALID');
  try { return execFileSync('git', ['show', `${GITHUB_MAIN_REF}:${relativePath}`], { cwd: REPOSITORY_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { throw new Error('GITHUB_ROADMAP_SOURCE_UNAVAILABLE'); }
}
export function readLocalRoadmap(): string { try { return readFileSync(ROADMAP, 'utf8'); } catch { throw new Error('LOCAL_ROADMAP_SOURCE_UNAVAILABLE'); } }
export function readRoadmap(): string { return readLocalRoadmap(); }
export async function readRoadmapAsync(): Promise<string> { try { return await readFile(ROADMAP, 'utf8'); } catch { throw new Error('LOCAL_ROADMAP_SOURCE_UNAVAILABLE'); } }
export function readGithubRoadmap(): string {
  try { return execFileSync('git', ['show', `${ROADMAP_GITHUB_REF}:${ROADMAP_PATH}`], { cwd: REPOSITORY_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }); }
  catch { throw new Error('GITHUB_ROADMAP_SOURCE_UNAVAILABLE'); }
}
export async function readGithubRoadmapAsync(): Promise<string> { try { const result=await execFileAsync('git',['show',`${ROADMAP_GITHUB_REF}:${ROADMAP_PATH}`],{cwd:REPOSITORY_ROOT,encoding:'utf8',maxBuffer:1024*1024}); return String(result.stdout).trim(); } catch { throw new Error('GITHUB_ROADMAP_SOURCE_UNAVAILABLE'); } }
function refreshRoadmapGithubRef(): void {
  try {
    execFileSync('git', ['fetch', '--no-tags', 'origin', `refs/heads/${ROADMAP_GITHUB_BRANCH}:refs/remotes/origin/${ROADMAP_GITHUB_BRANCH}`], { cwd: REPOSITORY_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  } catch {
    throw new Error('GITHUB_ROADMAP_FETCH_FAILED');
  }
}
export function roadmapSourcePath(): string { return ROADMAP_PATH; }
export function roadmapProjectionPath(): string { return roadmapReadModelPath(REPOSITORY_ROOT); }
export function readPersistedRoadmapProjection():AiccRoadmapReadModel|null{try{return deserializeRoadmapReadModel(JSON.parse(readFileSync(roadmapProjectionPath(),'utf8')))}catch{return null}}
export function readRoadmapProjection():RoadmapProjection|null{const persisted=readPersistedRoadmapProjection();return persisted?deserializeRoadmapProjection(persisted):null}
export function readCanonicalRoadmapStructuralProjection():AiccRoadmapReadModel{return ensureRoadmapReadModel()}
export function bootstrapInitialRoadmapProjection():{projection:RoadmapProjection;persisted:AiccRoadmapReadModel}{const persisted=ensureRoadmapReadModel();const projection=deserializeRoadmapProjection(persisted);if(!projection)throw new Error('ROADMAP_READ_MODEL_BUILD_FAILED');return {projection,persisted}}
export function syncRoadmapProjection(selection?:{selectedId?:string;lockedId?:string|null}):{projection:RoadmapProjection;persisted:AiccRoadmapReadModel}{const persisted=ensureRoadmapReadModel({forceRebuild:true});const projection=deserializeRoadmapProjection(persisted);if(!projection)throw new Error('ROADMAP_READ_MODEL_BUILD_FAILED');if(selection?.selectedId&&!projection.nodeIds.has(selection.selectedId))throw new Error('ROADMAP_UI_STATE_TARGET_MISSING');if(selection?.lockedId&&!projection.nodeIds.has(selection.lockedId))throw new Error('ROADMAP_UI_STATE_TARGET_MISSING');return {projection,persisted}}
export function readFormalWorkPackageRegistry():Map<string,FormalWorkPackageRegistration>{
  if(formalRegistrySnapshot)return formalRegistrySnapshot;
  formalRegistrySnapshot=buildFormalWorkPackageRegistry(readLocalRoadmap(),canonicalWorkPackageIds());
  void refreshFormalWorkPackageRegistry();
  return formalRegistrySnapshot;
}
export function isRegisteredFormalWorkPackage(id:string):boolean{return readFormalWorkPackageRegistry().has(id)}
let formalRegistrySnapshot:Map<string,FormalWorkPackageRegistration>|null=null;
function buildFormalWorkPackageRegistry(markdown:string,canonicalIds:string[]):Map<string,FormalWorkPackageRegistration>{
  const declared=parseFormalWorkPackageRegistry(markdown);
  const canonical=new Set(canonicalIds);
  return new Map([...declared].filter(([id])=>canonical.has(id)||WORK_PACKAGE_ROOTS.some(root=>existsSync(join(REPOSITORY_ROOT,root,`${id}.md`)))));
}
let canonicalIdsSnapshot:string[]=[];
let canonicalIdsRefresh:Promise<string[]>|null=null;
async function refreshCanonicalWorkPackageIds():Promise<string[]>{
  if(canonicalIdsRefresh)return canonicalIdsRefresh;
  canonicalIdsRefresh=(async()=>{
    const outputs=await Promise.all(WORK_PACKAGE_ROOTS.map(root=>asyncGit(['ls-tree','-r','--name-only',GITHUB_MAIN_REF,root+'/'])));
    const names=outputs.flatMap(value=>value==='unavailable'?[]:value.split('\n').filter(Boolean));
    canonicalIdsSnapshot=[...new Set(names.map(name=>name.split('/').at(-1)??'').filter(name=>/^[A-Za-z0-9][A-Za-z0-9._-]*\\.md$/.test(name)).map(name=>name.slice(0,-3)))];
    return canonicalIdsSnapshot;
  })().finally(()=>{canonicalIdsRefresh=null});
  return canonicalIdsRefresh;
}
void refreshCanonicalWorkPackageIds();
async function refreshFormalWorkPackageRegistry():Promise<void>{
  try{const markdown=await readFile(ROADMAP,'utf8');const ids=await refreshCanonicalWorkPackageIds();formalRegistrySnapshot=buildFormalWorkPackageRegistry(markdown,ids)}catch{}
}
function canonicalWorkPackageIds(): string[] {
  return canonicalIdsSnapshot;
}
export function readWorkPackage(id: string): WorkPackage {
  if (!validWorkPackageId(id)) throw new Error('WP_INVALID_ID');
  const canonicalPath = WORK_PACKAGE_ROOTS.map(root => `${root}/${id}.md`).find(path => { try { readCanonicalMainFile(path); return true; } catch { return false; } });
  // Keep compatibility for an explicitly selected historical/local WP, while
  // the Roadmap list itself remains strictly main-bound.
  const relativePath = canonicalPath ?? (WORK_PACKAGE_ROOTS.map(root => join(REPOSITORY_ROOT, root, `${id}.md`)).find(path => existsSync(path))?.replace(`${REPOSITORY_ROOT}/`, ''));
  if (!relativePath) throw new Error('WP_NOT_FOUND_IN_CANONICAL_MAIN');
  const text = canonicalPath ? readCanonicalMainFile(canonicalPath) : readFileSync(join(REPOSITORY_ROOT, relativePath), 'utf8');
  const heading = text.match(/^#\s+(.+)$/m)?.[1] ?? id;
  const fields: Record<string, string> = {};
  for (const line of text.split('\n')) {
    const colon=line.match(/^(?:\*\*)?([^:*]+?)(?:\*\*)?:\s*(.+)$/);
    const equality=line.match(/^`?\s*([^=`:]+?)\s*(?:=|:)\s*([^`]+?)\s*`?\s*$/);
    const match=colon??equality;
    if(match)fields[match[1].trim().replace(/^`|`$/g,'')]=match[2].trim().replace(/^`|`$/g,'');
  }
  const sections: Record<string, string> = {};
  let section = ''; for (const line of text.split('\n')) { const headingMatch = line.match(/^##\s+(.+?)\s*$/); if (headingMatch) { section = headingMatch[1].trim(); sections[section] = ''; } else if (section) sections[section] += `${sections[section] ? '\n' : ''}${line}`; }
  for (const key of Object.keys(sections)) sections[key] = sections[key].trim();
  const pick = (...keys: string[]) => keys.map((key) => sections[key] ?? fields[key]).find((value) => value?.trim())?.trim() ?? '';
  const goal = pick('Goal', '目标'), scope = pick('Scope', '范围'), dependencies = pick('Dependencies', '依赖'), acceptanceCriteria = pick('Acceptance Criteria', '验收标准', 'Machine Acceptance', '机器验收'), risks = pick('Risks', '风险'), allowed = pick('Allowed', '允许'), forbidden = pick('Forbidden', '禁止');
  sections.Goal = goal; sections.Scope = scope; sections.Dependencies = dependencies; sections['Acceptance Criteria'] = acceptanceCriteria;
  return { id, title: heading.replace(/^[^:：]+[:：]\s*/, ''), source: relativePath, rawMarkdown: text, fields, sections, status: fields.Status ?? fields.status ?? '未提供', goal, scope, dependencies, acceptanceCriteria, risks, allowed, forbidden };
}
export function readWorkPackages(): WorkPackage[] {
  return [...readFormalWorkPackageRegistry().keys()].sort().map(id=>readWorkPackage(id));
}
export function validateFormalWorkPackage(workPackage:WorkPackage,requestedId=workPackage.id):FormalWorkPackageValidationError[]{
  const errors:FormalWorkPackageValidationError[]=[];
  if(workPackage.id!==requestedId)errors.push({code:'WP_ID_MISMATCH',severity:'HARD_BLOCK',message:'正式 Work Package 标识与选择项不一致。',nextAction:'刷新状态后重新选择该 Work Package。'});
  if(!isRegisteredFormalWorkPackage(requestedId))errors.push({code:'WP_NOT_REGISTERED_IN_ROADMAP',severity:'HARD_BLOCK',message:'该标识未注册为 Living Roadmap 的正式 Work Package。',nextAction:'使用 Roadmap 已注册的正式 Work Package；Task 标识不能取得 Roadmap 权限。'});
  if(!workPackage.title.trim())errors.push({code:'WP_TITLE_MISSING',severity:'HARD_BLOCK',message:'正式 Work Package 缺少标题。',nextAction:'补充正式 Work Package 标题。'});
  if(!workPackage.goal.trim())errors.push({code:'WP_GOAL_MISSING',severity:'HARD_BLOCK',message:'正式 Work Package 缺少 Goal。',nextAction:'补充正式 Work Package Goal。'});
  if(!workPackage.scope.trim())errors.push({code:'WP_SCOPE_MISSING',severity:'HARD_BLOCK',message:'正式 Work Package 缺少 Scope。',nextAction:'补充正式 Work Package Scope。'});
  if(!workPackage.acceptanceCriteria.trim())errors.push({code:'WP_ACCEPTANCE_MISSING',severity:'HARD_BLOCK',message:'正式 Work Package 缺少机器验收标准。',nextAction:'补充 Machine Acceptance 或 Acceptance Criteria。'});
  if(!workPackage.fields.Status&&!workPackage.fields.status)errors.push({code:'WP_STATUS_MISSING',severity:'WARN',message:'正式 Work Package 未提供 Status，将由生命周期证据决定。'});
  return errors;
}

function git(args: string[]): string { return execFileSync('git', args, { cwd: REPOSITORY_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function safeGit(args: string[]): string { try { return git(args); } catch { return 'unavailable'; } }
function launchctl(args: string[]): string { return execFileSync('/bin/launchctl', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
async function asyncGit(args:string[]):Promise<string>{try{const result=await execFileAsync('git',args,{cwd:REPOSITORY_ROOT,encoding:'utf8',maxBuffer:1024*1024});return String(result.stdout).trim()}catch{return 'unavailable'}}
async function asyncProcessCommand(pid:string,timeout=HEALTH_CHILD_PROCESS_TIMEOUT_MS):Promise<string>{try{const result=await execFileAsync('/bin/ps',['-p',pid,'-o','command='],{encoding:'utf8',timeout});return String(result.stdout).trim().slice(0,240)}catch{return 'unavailable'}}
let repositorySnapshot:RepositoryModel|null=null;
let repositoryRefresh:Promise<RepositoryModel>|null=null;
function fallbackRepository():RepositoryModel{return {repository:REPOSITORY_ROOT,branch:'unavailable',head:'unavailable',localMain:'unavailable',remoteMain:'unavailable',worktree:'UNAVAILABLE',lastCommit:'unavailable'}}
export async function readRepositoryAsync():Promise<RepositoryModel>{if(repositoryRefresh)return repositoryRefresh;repositoryRefresh=(async()=>{const [head,branch,localMain,remoteMain,status,lastCommit]=await Promise.all([asyncGit(['rev-parse','HEAD']),asyncGit(['branch','--show-current']),asyncGit(['rev-parse','refs/heads/main']),asyncGit(['rev-parse','refs/remotes/origin/main']),asyncGit(['status','--porcelain']),asyncGit(['log','-1','--format=%h %s'])]);const next:RepositoryModel={repository:REPOSITORY_ROOT,branch,head,localMain,remoteMain,worktree:status==='unavailable'?'UNAVAILABLE':status===''?'CLEAN':'DIRTY',lastCommit};repositorySnapshot=next;return next})().finally(()=>{repositoryRefresh=null});return repositoryRefresh}
void readRepositoryAsync();
export function readLocalServiceStatus(healthProbe:()=>boolean): LocalServiceStatus {
  const repositoryAvailable=existsSync(REPOSITORY_ROOT)&&existsSync(join(REPOSITORY_ROOT,'package.json'))&&existsSync(ROADMAP);
  const supervisor=readLocalServiceSupervisorState();
  const terminalFailure=supervisor?.state==='RECOVERY_FAILED';
  const portTruth=detectPortOwner(()=>true);
  const canonicalListener=portTruth.portOwner==='CANONICAL_AICC_SERVICE';
  const processRunning=canonicalListener||Boolean(supervisor?.managedPid!==null&&supervisor?.managedPid!==undefined);
  const serviceHealthy=repositoryAvailable&&!terminalFailure&&canonicalListener;
  return {processRunning,serviceHealthy,repositoryAvailable,codexAvailable:existsSync('/usr/local/bin/codex')||existsSync('/opt/homebrew/bin/codex'),port:1420,binding:'127.0.0.1',supervisor:supervisor??undefined,portOwner:portTruth.portOwner,conflict:portTruth.conflict};
}
export function readLocalServiceHealthStatus():LocalServiceStatus{return readLocalServiceStatus(()=>true)}
export type LocalServiceAsyncDependencies={detectPortOwner?:()=>Promise<Pick<LocalServiceStatus,'portOwner'|'conflict'>>;diagnosticTimeoutMs?:number};
async function boundedHealthDiagnostic<T>(operation:()=>Promise<T>,timeoutMs:number):Promise<T|null>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return await Promise.race([operation(),new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),timeoutMs)})]);}
  catch{return null}
  finally{if(timer!==undefined)clearTimeout(timer)}
}
export async function readLocalServiceStatusAsync(options:LocalServiceAsyncDependencies={}):Promise<LocalServiceStatus>{
  const repositoryAvailable=existsSync(REPOSITORY_ROOT)&&existsSync(join(REPOSITORY_ROOT,'package.json'))&&existsSync(ROADMAP);
  const supervisor=readLocalServiceSupervisorState();
  const terminalFailure=supervisor?.state==='RECOVERY_FAILED';
  const selfManaged=supervisor?.managedPid===process.pid;
  const portTruth=selfManaged?{portOwner:'CANONICAL_AICC_SERVICE' as const}:await boundedHealthDiagnostic(options.detectPortOwner??(()=>detectPortOwnerAsync(()=>true)),options.diagnosticTimeoutMs??HEALTH_DIAGNOSTIC_TIMEOUT_MS)??{portOwner:'UNAVAILABLE' as const};
  const canonicalListener=portTruth.portOwner==='CANONICAL_AICC_SERVICE';
  const processRunning=canonicalListener||Boolean(supervisor?.managedPid!==null&&supervisor?.managedPid!==undefined);
  const serviceHealthy=repositoryAvailable&&!terminalFailure&&canonicalListener;
  return {processRunning,serviceHealthy,repositoryAvailable,codexAvailable:existsSync('/usr/local/bin/codex')||existsSync('/opt/homebrew/bin/codex'),port:1420,binding:'127.0.0.1',supervisor:supervisor??undefined,portOwner:portTruth.portOwner,conflict:portTruth.conflict};
}
export async function readLocalServiceHealthStatusAsync(options:LocalServiceAsyncDependencies={}):Promise<LocalServiceStatus>{return readLocalServiceStatusAsync(options)}
export function readLocalServiceSupervisorState():LocalServiceSupervisorState|null{
  try{
    const raw=readFileSync(join(AICC_STATE_DIR,'local-service-supervisor.state'),'utf8');
    const values=Object.fromEntries(raw.split('\n').filter(Boolean).map(line=>{const index=line.indexOf('=');return [line.slice(0,index),line.slice(index+1)]}));
    const states=['PROCESS_DEAD','PROCESS_ALIVE_HEALTHY','PROCESS_ALIVE_HEALTH_DEGRADED','SERVICE_UNHEALTHY','RESTARTING','RECOVERED','HEALTHY','RECOVERY_FAILED'] as const;
    if(!states.includes(values.SERVICE_STATE as typeof states[number]))return null;
    const numberOrNull=(value:string|undefined):number|null=>value&&/^\d+$/.test(value)?Number(value):null;
    return {state:values.SERVICE_STATE as LocalServiceSupervisorState['state'],managedPid:numberOrNull(values.MANAGED_PID),consecutiveFailures:Number(values.CONSECUTIVE_FAILURES||0),recoveryEpoch:Number(values.RECOVERY_EPOCH||0),recoveryAttempts:Number(values.RECOVERY_ATTEMPTS||0),lastHealthFailure:values.LAST_HEALTH_FAILURE||undefined,lastHealthDetail:values.LAST_HEALTH_DETAIL||undefined,previousEpoch:Number(values.PREVIOUS_EPOCH||0),previousEpochFailures:Number(values.PREVIOUS_EPOCH_FAILURES||0),lastTransitionAt:values.LAST_TRANSITION_AT||undefined};
  }catch{return null;}
}
export function detectPortOwner(healthProbe:()=>boolean=()=>true): Pick<LocalServiceStatus,'portOwner'|'conflict'> {
  try { const pid=execFileSync('/usr/sbin/lsof',['-nP','-iTCP:1420','-sTCP:LISTEN','-t'],{encoding:'utf8'}).trim().split(/\s+/)[0]; if(!pid)return {portOwner:'UNAVAILABLE'}; const command=safeProcessCommand(pid); const cwd=(()=>{try{return execFileSync('/usr/sbin/lsof',['-a','-p',pid,'-d','cwd','-Fn'],{encoding:'utf8'}).split('\n').find(x=>x.startsWith('n'))?.slice(1)??''}catch{return ''}})(); const canonical=healthProbe()&&((pid===String(process.pid)&&repositoryAvailableForService())||(sameCanonicalPath(cwd,REPOSITORY_ROOT)&&/npm|node|vite/.test(command))); return canonical?{portOwner:'CANONICAL_AICC_SERVICE'}:{portOwner:'FOREIGN_PROCESS',conflict:{pid,command}}; } catch { return {portOwner:'UNAVAILABLE'}; }
}
export async function detectPortOwnerAsync(healthProbe:()=>boolean=()=>true):Promise<Pick<LocalServiceStatus,'portOwner'|'conflict'>>{try{const result=await execFileAsync('/usr/sbin/lsof',['-nP','-iTCP:1420','-sTCP:LISTEN','-t'],{encoding:'utf8',timeout:HEALTH_CHILD_PROCESS_TIMEOUT_MS});const pid=String(result.stdout).trim().split(/\s+/)[0];if(!pid)return {portOwner:'UNAVAILABLE'};const command=await asyncProcessCommand(pid,HEALTH_CHILD_PROCESS_TIMEOUT_MS);const cwdResult=await execFileAsync('/usr/sbin/lsof',['-a','-p',pid,'-d','cwd','-Fn'],{encoding:'utf8',timeout:HEALTH_CHILD_PROCESS_TIMEOUT_MS});const cwd=String(cwdResult.stdout).split('\n').find(value=>value.startsWith('n'))?.slice(1)??'';const canonical=healthProbe()&&((pid===String(process.pid)&&repositoryAvailableForService())||(sameCanonicalPath(cwd,REPOSITORY_ROOT)&&/npm|node|vite/.test(command)));return canonical?{portOwner:'CANONICAL_AICC_SERVICE'}:{portOwner:'FOREIGN_PROCESS',conflict:{pid,command}}}catch{return {portOwner:'UNAVAILABLE'}}}
function repositoryAvailableForService(){return existsSync(REPOSITORY_ROOT)&&existsSync(join(REPOSITORY_ROOT,'package.json'))&&existsSync(ROADMAP)}
function safeProcessCommand(pid:string){try{return execFileSync('/bin/ps',['-p',pid,'-o','command='],{encoding:'utf8'}).trim().slice(0,240)}catch{return 'unavailable'}}
export function restartLocalService(){ execFile('/bin/sh',[LOCAL_SERVICE_SUPERVISOR_SCRIPT,'restart'],()=>{}); return 'RESTART_REQUESTED'; }
export function stopLocalService(){ if(!process.getuid)throw new Error('SUPERVISOR_UNAVAILABLE'); execFile('/bin/launchctl',['kill','SIGTERM',`gui/${process.getuid()}/${LOCAL_SERVICE_LABEL}`],()=>{}); return 'STOP_REQUESTED'; }
export function readLocalServiceLogs(){const base=join(homedir(),'Library/Logs/AICC');const read=(name:string)=>{try{return readFileSync(join(base,name),'utf8').slice(-12000)}catch{return '日志不可用'}};return {stdout:read('local-service.stdout.log'),stderr:read('local-service.stderr.log')};}
export function readRepository(): RepositoryModel {
  return repositorySnapshot??fallbackRepository();
}
export function readAuthorization(): Authorization | null { try { const record = JSON.parse(readFileSync(AUTH_FILE, 'utf8')) as Authorization; return record.status === 'SUPERSEDED' ? null : record; } catch { return null; } }
export function readAuthorizationHistory(): Authorization[] { try { return JSON.parse(readFileSync(AUTH_HISTORY_FILE, 'utf8')) as Authorization[]; } catch { return []; } }
function readStoredAuthorization(): Authorization | null { try { return JSON.parse(readFileSync(AUTH_FILE, 'utf8')) as Authorization; } catch { return null; } }
function readAuthorizationTransitionSafety(): AuthorizationTransitionSafety {
  let activeRuntime = false;
  try { const runtime = JSON.parse(readFileSync(join(AICC_STATE_DIR, 'runtime.json'), 'utf8')) as { phase?: string }; activeRuntime = ['STARTING', 'RUNNING', 'STOPPING'].includes(runtime.phase ?? ''); } catch { /* no runtime evidence */ }
  return { activeRuntime, writerLockHeld: existsSync(join(AICC_STATE_DIR, 'writer.lock')) };
}
export function authorizationSupersessionBlocker(id: string, repo: RepositoryModel, existing: Authorization | null, safety: AuthorizationTransitionSafety,preflight?:ExecutionPreflight): string | null {
  const base = authorizationBlocker(id, repo, true,preflight);
  if (base && base !== 'AUTHORIZATION_CONFLICT') return base;
  if (safety.activeRuntime) return 'ACTIVE_RUNTIME_CONFLICT';
  if (safety.writerLockHeld) return 'WRITER_LOCK_HELD';
  if (existing && !sameCanonicalPath(existing.repositoryRoot,repo.repository)) return 'AUTHORIZATION_REPOSITORY_MISMATCH';
  if (existing && existing.branch !== repo.branch) return 'AUTHORIZATION_BRANCH_MISMATCH';
  if (existing && existing.authoritySha !== repo.remoteMain) return 'AUTHORITY_DRIFT';
  return null;
}
export function authorizationState(id: string, repo: RepositoryModel): { status: 'AUTHORIZED' | 'INVALID' | 'UNAUTHORIZED'; record: Authorization | null; reason?: string } {
  const record = readAuthorization(); if (!record) return { status: 'UNAUTHORIZED', record: null };
  if (record.workPackageId !== id) return { status: 'INVALID', record, reason: 'WORK_PACKAGE_CHANGED' };
  if (record.branch !== repo.branch) return { status: 'INVALID', record, reason: 'BRANCH_CHANGED' };
  if (record.authoritySha !== repo.remoteMain) return { status: 'INVALID', record, reason: 'AUTHORITY_CHANGED' };
  if (!sameCanonicalPath(record.repositoryRoot,repo.repository)) return { status: 'INVALID', record, reason: 'REPOSITORY_CHANGED' };
  return { status: 'AUTHORIZED', record };
}
export function authorizationBlocker(id: string, repo: RepositoryModel | null, wpExists: boolean,preflight?:ExecutionPreflight): string | null {
  if (!id) return 'NO_WORK_PACKAGE_SELECTED'; if (!wpExists) return 'WP_NOT_FOUND'; if (!repo) return 'REPOSITORY_UNAVAILABLE';
  if(repo.worktree==='DIRTY'&&!preflight)return 'CANONICAL_DECISION_UNAVAILABLE';if(preflight?.severity==='HARD_BLOCK')return preflight.reasonCode??'EXECUTION_PREFLIGHT_BLOCKED';if (!repo.branch || repo.branch === 'unavailable') return 'DETACHED_HEAD'; if (repo.branch === 'main') return 'FEATURE_BRANCH_REQUIRED';
  if (!repo.remoteMain || repo.remoteMain.includes('unavailable')) return 'REMOTE_MAIN_UNAVAILABLE'; if (repo.localMain !== repo.remoteMain) return 'SYNC_REQUIRED';
  const state = authorizationState(id, repo); if (state.status === 'AUTHORIZED') return 'AUTHORIZATION_CONFLICT'; return null;
}
export function persistAuthorization(id: string, repo: RepositoryModel,preflight?:ExecutionPreflight): Authorization {
  const blocker = authorizationBlocker(id, repo, true,preflight); if (blocker) throw new Error(blocker);
  const record: Authorization = { authorizationId: `auth-${Date.now()}`, workPackageId: id, authoritySha: repo.remoteMain, branch: repo.branch, headShaAtAuthorization: repo.head, repositoryRoot: repo.repository, scope: ['read_repository', 'read_work_package', 'execute_work_package'], allowed: ['owner_confirmed_actions','codex_runtime','writer_lock'], forbidden: ['arbitrary_shell', 'push', 'merge'], authorizedAt: new Date().toISOString() };
  mkdirSync(AICC_STATE_DIR, { recursive: true }); atomicWriteJson(AUTH_FILE,record); return record;
}
export function reauthorizeAuthorization(id: string, repo: RepositoryModel,preflight?:ExecutionPreflight): { record: Authorization; superseded: boolean } {
  if (!id) throw new Error('NO_WORK_PACKAGE_SELECTED');
  const existing = readStoredAuthorization();
  const blocker = authorizationSupersessionBlocker(id, repo, existing, readAuthorizationTransitionSafety(),preflight);
  if (blocker) throw new Error(blocker);
  if (existing && existing.workPackageId===id&&existing.headShaAtAuthorization === repo.head&&existing.allowed.includes('codex_runtime')&&existing.allowed.includes('writer_lock')) return { record: existing, superseded: false };
  const record: Authorization = { authorizationId: `auth-${Date.now()}`, workPackageId: id, authoritySha: repo.remoteMain, branch: repo.branch, headShaAtAuthorization: repo.head, repositoryRoot: repo.repository, scope: ['read_repository', 'read_work_package', 'execute_work_package'], allowed: ['owner_confirmed_actions','codex_runtime','writer_lock'], forbidden: ['arbitrary_shell', 'push', 'merge'], authorizedAt: new Date().toISOString(), status: 'ACTIVE' };
  mkdirSync(AICC_STATE_DIR, { recursive: true });
  if (existing) { const superseded = { ...existing, status: 'SUPERSEDED' as const, supersededAt: record.authorizedAt }; let history: Authorization[] = []; try { history = JSON.parse(readFileSync(AUTH_HISTORY_FILE, 'utf8')) as Authorization[]; } catch { /* no history yet */ } atomicWriteJson(AUTH_HISTORY_FILE,[...history, superseded]); }
  atomicWriteJson(AUTH_FILE,record); return { record, superseded: Boolean(existing) };
}
export function authorizeWorkPackage(id:string):{record:Authorization;superseded:boolean;leaseId:string;decision:ReturnType<typeof canonicalExecutionDecision>}{
  const repo=readRepository(),wp=readWorkPackage(id),validation=validateFormalWorkPackage(wp,id),scopes=resolveExecutionScopes(wp),existing=readAuthorization(),decision=canonicalExecutionDecision(repo,id,scopes.scope,readWorktreeFiles(repo.repository),scopes.knownNonConflicting,{requireAuthorization:false,formalWpValid:validation.every(item=>item.severity!=='HARD_BLOCK')});
  if(decision.decision==='HARD_BLOCK')throw new Error(decision.reasonCode??'EXECUTION_PREFLIGHT_BLOCKED');
  const blocker=authorizationBlocker(id,repo,true,decision);if(blocker&&blocker!=='AUTHORIZATION_CONFLICT')throw new Error(blocker);
  const result=existing?reauthorizeAuthorization(id,repo,decision):{record:persistAuthorization(id,repo,decision),superseded:false};
  if(existing&&existing.workPackageId!==id)revokeExecutionLease(existing.workPackageId);
  const lease=grantExecutionLease(repo,id,scopes.scope,readWorktreeFiles(repo.repository),'owner',decision.provenance);
  return {...result,leaseId:lease.leaseId,decision};
}
export function syncLocalMain(): 'ALREADY_SYNCED' | 'FAST_FORWARD' { const repo = readRepository(); if (repo.worktree !== 'CLEAN') throw new Error('WORKTREE_DIRTY'); if (repo.branch === 'main') throw new Error('MAIN_SYNC_REQUIRES_FEATURE_BRANCH'); git(['fetch', 'origin', 'main']); const remote = git(['rev-parse', 'refs/remotes/origin/main']); const local = safeGit(['rev-parse', 'refs/heads/main']); if (local === remote) return 'ALREADY_SYNCED'; try { execFileSync('git', ['merge-base', '--is-ancestor', local, remote], { cwd: REPOSITORY_ROOT, stdio: 'ignore' }); } catch { throw new Error('LOCAL_MAIN_DIVERGED'); } execFileSync('git', ['update-ref', 'refs/heads/main', remote, local], { cwd: REPOSITORY_ROOT, stdio: 'ignore' }); return 'FAST_FORWARD'; }
