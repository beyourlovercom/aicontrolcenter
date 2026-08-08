import { invoke } from '@tauri-apps/api/core';

export type AuthorityStatus = 'CHECKING' | 'VERIFIED' | 'DRIFT' | 'UNAVAILABLE';
export type ResolverDecision = 'START_ALLOWED' | 'BLOCKED';
export type Blocker = string;
export type CodexRuntimePhase = 'IDLE' | 'WAITING_OWNER_AUTHORIZATION' | 'STARTING' | 'RUNNING' | 'TESTING' | 'REVIEWING' | 'PR_OPEN' | 'CI_RUNNING' | 'MERGING' | 'BUILDING_UAT' | 'READY_FOR_HUMAN_UAT' | 'BLOCKED' | 'FAILED' | 'PAUSED';
export type CodexControlAction = 'START' | 'PAUSE' | 'RESUME' | 'STOP_AFTER_CURRENT_STEP' | 'RETRY';

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

export type WorkspaceEvaluation = { allowed: boolean; blockers: Blocker[]; plannedActions: string[]; state?: 'UP_TO_DATE' | 'SYNC_REQUIRED' | 'BLOCKED' };
export type WorkPackage = { id: string; title: string; status: string; authoritySha: string; openspecChange: string; dependencies: { id: string; status: string }[]; previousRunStatus: string; ownerAuthorization: string };
export type ResolverResult = { decision: ResolverDecision; workPackage: WorkPackage | null; blockers: Blocker[] };
export type RoadmapEntry = { id: string; title: string; status: string; authorization: string; milestone?: string };
export type RoadmapMilestone = { id: string; title: string; workPackages: string[]; futureItems: string[]; progressPercent: number };
export type RoadmapEvidence = { project: string; currentMilestone: string; authoritySha: string; currentWorkPackage: string; closedWorkPackages: string[]; nextWorkPackages: string[]; progressPercent: number; milestones: RoadmapMilestone[]; entries: RoadmapEntry[] };
export type OwnerAuthorizationRecord = { workPackageId: string; authoritySha: string; branch: string; worktree: string; scope: string; allowedCapabilities: string[]; forbiddenCapabilities: string[]; authorizedAt: string };
export type OwnerAuthorizationEvidence = { status: 'NOT_AUTHORIZED' | 'AUTHORIZED_FOR_IMPLEMENTATION' | 'START_ALLOWED'; valid: boolean; blocker: string | null; record: OwnerAuthorizationRecord | null };
export type CodexRuntimeObserver = { engine: 'Codex CLI'; profile: 'sol'; activeWorkPackage: string | null; sessionState: CodexRuntimePhase; branch: string | null; worktree: string | null; currentPhase: CodexRuntimePhase; lastActivity: string | null; currentTask: string | null; testState: string; reviewState: string; pullRequest: string | null; ciState: string; blocker: string | null; nextAction: string; stopAfterCurrentStep: boolean };
export type ControlLoopState = { identity: RepositoryIdentity | null; authority: RemoteAuthority | null; evaluation: WorkspaceEvaluation | null; resolver: ResolverResult | null; roadmap: RoadmapEvidence | null; authorization: OwnerAuthorizationEvidence | null; codexRuntime: CodexRuntimeObserver | null; status: AuthorityStatus; error: string | null };

export type RepositoryStatusEvidence = {
  localHead: string;
  remoteMain: string;
  worktree: 'CLEAN' | 'DIRTY' | 'UNKNOWN';
  authority: AuthorityStatus;
  currentWorkPackage: string;
  nextWpGate: ResolverDecision | 'UNKNOWN';
};

export const emptyState: ControlLoopState = { identity: null, authority: null, evaluation: null, resolver: null, roadmap: null, authorization: null, codexRuntime: null, status: 'CHECKING', error: null };

export type SyncState =
  | { kind: 'idle' }
  | { kind: 'confirming' }
  | { kind: 'loading' }
  | { kind: 'success'; message: string }
  | { kind: 'failure'; message: string }
  | { kind: 'cancelled'; message: string };

export const idleSyncState: SyncState = { kind: 'idle' };

export function requestSync(evaluation: WorkspaceEvaluation | null): SyncState {
  return syncAllowed(evaluation) ? { kind: 'confirming' } : idleSyncState;
}

export function cancelSync(): SyncState {
  return { kind: 'cancelled', message: '同步已取消；未执行任何仓库操作。' };
}

export function syncOutcome(result: { success: boolean; error: string | null }): SyncState {
  return result.success
    ? { kind: 'success', message: '本地 main 已同步；正在重新验证状态。' }
    : { kind: 'failure', message: result.error ?? '同步失败。' };
}

export function authorityStatus(status: RemoteAuthority['status'] | undefined): AuthorityStatus {
  if (status === 'VERIFIED') return 'VERIFIED';
  if (status === 'DRIFT') return 'DRIFT';
  return 'UNAVAILABLE';
}

export function syncAllowed(evaluation: WorkspaceEvaluation | null): boolean { return evaluation?.allowed === true; }
export function syncState(evaluation: WorkspaceEvaluation | null): 'UP_TO_DATE' | 'SYNC_REQUIRED' | 'BLOCKED' | 'UNKNOWN' {
  if (!evaluation) return 'UNKNOWN';
  if (evaluation.state) return evaluation.state;
  return evaluation.allowed ? 'SYNC_REQUIRED' : evaluation.blockers.includes('SYNC_NOT_REQUIRED') ? 'UP_TO_DATE' : 'BLOCKED';
}
export function ownerBlocker(blocker: string): { reason: string; nextStep: string } {
  const copy: Record<string, { reason: string; nextStep: string }> = {
    WORKTREE_DIRTY: { reason: '工作区存在未提交修改', nextStep: '提交或暂存修改后重新检查' },
    ACTIVE_RUN: { reason: '存在正在运行的任务', nextStep: '等待当前任务结束后重新检查' },
    WRITER_LOCKED: { reason: '写入锁已被占用', nextStep: '等待写入锁释放后重新检查' },
    UNSAVED_DIFF: { reason: '存在未保存差异', nextStep: '保存或清理差异后重新检查' },
    PREVIOUS_RUN_OPEN: { reason: '上一次运行仍未关闭', nextStep: '关闭上一运行后重新检查' },
    REMOTE_UNAVAILABLE: { reason: '远端 Authority 不可用', nextStep: '检查网络和 origin/main 后重试' },
    SYNC_REQUIRED: { reason: '远端 main 领先本地 main', nextStep: '确认后同步本地 main' },
    SYNC_NOT_REQUIRED: { reason: '本地 main 已是最新', nextStep: '无需同步' }
  };
  return copy[blocker] ?? { reason: '同步前置条件未满足', nextStep: '修复前置条件后重新检查' };
}
export function resolverDecision(result: ResolverResult | null): ResolverDecision | 'UNKNOWN' { return result?.decision ?? 'UNKNOWN'; }
export function hasRuntimeStartAction(): boolean { return false; }

export function runtimePhaseCopy(phase: CodexRuntimePhase): string {
  const copy: Record<CodexRuntimePhase, string> = {
    IDLE: '空闲', WAITING_OWNER_AUTHORIZATION: '等待 Owner 授权', STARTING: '启动中', RUNNING: '运行中', TESTING: '测试中', REVIEWING: '审查中', PR_OPEN: 'PR 已创建', CI_RUNNING: 'CI 运行中', MERGING: '合并中', BUILDING_UAT: '构建 UAT 中', READY_FOR_HUMAN_UAT: '准备 Human UAT', BLOCKED: '已阻塞', FAILED: '失败', PAUSED: '已暂停'
  };
  return copy[phase];
}

export function shortSha(sha: string | null | undefined): string {
  return sha ? sha.slice(0, 7) : 'UNKNOWN';
}

export function repositoryStatusEvidence(state: ControlLoopState): RepositoryStatusEvidence {
  return {
    localHead: shortSha(state.identity?.localHead),
    remoteMain: shortSha(state.authority?.remoteMainSha),
    worktree: state.identity ? (state.identity.worktreeClean ? 'CLEAN' : 'DIRTY') : 'UNKNOWN',
    authority: state.status,
    currentWorkPackage: state.roadmap?.currentWorkPackage ?? 'UNKNOWN',
    nextWpGate: resolverDecision(state.resolver)
  };
}

function inTauri(): boolean { return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window; }

export async function loadControlLoop(): Promise<ControlLoopState> {
  if (!inTauri()) return { ...emptyState, status: 'UNAVAILABLE', error: 'Tauri runtime unavailable' };
  try {
    const guards = { activeCodexRun: false, writerLockHeld: false, unsavedDiff: false, previousRunOpen: false };
    const [identity, authority, evaluation, resolver, roadmap, authorization, codexRuntime] = await Promise.all([
      invoke<RepositoryIdentity>('read_repository_identity'),
      invoke<RemoteAuthority>('check_remote_authority'),
      invoke<WorkspaceEvaluation>('evaluate_workspace_sync'),
      invoke<ResolverResult>('resolve_next_work_package'),
      invoke<RoadmapEvidence>('read_roadmap_evidence'),
      invoke<OwnerAuthorizationEvidence>('read_owner_authorization'),
      invoke<CodexRuntimeObserver>('read_codex_runtime')
    ]);
    return { identity, authority, evaluation, resolver, roadmap, authorization, codexRuntime, status: authorityStatus(authority.status), error: null };
  } catch (error) {
    return { ...emptyState, status: 'UNAVAILABLE', error: error instanceof Error ? error.message : String(error) };
  }
}

export async function syncWorkspace(): Promise<{ success: boolean; actions: string[]; error: string | null }> {
  if (!inTauri()) throw new Error('Tauri runtime unavailable');
  return invoke('sync_workspace', { confirmed: true });
}

export async function authorizeWorkPackage(workPackageId: string, confirmed: boolean): Promise<OwnerAuthorizationEvidence> {
  if (!inTauri()) throw new Error('Tauri runtime unavailable');
  return invoke('authorize_work_package', { workPackageId, confirmed });
}

export async function controlCodex(action: CodexControlAction): Promise<CodexRuntimeObserver> {
  if (!inTauri()) throw new Error('Tauri runtime unavailable');
  return invoke('control_codex', { action });
}
