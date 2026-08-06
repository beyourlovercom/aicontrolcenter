import { invoke } from '@tauri-apps/api/core';

export type AuthorityStatus = 'CHECKING' | 'VERIFIED' | 'DRIFT' | 'UNAVAILABLE';
export type ResolverDecision = 'START_ALLOWED' | 'BLOCKED';
export type Blocker = string;

export type RepositoryIdentity = {
  canonicalPath: string;
  repositoryValid: boolean;
  originPresent: boolean;
  originDisplay: string | null;
  currentBranch: string | null;
  localHead: string | null;
  localMainSha: string | null;
  worktreeClean: boolean;
  worktreeEntries: string[];
  detachedHead: boolean;
  checkedAt: string;
  diagnostics: string[];
};

export type RemoteAuthority = {
  status: 'VERIFIED' | 'DRIFT' | 'REMOTE_UNAVAILABLE' | 'REMOTE_INVALID_RESPONSE' | 'REPOSITORY_INVALID';
  remoteMainSha: string | null;
  authoritySha: string;
  checkedAt: string;
  diagnostics: string[];
};

export type WorkspaceEvaluation = { allowed: boolean; blockers: Blocker[]; plannedActions: string[] };
export type WorkPackage = { id: string; title: string; status: string; authoritySha: string; openspecChange: string; dependencies: { id: string; status: string }[]; previousRunStatus: string; ownerAuthorization: string };
export type ResolverResult = { decision: ResolverDecision; workPackage: WorkPackage | null; blockers: Blocker[] };
export type ControlLoopState = { identity: RepositoryIdentity | null; authority: RemoteAuthority | null; evaluation: WorkspaceEvaluation | null; resolver: ResolverResult | null; status: AuthorityStatus; error: string | null };

export const emptyState: ControlLoopState = { identity: null, authority: null, evaluation: null, resolver: null, status: 'CHECKING', error: null };

export function authorityStatus(status: RemoteAuthority['status'] | undefined): AuthorityStatus {
  if (status === 'VERIFIED') return 'VERIFIED';
  if (status === 'DRIFT') return 'DRIFT';
  return 'UNAVAILABLE';
}

export function syncAllowed(evaluation: WorkspaceEvaluation | null): boolean { return evaluation?.allowed === true; }
export function resolverDecision(result: ResolverResult | null): ResolverDecision | 'UNKNOWN' { return result?.decision ?? 'UNKNOWN'; }
export function hasRuntimeStartAction(): boolean { return false; }

function inTauri(): boolean { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window; }

export async function loadControlLoop(): Promise<ControlLoopState> {
  if (!inTauri()) return { ...emptyState, status: 'UNAVAILABLE', error: 'Tauri runtime unavailable' };
  try {
    const guards = { activeOpenCodeRun: false, writerLockHeld: false, unsavedDiff: false, previousRunOpen: false };
    const [identity, authority, evaluation, resolver] = await Promise.all([
      invoke<RepositoryIdentity>('read_repository_identity'),
      invoke<RemoteAuthority>('check_remote_authority'),
      invoke<WorkspaceEvaluation>('evaluate_workspace_sync'),
      invoke<ResolverResult>('resolve_next_work_package')
    ]);
    return { identity, authority, evaluation, resolver, status: authorityStatus(authority.status), error: null };
  } catch (error) {
    return { ...emptyState, status: 'UNAVAILABLE', error: error instanceof Error ? error.message : String(error) };
  }
}

export async function syncWorkspace(): Promise<void> {
  if (!inTauri()) throw new Error('Tauri runtime unavailable');
  const guards = { activeOpenCodeRun: false, writerLockHeld: false, unsavedDiff: false, previousRunOpen: false };
  await invoke('sync_workspace', { confirmed: true });
}
