import { execFile, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';
import type {ExecutionPreflight} from './fastExecution.ts';

export const REPOSITORY_ROOT = '/Users/a/AI/007/AIcontrolcenter';
export const LOCAL_SERVICE_LABEL = 'com.aicc.v2.local-service';
const ROADMAP = join(REPOSITORY_ROOT, 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md');
const WORK_PACKAGES = join(REPOSITORY_ROOT, 'docs/60_Operations/work-packages');

export type WorkPackage = { id: string; title: string; source: string; rawMarkdown: string; fields: Record<string, string>; sections: Record<string, string>; status: string; goal: string; scope: string; dependencies: string; acceptanceCriteria: string; risks: string; allowed: string; forbidden: string };
export type FormalWorkPackageValidationError={code:string;severity:'AUTO_REMEDIATE'|'WARN'|'HARD_BLOCK';message:string;nextAction?:string};
export type RepositoryModel = { repository: string; branch: string; head: string; localMain: string; remoteMain: string; worktree: 'CLEAN' | 'DIRTY' | 'UNAVAILABLE'; lastCommit: string };
export type LocalServiceStatus = { processRunning: boolean; serviceHealthy: boolean; repositoryAvailable: boolean; codexAvailable: boolean; port: number; binding: '127.0.0.1'; portOwner?: 'CANONICAL_AICC_SERVICE'|'FOREIGN_PROCESS'|'UNAVAILABLE'; conflict?: { pid: string; command: string } };
export type Authorization = { authorizationId: string; workPackageId: string; authoritySha: string; branch: string; headShaAtAuthorization: string; repositoryRoot: string; scope: string[]; allowed: string[]; forbidden: string[]; authorizedAt: string; supersededAt?: string; status?: 'ACTIVE'|'SUPERSEDED' };
export type AuthorizationTransitionSafety = { activeRuntime: boolean; writerLockHeld: boolean };
const AUTH_FILE = join(homedir(), '.aicc-v2', 'authorization.json'); const AUTH_HISTORY_FILE = join(homedir(), '.aicc-v2', 'authorization-history.json');
function atomicWriteJson(path:string,value:unknown){const tmp=`${path}.${process.pid}.tmp`;writeFileSync(tmp,JSON.stringify(value,null,2),{mode:0o600});renameSync(tmp,path)}
export type EntityDescriptionRecord={repositoryKey:string;entityType:'milestone'|'work_package'|'pull_request';entityId:string;description:string;updatedAt:string;updatedBy:'owner'};
const DESCRIPTION_FILE=join(homedir(),'.aicc-v2','entity-descriptions.json');
export function readEntityDescriptions():EntityDescriptionRecord[]{try{return JSON.parse(readFileSync(DESCRIPTION_FILE,'utf8')) as EntityDescriptionRecord[]}catch{return []}}
function writeEntityDescriptions(records:EntityDescriptionRecord[]){mkdirSync(join(homedir(),'.aicc-v2'),{recursive:true});const tmp=`${DESCRIPTION_FILE}.${process.pid}.tmp`;writeFileSync(tmp,JSON.stringify(records,null,2),{mode:0o600});renameSync(tmp,DESCRIPTION_FILE)}
export function upsertEntityDescription(record:Omit<EntityDescriptionRecord,'updatedAt'|'updatedBy'>){const next=readEntityDescriptions().filter(item=>!(item.repositoryKey===record.repositoryKey&&item.entityType===record.entityType&&item.entityId===record.entityId));next.push({...record,updatedAt:new Date().toISOString(),updatedBy:'owner'});writeEntityDescriptions(next);return next.at(-1)!}
export function clearEntityDescription(repositoryKey:string,entityType:EntityDescriptionRecord['entityType'],entityId:string){writeEntityDescriptions(readEntityDescriptions().filter(item=>!(item.repositoryKey===repositoryKey&&item.entityType===entityType&&item.entityId===entityId)))}
import type {HumanUatRecord,LifecycleEvidenceRecord} from './model/entityTypes.ts';
const HUMAN_UAT_FILE=join(homedir(),'.aicc-v2','human-uat.json');
export function readHumanUatRecords():HumanUatRecord[]{try{return JSON.parse(readFileSync(HUMAN_UAT_FILE,'utf8')) as HumanUatRecord[]}catch{return []}}
export function readHumanUat(repository:string,workPackageId:string):HumanUatRecord|null{return readHumanUatRecords().find(item=>item.repository===repository&&item.entityType==='work_package'&&item.workPackageId===workPackageId)??null}
export function writeHumanUat(record:HumanUatRecord):HumanUatRecord{const records=readHumanUatRecords().filter(item=>!(item.repository===record.repository&&item.entityType==='work_package'&&item.workPackageId===record.workPackageId));mkdirSync(join(homedir(),'.aicc-v2'),{recursive:true});atomicWriteJson(HUMAN_UAT_FILE,[...records,record]);return record}
const LIFECYCLE_EVIDENCE_FILE=join(homedir(),'.aicc-v2','lifecycle-evidence.json');
export function readLifecycleEvidenceRecords():LifecycleEvidenceRecord[]{try{return JSON.parse(readFileSync(LIFECYCLE_EVIDENCE_FILE,'utf8')) as LifecycleEvidenceRecord[]}catch{return []}}
export function readLifecycleEvidence(repository:string,workPackageId:string):LifecycleEvidenceRecord|null{return readLifecycleEvidenceRecords().find(item=>item.repository===repository&&item.workPackageId===workPackageId)??null}
export function writeLifecycleEvidence(record:LifecycleEvidenceRecord):LifecycleEvidenceRecord{const records=readLifecycleEvidenceRecords().filter(item=>!(item.repository===record.repository&&item.workPackageId===record.workPackageId));mkdirSync(join(homedir(),'.aicc-v2'),{recursive:true});atomicWriteJson(LIFECYCLE_EVIDENCE_FILE,[...records,record]);return record}

export function validWorkPackageId(id: string): boolean { return /^AICC-[A-Z0-9]+(?:-[A-Z0-9]+)*$/.test(id) && !id.includes('..') && !id.includes('/') && !id.includes('\\'); }
export function readRoadmap(): string { return readFileSync(ROADMAP, 'utf8'); }
export function readWorkPackage(id: string): WorkPackage {
  if (!validWorkPackageId(id)) throw new Error('WP_INVALID_ID');
  const source = join(WORK_PACKAGES, `${id}.md`);
  const text = readFileSync(source, 'utf8');
  const heading = text.match(/^#\s+(.+)$/m)?.[1] ?? id;
  const fields: Record<string, string> = {};
  for (const line of text.split('\n')) { const match = line.match(/^(?:\*\*)?([^:*]+?)(?:\*\*)?:\s*(.+)$/); if (match) fields[match[1].trim()] = match[2].trim().replace(/^`|`$/g, ''); }
  const sections: Record<string, string> = {};
  let section = ''; for (const line of text.split('\n')) { const headingMatch = line.match(/^##\s+(.+?)\s*$/); if (headingMatch) { section = headingMatch[1].trim(); sections[section] = ''; } else if (section) sections[section] += `${sections[section] ? '\n' : ''}${line}`; }
  for (const key of Object.keys(sections)) sections[key] = sections[key].trim();
  const pick = (...keys: string[]) => keys.map((key) => sections[key] ?? fields[key]).find((value) => value?.trim())?.trim() ?? '';
  const goal = pick('Goal', '目标'), scope = pick('Scope', '范围'), dependencies = pick('Dependencies', '依赖'), acceptanceCriteria = pick('Acceptance Criteria', '验收标准', 'Machine Acceptance', '机器验收'), risks = pick('Risks', '风险'), allowed = pick('Allowed', '允许'), forbidden = pick('Forbidden', '禁止');
  sections.Goal = goal; sections.Scope = scope; sections.Dependencies = dependencies; sections['Acceptance Criteria'] = acceptanceCriteria;
  return { id, title: heading.replace(/^AICC-[^:：]+[:：]\s*/, ''), source: `docs/60_Operations/work-packages/${id}.md`, rawMarkdown: text, fields, sections, status: fields.Status ?? fields.status ?? '未提供', goal, scope, dependencies, acceptanceCriteria, risks, allowed, forbidden };
}
export function validateFormalWorkPackage(workPackage:WorkPackage,requestedId=workPackage.id):FormalWorkPackageValidationError[]{
  const errors:FormalWorkPackageValidationError[]=[];
  if(workPackage.id!==requestedId)errors.push({code:'WP_ID_MISMATCH',severity:'HARD_BLOCK',message:'正式 Work Package 标识与选择项不一致。',nextAction:'刷新状态后重新选择该 Work Package。'});
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
export function readLocalServiceStatus(healthProbe:()=>boolean): LocalServiceStatus {
  const repositoryAvailable=existsSync(REPOSITORY_ROOT)&&existsSync(join(REPOSITORY_ROOT,'package.json'))&&existsSync(ROADMAP);
  // The service must not synchronously ask launchd to inspect itself from an HTTP request.
  // The running Vite process is the local service process; launchd status is exposed by
  // the supervisor script and the health endpoint remains non-blocking.
  const processRunning=true;
  // Port ownership is enforced by Vite's strictPort setting. Keep the health
  // request free of synchronous process inspection so it remains responsive.
  return {processRunning,serviceHealthy:healthProbe(),repositoryAvailable,codexAvailable:existsSync('/usr/local/bin/codex')||existsSync('/opt/homebrew/bin/codex'),port:1420,binding:'127.0.0.1'};
}
export function detectPortOwner(healthProbe:()=>boolean=()=>true): Pick<LocalServiceStatus,'portOwner'|'conflict'> {
  try { const pid=execFileSync('/usr/sbin/lsof',['-nP','-iTCP:1420','-sTCP:LISTEN','-t'],{encoding:'utf8'}).trim().split(/\s+/)[0]; if(!pid)return {portOwner:'UNAVAILABLE'}; const command=safeProcessCommand(pid); const cwd=(()=>{try{return execFileSync('/usr/sbin/lsof',['-a','-p',pid,'-d','cwd','-Fn'],{encoding:'utf8'}).split('\n').find(x=>x.startsWith('n'))?.slice(1)??''}catch{return ''}})(); const canonical=healthProbe()&&((pid===String(process.pid)&&repositoryAvailableForService())||(cwd===REPOSITORY_ROOT&&/npm|node|vite/.test(command))); return canonical?{portOwner:'CANONICAL_AICC_SERVICE'}:{portOwner:'FOREIGN_PROCESS',conflict:{pid,command}}; } catch { return {portOwner:'UNAVAILABLE'}; }
}
function repositoryAvailableForService(){return existsSync(REPOSITORY_ROOT)&&existsSync(join(REPOSITORY_ROOT,'package.json'))&&existsSync(ROADMAP)}
function safeProcessCommand(pid:string){try{return execFileSync('/bin/ps',['-p',pid,'-o','command='],{encoding:'utf8'}).trim().slice(0,240)}catch{return 'unavailable'}}
export function restartLocalService(){ if(!process.getuid)throw new Error('SUPERVISOR_UNAVAILABLE'); execFile('/bin/launchctl',['kickstart','-k',`gui/${process.getuid()}/${LOCAL_SERVICE_LABEL}`],()=>{}); return 'RESTART_REQUESTED'; }
export function stopLocalService(){ if(!process.getuid)throw new Error('SUPERVISOR_UNAVAILABLE'); execFile('/bin/launchctl',['kill','SIGTERM',`gui/${process.getuid()}/${LOCAL_SERVICE_LABEL}`],()=>{}); return 'STOP_REQUESTED'; }
export function readLocalServiceLogs(){const base=join(homedir(),'Library/Logs/AICC');const read=(name:string)=>{try{return readFileSync(join(base,name),'utf8').slice(-12000)}catch{return '日志不可用'}};return {stdout:read('local-service.stdout.log'),stderr:read('local-service.stderr.log')};}
export function readRepository(): RepositoryModel {
  const head = safeGit(['rev-parse', 'HEAD']);
  const branch = safeGit(['branch', '--show-current']);
  const localMain = safeGit(['rev-parse', 'refs/heads/main']);
  // Snapshot reads must remain local and bounded. Network refresh belongs to
  // the explicit Safe Main Sync operation; a stalled remote must never freeze
  // the local control service or its health endpoint.
  const remoteMain = safeGit(['rev-parse', 'refs/remotes/origin/main']);
  return { repository: REPOSITORY_ROOT, branch, head, localMain, remoteMain, worktree: safeGit(['status', '--porcelain']) === '' ? 'CLEAN' : 'DIRTY', lastCommit: safeGit(['log', '-1', '--format=%h %s']) };
}
export function readAuthorization(): Authorization | null { try { const record = JSON.parse(readFileSync(AUTH_FILE, 'utf8')) as Authorization; return record.status === 'SUPERSEDED' ? null : record; } catch { return null; } }
export function readAuthorizationHistory(): Authorization[] { try { return JSON.parse(readFileSync(AUTH_HISTORY_FILE, 'utf8')) as Authorization[]; } catch { return []; } }
function readStoredAuthorization(): Authorization | null { try { return JSON.parse(readFileSync(AUTH_FILE, 'utf8')) as Authorization; } catch { return null; } }
function readAuthorizationTransitionSafety(): AuthorizationTransitionSafety {
  let activeRuntime = false;
  try { const runtime = JSON.parse(readFileSync(join(homedir(), '.aicc-v2', 'runtime.json'), 'utf8')) as { phase?: string }; activeRuntime = ['STARTING', 'RUNNING', 'STOPPING'].includes(runtime.phase ?? ''); } catch { /* no runtime evidence */ }
  return { activeRuntime, writerLockHeld: existsSync(join(homedir(), '.aicc-v2', 'writer.lock')) };
}
export function authorizationSupersessionBlocker(id: string, repo: RepositoryModel, existing: Authorization | null, safety: AuthorizationTransitionSafety,preflight?:ExecutionPreflight): string | null {
  const base = authorizationBlocker(id, repo, true,preflight);
  if (base && base !== 'AUTHORIZATION_CONFLICT') return base;
  if (safety.activeRuntime) return 'ACTIVE_RUNTIME_CONFLICT';
  if (safety.writerLockHeld) return 'WRITER_LOCK_HELD';
  if (existing && existing.repositoryRoot !== repo.repository) return 'AUTHORIZATION_REPOSITORY_MISMATCH';
  if (existing && existing.branch !== repo.branch) return 'AUTHORIZATION_BRANCH_MISMATCH';
  if (existing && existing.authoritySha !== repo.remoteMain) return 'AUTHORITY_DRIFT';
  return null;
}
export function authorizationState(id: string, repo: RepositoryModel): { status: 'AUTHORIZED' | 'INVALID' | 'UNAUTHORIZED'; record: Authorization | null; reason?: string } {
  const record = readAuthorization(); if (!record) return { status: 'UNAUTHORIZED', record: null };
  if (record.workPackageId !== id) return { status: 'INVALID', record, reason: 'WORK_PACKAGE_CHANGED' };
  if (record.branch !== repo.branch) return { status: 'INVALID', record, reason: 'BRANCH_CHANGED' };
  if (record.authoritySha !== repo.remoteMain) return { status: 'INVALID', record, reason: 'AUTHORITY_CHANGED' };
  if (record.repositoryRoot !== repo.repository) return { status: 'INVALID', record, reason: 'REPOSITORY_CHANGED' };
  return { status: 'AUTHORIZED', record };
}
export function authorizationBlocker(id: string, repo: RepositoryModel | null, wpExists: boolean,preflight?:ExecutionPreflight): string | null {
  if (!id) return 'NO_WORK_PACKAGE_SELECTED'; if (!wpExists) return 'WP_NOT_FOUND'; if (!repo) return 'REPOSITORY_UNAVAILABLE';
  if(repo.worktree==='DIRTY'&&!preflight)return 'WORKTREE_PROVENANCE_REQUIRED';if(preflight?.severity==='HARD_BLOCK')return 'UNKNOWN_OR_CONFLICTING_DIRTY';if (!repo.branch || repo.branch === 'unavailable') return 'DETACHED_HEAD'; if (repo.branch === 'main') return 'FEATURE_BRANCH_REQUIRED';
  if (!repo.remoteMain || repo.remoteMain.includes('unavailable')) return 'REMOTE_MAIN_UNAVAILABLE'; if (repo.localMain !== repo.remoteMain) return 'SYNC_REQUIRED';
  const state = authorizationState(id, repo); if (state.status === 'AUTHORIZED') return 'AUTHORIZATION_CONFLICT'; return null;
}
export function persistAuthorization(id: string, repo: RepositoryModel,preflight?:ExecutionPreflight): Authorization {
  const blocker = authorizationBlocker(id, repo, true,preflight); if (blocker) throw new Error(blocker);
  const record: Authorization = { authorizationId: `auth-${Date.now()}`, workPackageId: id, authoritySha: repo.remoteMain, branch: repo.branch, headShaAtAuthorization: repo.head, repositoryRoot: repo.repository, scope: ['read_repository', 'read_work_package', 'execute_work_package'], allowed: ['owner_confirmed_actions','codex_runtime','writer_lock'], forbidden: ['arbitrary_shell', 'push', 'merge'], authorizedAt: new Date().toISOString() };
  mkdirSync(join(homedir(), '.aicc-v2'), { recursive: true }); atomicWriteJson(AUTH_FILE,record); return record;
}
export function reauthorizeAuthorization(id: string, repo: RepositoryModel,preflight?:ExecutionPreflight): { record: Authorization; superseded: boolean } {
  if (!id) throw new Error('NO_WORK_PACKAGE_SELECTED');
  const existing = readStoredAuthorization();
  const blocker = authorizationSupersessionBlocker(id, repo, existing, readAuthorizationTransitionSafety(),preflight);
  if (blocker) throw new Error(blocker);
  if (existing && existing.workPackageId===id&&existing.headShaAtAuthorization === repo.head&&existing.allowed.includes('codex_runtime')&&existing.allowed.includes('writer_lock')) return { record: existing, superseded: false };
  const record: Authorization = { authorizationId: `auth-${Date.now()}`, workPackageId: id, authoritySha: repo.remoteMain, branch: repo.branch, headShaAtAuthorization: repo.head, repositoryRoot: repo.repository, scope: ['read_repository', 'read_work_package', 'execute_work_package'], allowed: ['owner_confirmed_actions','codex_runtime','writer_lock'], forbidden: ['arbitrary_shell', 'push', 'merge'], authorizedAt: new Date().toISOString(), status: 'ACTIVE' };
  mkdirSync(join(homedir(), '.aicc-v2'), { recursive: true });
  if (existing) { const superseded = { ...existing, status: 'SUPERSEDED' as const, supersededAt: record.authorizedAt }; let history: Authorization[] = []; try { history = JSON.parse(readFileSync(AUTH_HISTORY_FILE, 'utf8')) as Authorization[]; } catch { /* no history yet */ } atomicWriteJson(AUTH_HISTORY_FILE,[...history, superseded]); }
  atomicWriteJson(AUTH_FILE,record); return { record, superseded: Boolean(existing) };
}
export function syncLocalMain(): 'ALREADY_SYNCED' | 'FAST_FORWARD' { const repo = readRepository(); if (repo.worktree !== 'CLEAN') throw new Error('WORKTREE_DIRTY'); if (repo.branch === 'main') throw new Error('MAIN_SYNC_REQUIRES_FEATURE_BRANCH'); git(['fetch', 'origin', 'main']); const remote = git(['rev-parse', 'refs/remotes/origin/main']); const local = safeGit(['rev-parse', 'refs/heads/main']); if (local === remote) return 'ALREADY_SYNCED'; try { execFileSync('git', ['merge-base', '--is-ancestor', local, remote], { cwd: REPOSITORY_ROOT, stdio: 'ignore' }); } catch { throw new Error('LOCAL_MAIN_DIVERGED'); } execFileSync('git', ['update-ref', 'refs/heads/main', remote, local], { cwd: REPOSITORY_ROOT, stdio: 'ignore' }); return 'FAST_FORWARD'; }
