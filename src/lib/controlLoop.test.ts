import { authorityStatus, cancelSync, createCodexRuntimePoller, hasRuntimeStartAction, ownerBlocker, repositoryStatusEvidence, requestSync, resolverDecision, runtimePhaseCopy, runtimeSupportsControl, shortSha, shouldPollCodexRuntime, syncAllowed, syncOutcome, syncState, type CodexRuntimeObserver, type CodexRuntimePhase, type ControlLoopState, type RoadmapMilestone } from './controlLoop.ts';
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
  engine: 'Codex App Server', profile: 'sol', processId: 4242, processState: 'RUNNING', sessionId: 'session-1', threadId: 'thread-1', turnId: 'turn-1', activeWorkPackage: 'AICC-CODEX-ONLY-MIGRATION-001', sessionState: 'RUNNING', branch: 'feature/aicc-codex-only-migration', worktree: '/repo', currentPhase: 'RUNNING', lastActivity: '1', currentEvent: 'turn/started', currentTask: 'implementation', testState: 'UNKNOWN', reviewState: 'UNKNOWN', pullRequest: null, ciState: 'UNKNOWN', blocker: null, failure: null, exitStatus: null, activeRun: true, writerLockHeld: true, nextAction: 'OBSERVE_CODEX_SESSION', stopAfterCurrentStep: false, supportedControls: ['START', 'RETRY']
};
assert(codexRuntime.engine === 'Codex App Server' && codexRuntime.profile === 'sol', 'managed App Server runtime contract is represented');
assert(runtimePhaseCopy(codexRuntime.currentPhase) === '运行中', 'runtime state is Owner-readable');
assert(runtimeSupportsControl(codexRuntime, 'START'), 'supported controls come from runtime evidence');
assert(!runtimeSupportsControl(codexRuntime, 'PAUSE') && !runtimeSupportsControl(codexRuntime, 'RESUME') && !runtimeSupportsControl(codexRuntime, 'STOP_AFTER_CURRENT_STEP'), 'unsupported controls cannot be presented as available');
assert(appSource.includes('授权本工作包') && appSource.includes('Codex 运行观察'), 'Owner UI exposes authorization and Codex observer');
for (const evidence of ['codexRuntime?.processId', 'codexRuntime?.sessionId', 'codexRuntime?.threadId', 'codexRuntime?.turnId', 'codexRuntime.writerLockHeld', 'codexRuntime?.exitStatus', 'codexRuntime?.failure']) {
  assert(appSource.includes(evidence), `runtime UI binds live evidence: ${evidence}`);
}
for (const fakeStatus of ['Codex CLI 未启动', '无绑定会话', 'Writer Lock NOT HELD', '无活动运行']) {
  assert(!appSource.includes(fakeStatus), `runtime UI removes hardcoded status: ${fakeStatus}`);
}
assert(appSource.includes('UNSUPPORTED_CONTROL') && appSource.includes('runtimeSupportsControl'), 'unsupported controls are visibly disabled');
assert(!appSource.includes('OmO Slim') && !appSource.includes('OpenCode'), 'active Owner UI has no obsolete execution architecture');

const activePhases: CodexRuntimePhase[] = ['STARTING', 'RUNNING', 'TESTING', 'REVIEWING', 'PR_OPEN', 'CI_RUNNING', 'MERGING', 'BUILDING_UAT'];
const inactivePhases: CodexRuntimePhase[] = ['IDLE', 'READY_FOR_HUMAN_UAT', 'FAILED', 'BLOCKED', 'WAITING_OWNER_AUTHORIZATION', 'PAUSED'];
assert(activePhases.every(shouldPollCodexRuntime), 'all active and transitional runtime phases enable polling');
assert(inactivePhases.every((phase) => !shouldPollCodexRuntime(phase)), 'terminal and non-active runtime phases stop polling');

function createFakeScheduler() {
  const callbacks = new Map<number, () => void>();
  const delays: number[] = [];
  let nextHandle = 1;
  return {
    schedule(callback: () => void, delay: number) {
      const handle = nextHandle++;
      callbacks.set(handle, callback);
      delays.push(delay);
      return handle;
    },
    cancel(handle: unknown) {
      callbacks.delete(handle as number);
    },
    runNext() {
      const pending = callbacks.entries().next().value as [number, () => void] | undefined;
      assert(pending, 'a scheduled runtime observation is available');
      callbacks.delete(pending[0]);
      pending[1]();
    },
    pending: () => callbacks.size,
    delays
  };
}

const freshRuntime: CodexRuntimeObserver = {
  ...codexRuntime,
  processId: 5252,
  threadId: 'thread-2',
  turnId: 'turn-2',
  lastActivity: '2',
  currentEvent: 'item/updated',
  currentTask: 'focused runtime polling'
};
const terminalRuntime: CodexRuntimeObserver = {
  ...freshRuntime,
  processId: null,
  processState: 'EXITED',
  sessionState: 'READY_FOR_HUMAN_UAT',
  currentPhase: 'READY_FOR_HUMAN_UAT',
  activeRun: false,
  writerLockHeld: false,
  exitStatus: '0',
  nextAction: 'BEGIN_HUMAN_UAT'
};
const scheduler = createFakeScheduler();
const observedRuntimes: CodexRuntimeObserver[] = [];
const runtimeReads = [freshRuntime, terminalRuntime];
const poller = createCodexRuntimePoller({
  read: async () => {
    const runtime = runtimeReads.shift();
    assert(runtime, 'fresh runtime evidence is available');
    return runtime;
  },
  onRuntime: (runtime) => observedRuntimes.push(runtime),
  onError: (message) => { throw new Error(`unexpected runtime observation failure: ${message}`); },
  schedule: scheduler.schedule,
  cancel: scheduler.cancel
});
poller.start(codexRuntime);
poller.start(codexRuntime);
assert(scheduler.pending() === 1, 'repeated active starts never create duplicate polling loops');
assert(scheduler.delays[0] === 1_000, 'runtime polling uses the focused one-second interval');
scheduler.runNext();
await new Promise<void>((resolve) => setImmediate(resolve));
assert(observedRuntimes[0]?.processId === 5252 && observedRuntimes[0]?.currentEvent === 'item/updated' && observedRuntimes[0]?.currentTask === 'focused runtime polling', 'polling publishes fresh runtime evidence');
assert(scheduler.pending() === 1, 'active fresh evidence schedules the next focused observation');
scheduler.runNext();
await new Promise<void>((resolve) => setImmediate(resolve));
assert(observedRuntimes[1]?.currentPhase === 'READY_FOR_HUMAN_UAT', 'terminal fresh evidence is published before polling stops');
assert(!poller.isPolling() && scheduler.pending() === 0, 'terminal runtime evidence stops active polling');

const errorScheduler = createFakeScheduler();
let observationError = '';
let fabricatedUpdates = 0;
const failingPoller = createCodexRuntimePoller({
  read: async () => { throw new Error('APP_SERVER_CHANNEL_CLOSED'); },
  onRuntime: () => { fabricatedUpdates += 1; },
  onError: (message) => { observationError = message; },
  schedule: errorScheduler.schedule,
  cancel: errorScheduler.cancel
});
failingPoller.start(codexRuntime);
errorScheduler.runNext();
await new Promise<void>((resolve) => setImmediate(resolve));
assert(observationError === 'APP_SERVER_CHANNEL_CLOSED', 'runtime observation exposes the original read failure');
assert(fabricatedUpdates === 0, 'runtime observation failures never fabricate runtime evidence');
assert(!failingPoller.isPolling() && errorScheduler.pending() === 0, 'runtime observation failure stops active polling');

assert(appSource.includes('readCodexRuntime') && appSource.includes('createCodexRuntimePoller'), 'Owner UI uses the focused runtime observer instead of full refresh polling');
assert(appSource.includes('onDestroy(() => runtimePoller.stop())'), 'component teardown stops runtime polling');
assert(appSource.includes('controlLoop = { ...controlLoop, codexRuntime: runtime }'), 'fresh observations update only Codex runtime state');
assert(appSource.includes('Runtime 观察失败：') && appSource.includes('runtimeObservationError'), 'runtime observation error is visibly and truthfully rendered');

console.log('control loop frontend contract tests passed');
