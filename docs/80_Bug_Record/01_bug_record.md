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
