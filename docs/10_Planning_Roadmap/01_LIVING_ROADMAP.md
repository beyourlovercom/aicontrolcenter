# AI Control Center Living Roadmap

## Current milestone

`M3.88 — GPT ↔ AICC ↔ Codex Closed Loop`

## Authority

Current constitutional authority: `AICC-V2-PROJECT-CONSTITUTION-001 v1.3`

Highest architecture constraint:

```text
AICC = transport + status + display + result return
AICC_DECISION_AUTHORITY = 0
AICC_PASS_FAIL_BLOCKED_AUTHORITY = CODEX
```

Closed Work Packages: `AICC-VISIBLE-SLICE-001`, `AICC-OPENSPEC-READMODEL-001`, `AICC-CONTROL-LOOP-001A`

Current Work Package: `AICC-V2-GPT-AICC-CODEX-CLOSED-LOOP-001`

Current implementation phase: `Phase 1 — Unified Action Layer`

`AICC-V2-PR-RUNNER-001` implementation is preserved and paused for M3.88 closed-loop completion before its Human UAT progression resumes.

## Active V2 Milestones

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
Its existing correlation/result-handoff capabilities are reused by M3.88 where
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

### M3.88 — GPT ↔ AICC ↔ Codex Closed Loop
Work Packages: `AICC-V2-GPT-AICC-CODEX-CLOSED-LOOP-001` — `ACTIVE / OWNER_AUTHORIZED`.

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

`M3_88_ROADMAP_STATUS = ACTIVE`
`CURRENT_M3_88_PHASE = PHASE_1_UNIFIED_ACTION_LAYER`
`M4_PROGRESSION = PAUSED_FOR_M3_88_CLOSED_LOOP`

### M3.9 — Local Service Autostart
Work Packages: `AICC-V2-LOCAL-SERVICE-AUTOSTART-001`

### M4 — PR Runner Foundation
Work Packages: `AICC-V2-PR-RUNNER-001` — `IMPLEMENTED / MACHINE_VALIDATED / HUMAN_UAT_PENDING / PAUSED_FOR_M3_88_CLOSED_LOOP`.

Existing PR Runner implementation and evidence are preserved. M3.88 does not
rebuild M4. M4 Human UAT/progression resumes after the M3.88 closed-loop Owner
Human UAT passes.

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

## Near-term delivery sequence

```text
M3.87 Runtime Workspace V1 Freeze — CLOSED
↓
M3.88 GPT ↔ AICC ↔ Codex Closed Loop — ACTIVE
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
M3.9 Local Service Autostart
↓
M4 PR Runner Foundation — resume preserved implementation
↓
M5 Review + Exact-head CI
↓
M6 Autonomous PR Delivery
↓
M7 WP Automatic Lifecycle
```

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

Legacy Work Packages and earlier Roadmap language remain historical evidence.
Where historical wording assigns semantic pre-Codex gates, Writer Lock execution
authority, authorization gating, or task-level PASS/FAIL/BLOCKED authority to
AICC, `AICC-V2-PROJECT-CONSTITUTION-001 v1.3` and
`AICC-V2-CANONICAL-EXECUTION-STANDARD-001 v1.3` supersede that wording for all
new implementation.

Historical results are not rewritten into different past results.
