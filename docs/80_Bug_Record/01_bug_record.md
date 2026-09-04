# AICC Bug Record

> Governance: `AICC_PARALLEL_BUG_GOVERNANCE_V1`
> Registry: `AICC_CANONICAL_BUG_REGISTRY_V1`
> Enforcement: `AICC_BUG_REGISTRY_ENFORCEMENT_V1`
> GitHub Persistence: `AICC_GPT_GITHUB_BUG_REGISTRY_V1`
> Status: FROZEN CANONICAL REGISTRY
> Purpose: Record bugs without unnecessarily interrupting active AICC development.

Every governed Codex development Run must reconcile newly discovered
non-blocking Bugs into this registry before completion.

Confirmed Bug records may be persisted directly by GPT to this canonical GitHub
Registry without starting Codex remediation.

## Governance

- P0: immediate interrupt.
- Blocking P1: interrupt current authorized scope.
- Non-blocking P1: record and continue unless explicitly reprioritized.
- P2: record and defer.
- P3: record and defer.
- UNTRIAGED: record only; do not invent severity.
- No opportunistic unrelated fixes.
- Deferred bugs remain visible until explicitly Closed.
- Final Project Bug Sweep is mandatory.
- AICC does not decide Bug severity.
- AICC decision authority remains zero.

## Open Bug Summary

| Bug ID | Severity | Status | Module | Title | Blocks Current Scope | Discovered At |
|---|---|---|---|---|---|---|
| AICC-BUG-001 | UNTRIAGED | Reported | Runtime Workspace test contract | Recovery-toast baseline assertion conflicts with current feedback baseline | UNKNOWN | 2026-08-20 |
| AICC-BUG-002 | UNTRIAGED | Reported | Runtime Workspace current activity projection | Completed Runtime can retain a live-process activity label | UNKNOWN | 2026-08-20 |
| AICC-BUG-003 | UNTRIAGED | Reported | Task/WP Roadmap binding test contract | Stale Milestone expectation is `M8` while canonical Roadmap binding is `M8.2` | UNKNOWN | 2026-08-20 |
| AICC-BUG-004 | UNTRIAGED | Reported | AICC Bridge feedback status projection | Completed run leaves Bridge status stale and does not expose GPT feedback delivery truth | UNKNOWN | 2026-08-20 |
| AICC-BUG-005 | UNTRIAGED | Reported | AICC Web Bridge action buttons | Buttons 5 and 6 do not insert/return results to GPT while button 3 succeeds | UNKNOWN | 2026-08-20 |
| AICC-BUG-006 | UNTRIAGED | Reported | Bridge execution metadata typing | Global Composer model-source value is omitted from the launch metadata union | UNKNOWN | 2026-08-20 |
| AICC-BUG-007 | UNTRIAGED | Reported | Vite execution launch metadata typing | `modelSource` is passed to a metadata type that does not declare it | UNKNOWN | 2026-08-20 |
| AICC-BUG-008 | UNTRIAGED | Reported | Global Task Inspector test contract | Stale selector assertion does not match the current Task Inspector layout | UNKNOWN | 2026-08-20 |
| AICC-BUG-009 | UNTRIAGED | Reported | Vite local-control health route | Synchronous unbounded subprocesses can block the Node HTTP event loop and time out `/api/health` | UNKNOWN | 2026-08-20 |
| AICC-BUG-010 | UNTRIAGED | Reported | Bridge canonical task scope propagation | Bridge submission calls task sync before injecting the active project scope, producing `TASK_PROJECT_SCOPE_REQUIRED` before Codex launch | UNKNOWN | 2026-08-21 |

## Bug Records

## AICC-BUG-010

- Title: Bridge canonical task scope propagation occurs after the first task sync.
- Severity: UNTRIAGED
- Status: Verified
- Affected Module: `src/lib/bridgeCore.ts` Bridge submission and canonical task projection
- Discovered At: 2026-08-21
- Discovered By: AICC core execution chain final soak blocker forensic
- Environment: Local AICC Web Bridge submission on `rebuild/aicc-v2`
- Commit SHA: NOT_CAPTURED
- Blocks Current Scope: UNKNOWN

### Expected

An accepted Bridge submission has its canonical active project scope propagated before canonical task persistence, or an explicitly governed unscoped contract is applied.

### Actual

`submitExecution()` persists an Inbox item and calls `syncTask(item)` before `launchInboxItem()` injects `projectEntityScope(getActiveProject())`. `syncTask()` requires both `projectId` and `repositoryIdentity` and throws `TASK_PROJECT_SCOPE_REQUIRED`, so Codex is not started.

### Reproduction

POST a valid read-only `AICC_EXECUTION_V1` payload to `/api/gpt-bridge/inbox` with `createCanonicalTask: true` and no project scope fields. The route returns HTTP 400 with `TASK_PROJECT_SCOPE_REQUIRED` before any Codex process is created.

### Evidence

- `src/lib/bridgeCore.ts:81` calls `syncTask(item)` before `launchInboxItem(item.id, metadata)`.
- `src/lib/bridgeCore.ts:115` validates `item.projectId`/`instruction.projectId` and `repositoryIdentity`.
- `src/lib/bridgeCore.ts:177-180` injects the active project scope only inside `launchInboxItem()`.
- 2026-08-21 final soak attempt: HTTP 400, `TASK_PROJECT_SCOPE_REQUIRED`; Codex process not started.

### Deferred Reason

Forensic scope only. No production remediation or guard removal was authorized.

### Target Remediation Phase

External project loading / Bridge integration reconciliation unless explicitly reprioritized.

### Resolution

VERIFIED — active project scope is propagated before the first canonical task sync; the guard remains active.

### Additional Evidence

- Project scope inference remains forbidden; the active project registry is the canonical authority.
- This record does not classify task semantics or grant AICC decision authority.
- 2026-08-21 remediation: `submitExecution()` binds `projectEntityScope(getActiveProject())` to the instruction before `syncTask()`.
- Focused Bridge UAT: POST `/api/gpt-bridge/inbox` launched a Codex run with `projectId=aicc` and `repositoryIdentity=beyourlovercom/aicontrolcenter`; `TASK_PROJECT_SCOPE_REQUIRED` was not triggered.

## AICC-BUG-001

- Title: Runtime Workspace recovery-toast baseline assertion conflicts with the current feedback baseline.
- Severity: UNTRIAGED
- Status: Reported
- Affected Module: `src/lib/runtimeWorkspaceUi.test.ts`
- Discovered At: 2026-08-20
- Discovered By: Canonical Registry initial migration evidence audit
- Environment: Local repository test execution
- Commit SHA: NOT_CAPTURED
- Blocks Current Scope: UNKNOWN

### Expected

The focused Runtime Workspace contract test reflects the currently governed single Global Feedback Island baseline and passes without requiring a removed local recovery toast.

### Actual

`src/lib/runtimeWorkspaceUi.test.ts` fails at its assertions for `recoveryToastTimer=window.setTimeout` and `.recovery-toast`.

### Reproduction

Run `npx tsx src/lib/runtimeWorkspaceUi.test.ts` from the repository root.

### Evidence

- 2026-08-20 initial migration audit: exact focused test exited nonzero.
- Failing assertions: `src/lib/runtimeWorkspaceUi.test.ts:46-47`.

### Deferred Reason

Registry initialization records the evidence only. No explicit severity, priority, or remediation authorization was supplied.

### Target Remediation Phase

Final Project Bug Sweep unless explicitly reprioritized.

### Resolution

NOT_YET

### Additional Evidence

- Preserve the distinction between a stale test contract and a production behavior regression during future triage.

## AICC-BUG-002

- Title: Completed Runtime can retain the `Codex 进程运行中` current-activity label.
- Severity: UNTRIAGED
- Status: Reported
- Affected Module: Runtime durable state and `RuntimeWorkspace` current-activity presentation
- Discovered At: 2026-08-20
- Discovered By: Canonical Registry initial migration evidence audit
- Environment: Local durable runtime records
- Commit SHA: NOT_CAPTURED
- Blocks Current Scope: UNKNOWN

### Expected

A Runtime whose canonical phase is `COMPLETED` and whose process truth is dead does not present a current activity that states the Codex process is running.

### Actual

Multiple durable Runtime records have `phase: COMPLETED`, `pidAlive: false`, and `processAlive: false`, while retaining `currentTask: Codex 进程运行中`. `RuntimeWorkspace` renders `focused.currentTask` as 当前活动.

### Reproduction

Inspect completed files under `~/.aicc-v2/runtime-run-*.json` and select a matching Runtime in the current Runtime Workspace.

### Evidence

- 2026-08-20 audit found completed runs including `run-1787153589147-vgr0c8` and `run-1787197651437-srqozx` with the conflicting durable fields.
- `scripts/aicc-run-supervisor.ts:140` writes `Codex 进程运行中` at spawn.
- `src/components/entity/RuntimeWorkspace.svelte:94` renders `focused.currentTask` as 当前活动 without terminal-phase normalization.

### Deferred Reason

Registry initialization records the evidence only. No explicit severity, priority, or remediation authorization was supplied.

### Target Remediation Phase

Final Project Bug Sweep unless explicitly reprioritized.

### Resolution

NOT_YET

### Additional Evidence

- Do not infer a process lifecycle outcome from this display-label observation; terminal runtime fields remain the source for process truth.
- 2026-08-20 remediation evidence: `STOPPING → STOPPED` reconciliation now converges `processAlive=false`, `pidAlive=false`, `currentTask=执行已停止`, clears stale `latestEvent=process.spawned`, and preserves `stopReason=OWNER_STOPPED` without fabricating exit or close evidence.
- Focused regression: `src/lib/runtimeOwnerStopReconciliation.test.ts` verifies dead-process terminal convergence and concurrent run isolation. Natural exit and canonical-result coverage remain passing.
- Real Owner Stop UAT was not executed in this environment; status remains `Reported` pending explicit Owner verification.

## AICC-BUG-003

- Title: Task/WP Roadmap binding test expects stale `M8` instead of canonical `M8.2`.
- Severity: UNTRIAGED
- Status: Reported
- Affected Module: `src/lib/taskWpRoadmapBindingNormalization.test.ts`
- Discovered At: 2026-08-20
- Discovered By: Phase 4 WP canonical projection validation
- Environment: Local repository test execution
- Commit SHA: NOT_CAPTURED
- Blocks Current Scope: UNKNOWN

### Expected

The Task/WP Roadmap binding contract reflects the canonical Roadmap structural parent Milestone.

### Actual

`src/lib/taskWpRoadmapBindingNormalization.test.ts` expects `M8`, while the canonical Roadmap structural binding resolves the formal Bridge WP to `M8.2`.

### Reproduction

Run `node --experimental-strip-types --experimental-specifier-resolution=node src/lib/taskWpRoadmapBindingNormalization.test.ts` from the repository root.

### Evidence

- 2026-08-20 Phase 4 validation: `npm test` stopped in `pretest` at line 13 with `expected: M8`, `actual: M8.2`.

### Deferred Reason

The stale test expectation is outside the authorized Phase 4 projection migration. Production must retain canonical Roadmap structure rather than changing parent binding behavior to satisfy it. No severity or remediation authorization was supplied.

### Target Remediation Phase

Final Project Bug Sweep unless explicitly reprioritized.

### Resolution

NOT_YET

### Additional Evidence

- This record concerns the stale test assertion, not a PR lifecycle projection defect.

## AICC-BUG-004

- Title: Completed Bridge run leaves the feedback/status projection at `STARTING · NOT_READY · PAUSED` and does not expose whether GPT feedback was delivered.
- Severity: UNTRIAGED
- Status: Reported
- Affected Module: AICC Web Bridge status projection / GPT feedback-delivery presentation
- Discovered At: 2026-08-20
- Discovered By: OWNER
- Environment: AICC Web Bridge connected to ChatGPT
- Commit SHA: NOT_CAPTURED
- Blocks Current Scope: UNKNOWN

### Expected

When a command sent through the Bridge finishes, the Bridge must truthfully project the completed Run/Execution state while separately exposing the GPT feedback-delivery lifecycle. A completed execution must not remain visually stuck in a pre-execution state, and the UI should distinguish feedback pending, delivered, or failed without collapsing those independent lifecycle dimensions.

### Actual

The owner observed a run whose result panel showed `COMPLETED`, `Codex finished`, and `Result = Available`, while the Bridge status line still displayed `STARTING · NOT_READY · PAUSED`. The same surface did not truthfully indicate whether the completed result had been inserted/submitted back into the bound GPT conversation.

### Reproduction

1. Use the AICC Bridge to send a command to AICC/Codex.
2. Wait until the Run Result panel reaches `COMPLETED` / `Codex finished` / `Result = Available`.
3. Inspect the Bridge status line.
4. Verify separately in the bound GPT conversation whether feedback was actually inserted/submitted.
5. Compare the real execution and feedback-delivery facts with the Bridge projection.

### Evidence

- Owner-provided screenshot on 2026-08-20 showed `STARTING · NOT_READY · PAUSED` while Run `run-1787206250756-ueg845` was `COMPLETED`, `Codex finished`, with `Result = Available`.
- The screenshot did not establish whether GPT insertion/submission succeeded; that fact remains unverified and must not be guessed.

### Deferred Reason

The owner requested canonical recording only. No explicit severity or remediation authorization was supplied.

### Target Remediation Phase

Final Project Bug Sweep unless explicitly reprioritized.

### Resolution

NOT_YET

### Additional Evidence

- Keep Run/Execution lifecycle and GPT feedback-delivery lifecycle separate during future triage; this record does not establish a root cause.

## AICC-BUG-005

- Title: Bridge buttons `5 插入 AICC 结果` and `6 执行下一步` do not return/insert results to the GPT chat while `3 插入 Codex 结果` succeeds.
- Severity: UNTRIAGED
- Status: Reported
- Affected Module: AICC Web Bridge action routing / GPT result insertion
- Discovered At: 2026-08-20
- Discovered By: OWNER
- Environment: AICC Web Bridge connected to ChatGPT
- Commit SHA: NOT_CAPTURED
- Blocks Current Scope: UNKNOWN

### Expected

The Bridge action buttons must perform their governed result-delivery behavior consistently. `5 插入 AICC 结果` should insert the AICC result into the bound GPT conversation. `6 执行下一步`, when it produces a completed execution result, should return that result through the governed GPT feedback path. `3 插入 Codex 结果` should continue to insert the Codex result exactly as shown in the result preview.

### Actual

The owner observed:

- the dedicated GPT insertion action can successfully insert a result into GPT;
- clicking `6 执行下一步` produces no result in the GPT chat;
- clicking `5 插入 AICC 结果` produces no result in the GPT chat;
- clicking `3 插入 Codex 结果` works normally, and the inserted content matches the result preview.

### Reproduction

1. Open the connected AICC Web Bridge in ChatGPT.
2. Use the available result/preview state as the source.
3. Trigger `3 插入 Codex 结果` and confirm the result is inserted into GPT.
4. Trigger `5 插入 AICC 结果` and observe that no result appears in GPT.
5. Trigger `6 执行下一步` and observe that no result is returned to GPT after the action/execution path completes.
6. Compare all three outcomes against the same bound conversation and result preview.

### Evidence

- Owner live observation on 2026-08-20 in the connected GPT/AICC workflow.
- `3 插入 Codex 结果` was confirmed working and matched the result preview.
- `5 插入 AICC 结果` and `6 执行下一步` were confirmed to produce no GPT result.

### Deferred Reason

The owner requested Bug capture without remediation. No explicit severity or priority was supplied.

### Target Remediation Phase

Final Project Bug Sweep unless explicitly reprioritized.

### Resolution

NOT_YET

### Additional Evidence

- Potential relation to AICC-BUG-004 is not established. Keep this record separate because it concerns explicit button action behavior rather than only lifecycle/status projection.

## Initial Migration Audit

| Candidate | Evidence Result | Registry Action |
|---|---|---|
| `runtimeWorkspaceUi.test.ts` recovery-toast baseline drift | Current focused test fails at the obsolete local-toast assertions. | Recorded as `AICC-BUG-001`. |
| `globalTaskView.test.ts` PR-import baseline conflict | Current focused test passes. | No Bug record created. |
| `phase2GptToAicc.test.ts` stale `executableSurfaces` assertion | Current focused test passes. | No Bug record created. |
| Completed Runtime shows Codex process running current activity | Durable completed Runtime evidence still demonstrates the conflicting label. | Recorded as `AICC-BUG-002`. |

## AICC-BUG-006

- Title: Global Composer model-source value is absent from the bridge execution metadata union.
- Severity: UNTRIAGED
- Status: Reported
- Affected Module: `src/lib/bridgeCore.ts` execution metadata typing
- Discovered At: 2026-08-20
- Discovered By: Codex TypeScript validation during `AICC_ZERO_OUTPUT_DECISION_AUTHORITY_V1`
- Environment: Local repository `npx tsc --noEmit`
- Commit SHA: `8b62701f31ceddbbf56225b143320ee903d0f245`
- Blocks Current Scope: UNKNOWN

### Expected

The declared execution metadata union accepts the governed Global Composer source value used by the bridge route.

### Actual

TypeScript reports `TS2322`: `AICC_GLOBAL_EXECUTION_COMPOSER` is not assignable to the declared `modelSource` union.

### Reproduction

Run `npx tsc --noEmit` from the repository root.

### Evidence

- 2026-08-20 TypeScript output: `src/lib/bridgeCore.ts(183,306)`.

### Deferred Reason

Outside the authorized Codex-result output relay scope. No severity or remediation authorization was supplied.

### Target Remediation Phase

Final Project Bug Sweep unless explicitly reprioritized.

### Resolution

NOT_YET

### Additional Evidence

- 2026-08-20 Phase 1 validation: `npx tsc --noEmit` completed successfully. This observation does not reclassify or close the record; its prior failing state requires separate triage.

## AICC-BUG-007

- Title: Vite launch metadata type does not declare the `modelSource` property supplied by the bridge route.
- Severity: UNTRIAGED
- Status: Reported
- Affected Module: `vite.config.ts` bridge request typing
- Discovered At: 2026-08-20
- Discovered By: Codex TypeScript validation during `AICC_ZERO_OUTPUT_DECISION_AUTHORITY_V1`
- Environment: Local repository `npx tsc --noEmit`
- Commit SHA: `8b62701f31ceddbbf56225b143320ee903d0f245`
- Blocks Current Scope: UNKNOWN

### Expected

The launch metadata type declares every property provided by the governed bridge route.

### Actual

TypeScript reports `TS2353`: `modelSource` does not exist in `ExecutionLaunchMetadata`.

### Reproduction

Run `npx tsc --noEmit` from the repository root.

### Evidence

- 2026-08-20 TypeScript output: `vite.config.ts(58,1233)`.

### Deferred Reason

Outside the authorized Codex-result output relay scope. No severity or remediation authorization was supplied.

### Target Remediation Phase

Final Project Bug Sweep unless explicitly reprioritized.

### Resolution

NOT_YET

### Additional Evidence

- 2026-08-20 Phase 1 validation: `npx tsc --noEmit` completed successfully. This observation does not reclassify or close the record; its prior failing state requires separate triage.

## AICC-BUG-008

- Title: Global Task Inspector test uses a stale right-panel selector assertion.
- Severity: UNTRIAGED
- Status: Reported
- Affected Module: `src/lib/globalTaskView.test.ts`
- Discovered At: 2026-08-20
- Discovered By: Codex full validation during `AICC_ZERO_OUTPUT_DECISION_AUTHORITY_V1`
- Environment: Local repository `npm test`
- Commit SHA: `8b62701f31ceddbbf56225b143320ee903d0f245`
- Blocks Current Scope: UNKNOWN

### Expected

The Global Task contract test reflects the current shared Task Inspector composition.

### Actual

`npm test` fails at `globalTaskView.test.ts:36` because its expected `aside.status panel` pattern does not match the current `App.svelte` structure.

### Reproduction

Run `npm test` from the repository root.

### Evidence

- 2026-08-20 full validation stopped at `src/lib/globalTaskView.test.ts:36`.

### Deferred Reason

Outside the authorized Codex-result output relay scope. No severity or remediation authorization was supplied.

### Target Remediation Phase

Final Project Bug Sweep unless explicitly reprioritized.

### Resolution

NOT_YET

## AICC-BUG-009

- Title: Vite local-control health route can block its HTTP event loop in an unbounded synchronous subprocess.
- Severity: UNTRIAGED
- Status: Reported
- Affected Module: `vite.config.ts`, `src/lib/controlService.ts`
- Discovered At: 2026-08-20
- Discovered By: `AICC_VITE_SYNC_PROCESS_BLOCKING_FORENSIC_V1`
- Environment: Local Vite service on `127.0.0.1:1420`
- Commit SHA: `8b62701f31ceddbbf56225b143320ee903d0f245`
- Blocks Current Scope: UNKNOWN

### Expected

`/api/health` remains responsive while local-service status is projected.

### Actual

At 2026-08-20 21:12:35 +0800, a sample of the listening Vite PID 11761
captured HTTP request handling blocked in `node::SyncProcessRunner::Spawn` /
`Run`. The health endpoint timed out. The health call graph reaches unbounded
synchronous `/usr/sbin/lsof` and `/bin/ps` calls through `detectPortOwner`.
The sample does not preserve the child command arguments, so the exact command
is not established.

### Reproduction

Use the frozen forensic evidence at `/tmp/aicc-vite-11761.sample.txt`; invoke
only bounded, read-only health probes while investigating. Do not intentionally
hang the production Vite service.

### Evidence

- `sample 11761` at 2026-08-20 21:12:35 +0800 shows the Node HTTP parser path
  and `SyncProcessRunner` waiting in `kevent`.
- `vite.config.ts:55` maps `/api/health` to
  `readLocalServiceHealthStatus()`.
- `src/lib/controlService.ts:243-259` reaches synchronous `lsof` and `ps`
  without explicit timeout options.
- A bounded forensic probe subsequently timed out after 3.004 seconds.

### Deferred Reason

Forensic work only. This record authorizes no remediation; a future authorized
work package must establish the exact blocking child command before changing
the route.

### Target Remediation Phase

Final Project Bug Sweep unless explicitly reprioritized.

### Resolution

NOT_YET

### Additional Evidence

- 2026-08-20 remediation changed `/api/health` and the co-polled
  `/api/service/status` to use the bounded asynchronous port-owner resolver.
  Focused nonblocking and recovery tests, TypeScript, and build passed.
- Real-service UAT could not complete 20 consecutive requests: after startup,
  two health requests returned HTTP 200 with `portOwner: UNAVAILABLE`, and the
  third timed out at 3.006 seconds while the supervisor was already
  `RECOVERY_FAILED`. This does not establish the health diagnostic as the
  remaining blocking call; Bug-009 remains Reported pending a separate
  whole-event-loop causal capture.
- 2026-08-20 remaining-route forensic reproduced the stall twice against the
  same Vite PID (`95199`) after the health/status asynchronous remediation.
  In a controlled serial route sequence, `/api/gpt-bridge/outbox` was the last
  completed request and `/api/gpt-bridge/notifications` was the first
  non-returning request (3.006 seconds, zero response bytes). A second
  notification-only probe also timed out after 3.004 seconds. The frozen
  samples are `/tmp/aicc-bug009-sequence-stall.sample.txt` and
  `/tmp/aicc-bug009-notifications-pending.sample.txt`; both show the Node HTTP
  parser path and `node::SyncProcessRunner` waiting in `kevent`.
- The notifications handler itself calls `readNotifications()`, which performs
  synchronous persisted-execution reconciliation and a local JSON file read;
  it has no static synchronous child-process call. The profiler does not
  preserve the JavaScript call site or spawned command, so this request is the
  first observed non-returning boundary, not a proven exact blocking route or
  operation.
- At the second capture, the listener had two established loopback connections,
  but request identities and active handler counts were not instrumented;
  concurrent HTTP requests, duplicate pollers, and request fanout are not
  established. Application polling has per-poller in-flight guards for health,
  inbox, and runtime projection; this does not exclude other browser clients.
- Static route audit after excluding the three remediated health/status
  diagnostics found 12 remaining HTTP-reachable unbounded synchronous
  child-process call sites: project-registry validation, canonical work-package
  reads, authorization worktree inspection, local-main synchronization,
  bug-registry local sync, and canary worktree provisioning. This is an
  exposure inventory, not causal attribution for the reproduced notification
  request.
- 2026-08-20 GPT Bridge-only forensic completed both route graphs. `GET
  /api/gpt-bridge/outbox` calls `readOutboxAsync()`, then asynchronous
  `readFile(outboxFile)` and `JSON.parse`; it does not reconcile executions and
  has no synchronous filesystem or child-process call. `GET
  /api/gpt-bridge/notifications` calls `readNotifications()` →
  `reconcilePersistedExecutions()` → `reconcileBridgeExecution()` →
  `runtimeForItem()` → `readRuntime()` → `reconcileRuntimeEntityBinding()` →
  `ProjectRegistryAuthority.getProjectRegistry()` → `validate()` → `git()`.
- The notifications graph contains synchronous persisted-data reads/parses and
  an unbounded `execFileSync('git', ['-C', root, ...args])` in
  `src/lib/projectRegistryAuthority.ts:11`. `validate()` invokes it for
  `rev-parse --show-toplevel`, `branch --show-current`, `config --get
  remote.origin.url`, and `symbolic-ref --short refs/remotes/origin/HEAD` for
  every registered project. The route reaches this validation while reconciling
  every persisted inbox execution, so the number of synchronous child-process
  calls is data-dependent and unbounded per notification poll.
- Temporary, fully removed instrumentation recorded a controlled direct
  `readNotifications()` replay still executing after one second in
  `SyncProcessRunner`/`kevent`; 1,500 project-registry git invocations had
  started before the controlled process was terminated. The final observed
  start was `git -C <AICC_REPO> rev-parse
  --show-toplevel`; it was terminated by the forensic harness, so it does not
  prove that this individual command naturally hangs. Combined with the two
  frozen Vite samples that show the identical `SyncProcessRunner` boundary
  during the non-returning notifications request, this establishes the
  notifications route's synchronous git-validation fanout as the blocking
  route/function/operation class. No active child PID was captured in either
  Vite sample; the child had exited or was not observable at sample time.
- Polling audit: the current extension's outbox poll runs every 3 seconds and
  does not retain an in-flight guard; the legacy bridge script also defines an
  unguarded 3-second outbox interval, but active simultaneous installation was
  not established. Notifications are requested by `loadBridge()` on mount and
  explicit bridge refreshes, not by a dedicated periodic notifications timer.
  No overlap or duplicate poller was observed in the controlled reproduction.
- 2026-08-20 authorized notifications remediation changed the GET route to
  `readNotificationsAsync()`: it now asynchronously reads the persisted
  notifications snapshot and does not call execution reconciliation in the
  HTTP handler. Project Registry gained a semantically equivalent async git
  validation API with a 750ms timeout, 64KB output bound, exact `git -C`
  arguments, and sequential validation (one project and one git child at a
  time). The synchronous Registry API remains outside this route's call graph.
- Focused Project Registry, notifications nonblocking, health latency, and
  local-service recovery tests passed; TypeScript and production build passed.
  The Project Registry regression substitutes a two-second `git` executable,
  verifies the 750ms bounded async failure, and verifies that `setImmediate`
  runs while that child is pending.
  The notifications-only real-service UAT completed 20 sequential HTTP 200
  requests with zero timeouts. Its slowest warm-up responses were 0.954 and
  1.504 seconds; the remaining requests were below 0.086 seconds.
- The bounded combined-poll UAT did not pass: at loop 10, outbox and
  notifications each timed out after approximately 2 seconds, while health
  and service-status subsequently returned HTTP 200 (1.379 and 1.933 seconds).
  The bounded harness was terminated after 56 recorded route attempts and 38
  timeouts to stop continued load. During a later timed-out outbox request, a
  direct Vite child-process listing observed one active `(git)` child. This
  does not disprove the notifications-only remediation, but it does not
  establish a clean Vite-wide service result or identify the remaining caller.
  No distinct root cause is proven, no additional Bug record was created, and
  AICC-BUG-009 remains `Reported` pending a separate scoped investigation of
  the remaining combined-poll behavior.
- 2026-08-21 controlled combined-polling forensic repeated 20 sequential
  cycles of outbox, notifications, health, and service-status (80 explicitly
  identified requests). Every request returned HTTP 200; failed and timed-out
  request counts were both zero. The harness issued the next request only after
  the prior request returned, and sampled zero direct Vite children before and
  after every request (baseline/peak/final all zero). No failure occurred, so
  no fresh stall sample was required.
- The prior combined-UAT timeout record did not include request identities,
  valid high-resolution timestamps, failure-time independent probes, or child
  snapshots, and its shell harness continued after its controlling tool turn
  had ended. The fresh controlled run does not reproduce it. Its exact cause is
  therefore `INSUFFICIENT_EVIDENCE`, with the prior harness lifecycle recorded
  as a limitation; it must not be classified as a real Vite-wide stall,
  child-process accumulation, or duplicate polling without new evidence.

<!--
Canonical Bug template:

## AICC-BUG-XXX

- Title:
- Severity: P0 | P1 | P2 | P3 | UNTRIAGED
- Status: Reported | Triage | Accepted | Fixed | Verified | Closed
- Affected Module:
- Discovered At:
- Discovered By:
- Environment:
- Commit SHA:
- Blocks Current Scope: YES | NO | UNKNOWN

### Expected
...

### Actual
...

### Reproduction
...

### Evidence
...

### Deferred Reason
...

### Target Remediation Phase
...

### Resolution
NOT_YET

### Additional Evidence
- ...
-->
