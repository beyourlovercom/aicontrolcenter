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

## Bug Records

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
