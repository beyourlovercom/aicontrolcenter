import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { homedir } from 'node:os';

export const REPOSITORY_ROOT = '/Users/a/AI/007/AIcontrolcenter';
const ROADMAP = join(REPOSITORY_ROOT, 'docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md');
const WORK_PACKAGES = join(REPOSITORY_ROOT, 'docs/60_Operations/work-packages');

export type WorkPackage = { id: string; title: string; source: string; rawMarkdown: string; fields: Record<string, string>; sections: Record<string, string>; status: string; goal: string; scope: string; dependencies: string; acceptanceCriteria: string; risks: string; allowed: string; forbidden: string };
export type RepositoryModel = { repository: string; branch: string; head: string; localMain: string; remoteMain: string; worktree: 'CLEAN' | 'DIRTY' | 'UNAVAILABLE'; lastCommit: string };
export type Authorization = { authorizationId: string; workPackageId: string; authoritySha: string; branch: string; headShaAtAuthorization: string; repositoryRoot: string; scope: string[]; allowed: string[]; forbidden: string[]; authorizedAt: string; supersededAt?: string; status?: 'ACTIVE'|'SUPERSEDED' };
export type AuthorizationTransitionSafety = { activeRuntime: boolean; writerLockHeld: boolean };
const AUTH_FILE = join(homedir(), '.aicc-v2', 'authorization.json'); const AUTH_HISTORY_FILE = join(homedir(), '.aicc-v2', 'authorization-history.json');
export type EntityDescriptionRecord={repositoryKey:string;entityType:'milestone'|'work_package'|'pull_request';entityId:string;description:string;updatedAt:string;updatedBy:'owner'};
const DESCRIPTION_FILE=join(homedir(),'.aicc-v2','entity-descriptions.json');
export function readEntityDescriptions():EntityDescriptionRecord[]{try{return JSON.parse(readFileSync(DESCRIPTION_FILE,'utf8')) as EntityDescriptionRecord[]}catch{return []}}
function writeEntityDescriptions(records:EntityDescriptionRecord[]){mkdirSync(join(homedir(),'.aicc-v2'),{recursive:true});const tmp=`${DESCRIPTION_FILE}.${process.pid}.tmp`;writeFileSync(tmp,JSON.stringify(records,null,2),{mode:0o600});renameSync(tmp,DESCRIPTION_FILE)}
export function upsertEntityDescription(record:Omit<EntityDescriptionRecord,'updatedAt'|'updatedBy'>){const next=readEntityDescriptions().filter(item=>!(item.repositoryKey===record.repositoryKey&&item.entityType===record.entityType&&item.entityId===record.entityId));next.push({...record,updatedAt:new Date().toISOString(),updatedBy:'owner'});writeEntityDescriptions(next);return next.at(-1)!}
export function clearEntityDescription(repositoryKey:string,entityType:EntityDescriptionRecord['entityType'],entityId:string){writeEntityDescriptions(readEntityDescriptions().filter(item=>!(item.repositoryKey===repositoryKey&&item.entityType===entityType&&item.entityId===entityId)))}

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
  const goal = pick('Goal', '目标'), scope = pick('Scope', '范围'), dependencies = pick('Dependencies', '依赖'), acceptanceCriteria = pick('Acceptance Criteria', '验收标准'), risks = pick('Risks', '风险'), allowed = pick('Allowed', '允许'), forbidden = pick('Forbidden', '禁止');
  sections.Goal = goal; sections.Scope = scope; sections.Dependencies = dependencies; sections['Acceptance Criteria'] = acceptanceCriteria;
  return { id, title: heading.replace(/^AICC-[^:：]+[:：]\s*/, ''), source: `docs/60_Operations/work-packages/${id}.md`, rawMarkdown: text, fields, sections, status: fields.Status ?? fields.status ?? '未提供', goal, scope, dependencies, acceptanceCriteria, risks, allowed, forbidden };
}

function git(args: string[]): string { return execFileSync('git', args, { cwd: REPOSITORY_ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); }
function safeGit(args: string[]): string { try { return git(args); } catch { return 'unavailable'; } }
export function readRepository(): RepositoryModel {
  const head = safeGit(['rev-parse', 'HEAD']);
  const branch = safeGit(['branch', '--show-current']);
  const localMain = safeGit(['rev-parse', 'refs/heads/main']);
  let remoteMain = '读取失败 / unavailable';
  try { remoteMain = git(['ls-remote', 'origin', 'refs/heads/main']).split(/\s+/)[0] || remoteMain; } catch { /* remote access is optional and read-only */ }
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
export function authorizationSupersessionBlocker(id: string, repo: RepositoryModel, existing: Authorization | null, safety: AuthorizationTransitionSafety): string | null {
  const base = authorizationBlocker(id, repo, true);
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
export function authorizationBlocker(id: string, repo: RepositoryModel | null, wpExists: boolean): string | null {
  if (!id) return 'NO_WORK_PACKAGE_SELECTED'; if (!wpExists) return 'WP_NOT_FOUND'; if (!repo) return 'REPOSITORY_UNAVAILABLE';
  if (repo.worktree !== 'CLEAN') return 'WORKTREE_DIRTY'; if (!repo.branch || repo.branch === 'unavailable') return 'DETACHED_HEAD'; if (repo.branch === 'main') return 'FEATURE_BRANCH_REQUIRED';
  if (!repo.remoteMain || repo.remoteMain.includes('unavailable')) return 'REMOTE_MAIN_UNAVAILABLE'; if (repo.localMain !== repo.remoteMain) return 'SYNC_REQUIRED';
  const state = authorizationState(id, repo); if (state.status === 'AUTHORIZED') return 'AUTHORIZATION_CONFLICT'; return null;
}
export function persistAuthorization(id: string, repo: RepositoryModel): Authorization {
  const blocker = authorizationBlocker(id, repo, true); if (blocker) throw new Error(blocker);
  const record: Authorization = { authorizationId: `auth-${Date.now()}`, workPackageId: id, authoritySha: repo.remoteMain, branch: repo.branch, headShaAtAuthorization: repo.head, repositoryRoot: repo.repository, scope: ['read_repository', 'read_work_package', 'sync_local_main'], allowed: ['owner_confirmed_actions'], forbidden: ['codex_runtime', 'writer_lock', 'arbitrary_shell', 'push', 'merge'], authorizedAt: new Date().toISOString() };
  mkdirSync(join(homedir(), '.aicc-v2'), { recursive: true }); writeFileSync(AUTH_FILE, JSON.stringify(record, null, 2), { mode: 0o600 }); return record;
}
export function reauthorizeAuthorization(id: string, repo: RepositoryModel): { record: Authorization; superseded: boolean } {
  if (!id) throw new Error('NO_WORK_PACKAGE_SELECTED');
  const existing = readStoredAuthorization();
  const blocker = authorizationSupersessionBlocker(id, repo, existing, readAuthorizationTransitionSafety());
  if (blocker) throw new Error(blocker);
  if (existing && existing.headShaAtAuthorization === repo.head) return { record: existing, superseded: false };
  const record: Authorization = { authorizationId: `auth-${Date.now()}`, workPackageId: id, authoritySha: repo.remoteMain, branch: repo.branch, headShaAtAuthorization: repo.head, repositoryRoot: repo.repository, scope: ['read_repository', 'read_work_package', 'sync_local_main'], allowed: ['owner_confirmed_actions'], forbidden: ['codex_runtime', 'writer_lock', 'arbitrary_shell', 'push', 'merge'], authorizedAt: new Date().toISOString(), status: 'ACTIVE' };
  mkdirSync(join(homedir(), '.aicc-v2'), { recursive: true });
  if (existing) { const superseded = { ...existing, status: 'SUPERSEDED' as const, supersededAt: record.authorizedAt }; let history: Authorization[] = []; try { history = JSON.parse(readFileSync(AUTH_HISTORY_FILE, 'utf8')) as Authorization[]; } catch { /* no history yet */ } writeFileSync(AUTH_HISTORY_FILE, JSON.stringify([...history, superseded], null, 2), { mode: 0o600 }); }
  writeFileSync(AUTH_FILE, JSON.stringify(record, null, 2), { mode: 0o600 }); return { record, superseded: Boolean(existing) };
}
export function syncLocalMain(): 'ALREADY_SYNCED' | 'FAST_FORWARD' { const repo = readRepository(); if (repo.worktree !== 'CLEAN') throw new Error('WORKTREE_DIRTY'); if (repo.branch === 'main') throw new Error('MAIN_SYNC_REQUIRES_FEATURE_BRANCH'); git(['fetch', 'origin', 'main']); const remote = git(['rev-parse', 'refs/remotes/origin/main']); const local = safeGit(['rev-parse', 'refs/heads/main']); if (local === remote) return 'ALREADY_SYNCED'; try { execFileSync('git', ['merge-base', '--is-ancestor', local, remote], { cwd: REPOSITORY_ROOT, stdio: 'ignore' }); } catch { throw new Error('LOCAL_MAIN_DIVERGED'); } execFileSync('git', ['update-ref', 'refs/heads/main', remote, local], { cwd: REPOSITORY_ROOT, stdio: 'ignore' }); return 'FAST_FORWARD'; }
