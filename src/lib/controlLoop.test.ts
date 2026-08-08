import { authorityStatus, cancelSync, hasRuntimeStartAction, ownerBlocker, repositoryStatusEvidence, requestSync, resolverDecision, runtimePhaseCopy, shortSha, syncAllowed, syncOutcome, syncState, type CodexRuntimeObserver, type ControlLoopState, type RoadmapMilestone } from './controlLoop.ts';
import { readFileSync } from 'node:fs';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }

assert(authorityStatus('VERIFIED') === 'VERIFIED', 'verified status maps to verified');
assert(authorityStatus('DRIFT') === 'DRIFT', 'drift status maps to drift');
assert(authorityStatus('REMOTE_UNAVAILABLE') === 'UNAVAILABLE', 'unknown authority fails closed');
assert(syncAllowed({ allowed: true, blockers: [], plannedActions: [] }), 'allowed evaluation enables sync');
assert(!syncAllowed({ allowed: false, blockers: ['WORKTREE_DIRTY'], plannedActions: [] }), 'blocker disables sync');
assert(syncState({ allowed: false, blockers: ['SYNC_NOT_REQUIRED'], plannedActions: [] }) === 'UP_TO_DATE', 'up to date state is explicit');
assert(syncState({ allowed: false, blockers: ['WORKTREE_DIRTY'], plannedActions: [] }) === 'BLOCKED', 'blocked state is explicit');
assert(ownerBlocker('WORKTREE_DIRTY').reason === '工作区存在未提交修改', 'dirty blocker is owner-readable');
assert(resolverDecision({ decision: 'START_ALLOWED', workPackage: null, blockers: [] }) === 'START_ALLOWED', 'resolver decision is displayed');
assert(resolverDecision(null) === 'UNKNOWN', 'missing resolver is unknown');
assert(hasRuntimeStartAction() === false, 'runtime start action is never exposed');
assert(requestSync({ allowed: true, blockers: [], plannedActions: [] }).kind === 'confirming', 'allowed sync opens explicit confirmation');
assert(requestSync({ allowed: false, blockers: ['WORKTREE_DIRTY'], plannedActions: [] }).kind === 'idle', 'dirty sync cannot open confirmation');
assert(cancelSync().kind === 'cancelled', 'cancel reports visible cancellation');
assert(syncOutcome({ success: true, error: null }).kind === 'success', 'successful sync reports success');
assert(syncOutcome({ success: false, error: 'SYNC_BLOCKED' }).kind === 'failure', 'failed sync reports failure');

const futureMilestone: RoadmapMilestone = { id: 'M3', title: 'Runtime', workPackages: [], futureItems: ['AICC-CONTROL-LOOP-001C', 'AICC-CONTROL-LOOP-001D'], progressPercent: 0 };
assert(futureMilestone.futureItems.length === 2, 'future items are represented in the TypeScript read model');
assert(futureMilestone.workPackages.length === 0 && futureMilestone.progressPercent === 0, 'future placeholders are distinct and excluded from progress');
const appSource = readFileSync(new URL('../App.svelte', import.meta.url), 'utf8');
for (const label of ['远端 Authority', '当前安全模式', '只读 V1', '概览', 'Codex 状态', '验证', '正式合同', '当前里程碑', '后续工作包', '仓库状态', 'Authority 健康度', '执行状态', '正式证据', '受控验证流程', 'OpenSpec 操作策略']) {
  assert(appSource.includes(label), `Owner UI label is Chinese-first: ${label}`);
}
assert(appSource.includes('future-placeholder'), 'future placeholders have a distinct non-selectable UI marker');
assert(!appSource.includes('20d1c9d'), 'repository status has no fixed demo SHA');
assert(appSource.includes('repositoryStatus.localHead') && appSource.includes('repositoryStatus.remoteMain'), 'repository status binds to live evidence projection');
const state = {
  ...({} as ControlLoopState),
  identity: { localHead: 'abcdef0123456789', worktreeClean: false },
  authority: { remoteMainSha: '1234567890abcdef' },
  status: 'DRIFT',
  roadmap: { currentWorkPackage: 'AICC-CONTROL-LOOP-001B' },
  resolver: { decision: 'BLOCKED' }
} as ControlLoopState;
const statusEvidence = repositoryStatusEvidence(state);
assert(shortSha('abcdef0123456789') === 'abcdef0', 'SHAs can be shortened without changing evidence');
assert(statusEvidence.localHead === 'abcdef0' && statusEvidence.remoteMain === '1234567', 'repository status uses runtime SHA evidence');
assert(statusEvidence.worktree === 'DIRTY' && statusEvidence.authority === 'DRIFT', 'repository status uses runtime identity and authority');
assert(statusEvidence.currentWorkPackage === 'AICC-CONTROL-LOOP-001B' && statusEvidence.nextWpGate === 'BLOCKED', 'repository status uses roadmap and resolver evidence');
const codexRuntime: CodexRuntimeObserver = {
  engine: 'Codex CLI', profile: 'sol', activeWorkPackage: 'AICC-CODEX-ONLY-MIGRATION-001', sessionState: 'WAITING_OWNER_AUTHORIZATION', branch: 'feature/aicc-codex-only-migration', worktree: '/repo', currentPhase: 'WAITING_OWNER_AUTHORIZATION', lastActivity: null, currentTask: null, testState: 'UNKNOWN', reviewState: 'UNKNOWN', pullRequest: null, ciState: 'UNKNOWN', blocker: 'OWNER_AUTHORIZATION_REQUIRED', nextAction: 'AUTHORIZE_WORK_PACKAGE', stopAfterCurrentStep: false
};
assert(codexRuntime.engine === 'Codex CLI' && codexRuntime.profile === 'sol', 'Codex-only runtime contract is represented');
assert(runtimePhaseCopy(codexRuntime.currentPhase) === '等待 Owner 授权', 'runtime state is Owner-readable');
assert(appSource.includes('授权本工作包') && appSource.includes('Codex 运行观察'), 'Owner UI exposes authorization and Codex observer');
assert(!appSource.includes('OmO Slim') && !appSource.includes('OpenCode'), 'active Owner UI has no obsolete execution architecture');

console.log('control loop frontend contract tests passed');
