# AI Control Center Legacy Living Roadmap

> Canonical next-development roadmap: [AICC V4 Living Roadmap](AICC-V4-LIVING-ROADMAP.md).
> This file is retained for V2/M4 historical traceability and is not the authority for
> the current milestone or next Work Package.

## Current milestone

`V4.0 — Roadmap Rebaseline`

## Authority

Current baseline authority: `AICC V3.0–V3.9 production baseline — CLOSED / MERGED TO MAIN / RUNTIME CUTOVER PASS`

Highest architecture constraint:

```text
AICC = transport + status + display + result return
AICC_DECISION_AUTHORITY = 0
AICC_PASS_FAIL_BLOCKED_AUTHORITY = CODEX
```

Closed baseline: `AICC V3.0–V3.9`, including merged/cutover/smoke/sealed closure recorded in
`docs/10_Planning_Roadmap/AICC-V3-LIVING-ROADMAP.md` and
`docs/60_Operations/AICC-V3-FINAL-HANDOFF.md`.

Current Work Package: `AICC-V4-ROADMAP-REBASELINE-001`

Current implementation phase: `V4.0 — documentation/governance only; no runtime implementation`

Owner progression decision: V3 production closure is sealed. `M4.1` is historical V2
traceability, not the current implementation mainline. V4.1 remains `PLANNED / NOT_AUTHORIZED`.

## Historical V2 Milestones

### M1 — Control Surface Finalization
Work Packages: `AICC-V2-UI-WORKFLOW-001`, `AICC-V2-DUAL-PANEL-001`, `AICC-V2-VISUAL-IDENTITY-UNIFICATION-001`, `AICC-V2-RUNTIME-OBSERVER-001`

### M2 — Human UAT Control
Work Packages: `AICC-V2-HUMAN-UAT-001`

### M3 — First Usable Version Closure
Work Packages: `AICC-V2-SELF-DEVELOPMENT-UAT-001`

### M3.4 — Fast Execution Path
Work Packages: `AICC-V2-FAST-EXECUTION-PATH-001`

### M3.5 — GPT Bridge Contract
Work Packages: `AICC-V2-GPT-BRIDGE-001` — `CLOSED`; 001A and 001B complete,
Human UAT PASS, First Usable Version hard gates 5/5 PASS.

### M3.6 — Terminal Handoff
Work Packages: `AICC-V2-TERMINAL-HANDOFF-001` — `IMPLEMENTED / OWNER_UAT_PENDING`.
Its existing correlation/result-handoff capabilities are reused by M4.1 where
compatible with Constitution v1.3.

### M3.7 — Auto Execute Mode
Work Packages: `AICC-V2-AUTO-EXECUTE-MODE-001` — `CLOSED`; Auto Execute V1
approved baseline after Human UAT PASS.

`AUTO_EXECUTE_ROADMAP_STATUS = CLOSED`

### M3.75 — Autopilot Until Human UAT
Work Packages: `AICC-V2-AUTOPILOT-UNTIL-UAT-001`

### M3.8 — Runtime Operations
Work Packages: `AICC-V2-RUNTIME-OPERATIONS-001` — `CLOSED`; Runtime Operations
V1 is an approved baseline after Owner Human UAT PASS.

`RUNTIME_OPERATIONS_ROADMAP_STATUS = CLOSED`

### M3.85 — Workspace Context
Work Packages: `AICC-V2-WORKSPACE-CONTEXT-001` — `CLOSED`; Workspace Context V1
approved baseline after Owner Human UAT PASS.

`WORKSPACE_CONTEXT_ROADMAP_STATUS = CLOSED`

### M3.86 — Work Package Lifecycle
Work Packages: `AICC-V2-WORK-PACKAGE-LIFECYCLE-001` — `CLOSED`; Work Package
Lifecycle V1 and Human UAT Workspace V1 are approved baselines after Owner
Human UAT PASS.

`WORK_PACKAGE_LIFECYCLE_ROADMAP_STATUS = CLOSED`

### M3.87 — Runtime Workspace V1 Freeze
Work Packages: `AICC-V2-RUNTIME-WORKSPACE-REFINE-001` — `CLOSED`; Runtime
Workspace V1 approved baseline after real Owner browser UAT PASS.

`RUNTIME_WORKSPACE_ROADMAP_STATUS = CLOSED`
`RUNTIME_WORKSPACE_V1 = APPROVED_BASELINE`
`HUMAN_UAT = PASS`

### M3.9 — Local Service Autostart
Work Packages: `AICC-V2-LOCAL-SERVICE-AUTOSTART-001`

### M4 — PR Runner Foundation
Work Packages: `AICC-V2-PR-RUNNER-001` — `CLOSED / HUMAN_UAT_PASS`.

PR Runner Foundation V1, PR Workspace, global repository PR read model,
Roadmap PR projection, one-to-many WP→PR rendering, real PR Canary projection,
reconnect idempotency, and historical PR preservation passed Owner Human UAT.

`M4_PR_RUNNER_FOUNDATION = APPROVED_BASELINE`
`M4_OWNER_UAT = PASS`
`M4_ROADMAP_STATUS = CLOSED`

### M4.1 — GPT ↔ AICC ↔ Codex Closed Loop (Historical)
Work Packages: `AICC-V2-GPT-AICC-CODEX-CLOSED-LOOP-001` — `HISTORICAL / OWNER_AUTHORIZED AT THE TIME`.

Purpose: connect the already-delivered execution panel, GPT Bridge, Codex
runtime, result persistence, and ChatGPT return path into one reliable closed
loop without adding any AICC semantic decision authority.

Implementation phases inside this single Work Package:

1. `Phase 1 — Unified Action Layer`
   - `⌥⌘V` = 粘贴指令
   - `⌥⌘R` = 导入执行
   - `⌥⌘C` = 复制结果
   - Button / shortcut / Bridge / API converge on one canonical action layer.
2. `Phase 2 — GPT → AICC`
   - executable Assistant content exposes compact `✦ AICC`;
   - one Owner click calls the canonical `importAndRun()` path.
3. `Phase 3 — AICC → Codex Pure Pass-through`
   - no semantic pre-Codex gate;
   - Codex owns repository/task reasoning and execution outcome.
4. `Phase 4 — Codex → AICC Canonical Result`
   - one durable `execution_id / result_id / result_hash` result source.
5. `Phase 5 — AICC → GPT Exactly-once Return`
   - bind originating conversation/message;
   - return each result at most once across rerender, refresh, reconnect, and restart.
6. `Phase 6 — Owner Human UAT`
   - verify the full visible `GPT → AICC → Codex → AICC → GPT` loop;
   - verify manual shortcuts remain usable fallback.

Architecture constraints:

```text
AICC_TRANSPORT_ONLY = 1
AICC_DISPLAY_ONLY = 1
AICC_DECISION_AUTHORITY = 0
PRE_CODEX_SEMANTIC_GATE_COUNT = 0
AICC_PASS_FAIL_BLOCKED_AUTHORITY = CODEX
AICC_RESULT_REWRITE = 0
```

`M4_1_ROADMAP_STATUS = HISTORICAL / SUPERSEDED BY V3 PRODUCTION CLOSURE`
`CURRENT_M4_1_PHASE = HISTORICAL_SUPERSEDED`
`M4_PR_RUNNER_IMPLEMENTATION = APPROVED_BASELINE`
`M4_PR_RUNNER_HUMAN_UAT = PASS`

### M5 — Review + Exact-head CI
Work Packages: `AICC-V2-REVIEW-CI-001`

### M6 — Autonomous PR Delivery
Work Packages: `AICC-V2-AUTO-DELIVERY-001`

### M7 — WP Automatic Lifecycle
Work Packages: `AICC-V2-WP-LIFECYCLE-001`

### M8 — Evidence & Audit
Work Packages: `AICC-V2-EVIDENCE-001`

### M9 — Mobile Owner Console
Work Packages: `AICC-V2-MOBILE-OWNER-001`

### M10 — Multi-project AICC
Work Packages: `AICC-V2-PROJECT-REGISTRY-001`

### M11 — AICC Self Development

Status: `COMPLETE`

Work Packages:

- `AICC-M11.0-SELF-DEVELOPMENT-BOOTSTRAP-001`
- `AICC-M11.1-SELF-OPTIMIZATION-LOOP-001`
- `AICC-M11.2-AGENT-ORCHESTRATION-001`
- `AICC-M11.3-AGENT-MEMORY-KNOWLEDGE-GRAPH-001`
- `AICC-M11.4-FULL-AUTONOMOUS-DELIVERY-VALIDATION-001`

Goal:

建立 AICC 自我开发、自我优化、Agent Orchestration、Knowledge Graph 与完整 Autonomous Delivery Validation 能力。

### M11.5 — AICC Self Development Real Run

Status: `PLANNED`

Work Packages:

- `AICC-M11.5-REAL-RUN-001`

Goal:

验证 AICC 是否可以根据 Living Roadmap 自动驱动自身真实开发。

## Historical V2 near-term delivery sequence

```text
M3.87 Runtime Workspace V1 Freeze — CLOSED
↓
M4 PR Runner Foundation — CLOSED / HUMAN_UAT_PASS
↓
M4.1 GPT ↔ AICC ↔ Codex Closed Loop — HISTORICAL / SUPERSEDED
  Phase 1 Unified Action Layer
  ↓
  Phase 2 GPT → AICC
  ↓
  Phase 3 AICC → Codex Pure Pass-through
  ↓
  Phase 4 Codex → AICC Canonical Result
  ↓
  Phase 5 AICC → GPT Exactly-once Return
  ↓
  Phase 6 Owner Human UAT
↓
M5 Review + Exact-head CI
↓
M6 Autonomous PR Delivery
↓
M7 WP Automatic Lifecycle
```

M4 is closed. This sequence is retained only as historical traceability. It does not
authorize reopening M4/M4.1 or selecting a successor Work Package. The canonical
successor sequence is defined in `AICC-V4-LIVING-ROADMAP.md`.

## Current execution architecture

Canonical execution path:

```text
Owner
↕
GPT
↕
AICC transport / status / display / persistence / return
↕
Codex execution authority
↕
Repository / Git / tests
```

AICC does not independently decide repository, Work Package, branch, worktree,
authorization, governance, permission, feasibility, test sufficiency, Git action,
or task safety. Those task-level findings and `PASS / FAIL / BLOCKED / CANCELLED`
outcomes belong to Codex and repository-local rules.

AICC may fail only for real transport/runtime failures such as inability to
create durable execution identity, launch/reach Codex, persist correlation, or
return the result. Such failures remain distinct from Codex task outcomes.

## Historical traceability

The former `M3.88 — GPT ↔ AICC ↔ Codex Closed Loop` label was superseded by
`M4.1` to match the historical Roadmap order after PR Runner Foundation. The
Work Package ID remains unchanged so execution history and references stay stable.

Legacy Work Packages and earlier Roadmap language remain historical evidence.
Where historical wording assigns semantic pre-Codex gates, Writer Lock execution
authority, authorization gating, or task-level PASS/FAIL/BLOCKED authority to
AICC, `AICC-V2-PROJECT-CONSTITUTION-001 v1.3` and
`AICC-V2-CANONICAL-EXECUTION-STANDARD-001 v1.3` supersede that wording for all
new implementation.

Historical results are not rewritten into different past results.
