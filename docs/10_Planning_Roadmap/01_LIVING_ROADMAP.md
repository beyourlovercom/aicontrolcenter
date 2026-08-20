# AI Control Center Living Roadmap

Roadmap-Revision: 4
Updated-At: 2026-08-20T10:57:00+08:00

## Current milestone

`M8 — AICC Lifecycle Intelligence`

Status: `ACTIVE`

AICC positioning: `Lifecycle Governance Control Center`

Roadmap and Current Context UI/projection behavior is governed by the frozen canonical standard:
`docs/00_Governance/AICC-V2-UI-INTERACTION-STANDARD-001.md`.

AICC is not the primary Work Package creator. The governed product flow is:

Human → ChatGPT / GPT Web → GitHub WP + Roadmap → AICC Lifecycle Intelligence → Codex Execution → PR / CI / Delivery Evidence

## Authority

Current Authority: `fcd41386fafd6ee2083e73cdee71bee68a3a1e09`

Authority hierarchy:

1. Constitution: `AICC-V2-PROJECT-CONSTITUTION-001 v1.3` — `APPROVED_BASELINE`; highest project-level engineering authority.
2. Core Control Loop: `docs/00_Governance/AICC_V2_CORE_CONTROL_LOOP.md` — canonical current GPT Web → AICC → Codex Luna control-loop authority.
3. Specific execution and Roadmap governance: `docs/00_Governance/AICC-V2-CANONICAL-EXECUTION-STANDARD-001.md` and `docs/00_Governance/AICC-V2-UI-INTERACTION-STANDARD-001.md`.

Current specialized control-loop governance supersedes conflicting historical planner-profile or runtime wording without replacing Constitution authority.

Closed Work Packages: `AICC-VISIBLE-SLICE-001`, `AICC-OPENSPEC-READMODEL-001`, `AICC-CONTROL-LOOP-001A`, `AICC-V2-PR-RUNNER-001`

Current Work Package: `AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1`

Current implementation phase: `M8.3 / Round 1 — Existing Status Authority Audit`

Next Work Package: `AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1`

AICC_SELF_DEVELOPMENT_READY: `NOT_YET_PASS`

## Active V2 Milestones

`CURRENT_ACTIVE_ROADMAP = TRUE`

### M1 — Control Surface Finalization
Work Packages: `AICC-V2-UI-WORKFLOW-001`, `AICC-V2-DUAL-PANEL-001`, `AICC-V2-VISUAL-IDENTITY-UNIFICATION-001`, `AICC-V2-RUNTIME-OBSERVER-001`

### M2 — Human UAT Control
Work Packages: `AICC-V2-HUMAN-UAT-001`

### M3 — First Usable Version Closure
Work Packages: `AICC-V2-SELF-DEVELOPMENT-UAT-001`

### M3.4 — Fast Execution Path
Work Packages: `AICC-V2-FAST-EXECUTION-PATH-001`

### M3.5 — GPT Bridge Contract
Work Packages: `AICC-V2-GPT-BRIDGE-001` — `CLOSED`; 001A and 001B complete, Human UAT PASS, First Usable Version hard gates 5/5 PASS.

### M3.6 — Terminal Handoff
Status: `PLANNED`
Work Packages: `AICC-V2-TERMINAL-HANDOFF-001` — `PLANNED`; next executable self-development Work Package.

### M3.7 — Auto Execute Mode
Work Packages: `AICC-V2-AUTO-EXECUTE-MODE-001` — `CLOSED`; Auto Execute V1 approved baseline after Human UAT PASS.

`AUTO_EXECUTE_ROADMAP_STATUS = CLOSED`
`CHROME_BRIDGE_STATUS = PAUSED`
`NEXT_MAINLINE_FOCUS = AICC-V2-WORKSPACE-CONTEXT-001`

### M3.75 — Autopilot Until Human UAT
Work Packages: `AICC-V2-AUTOPILOT-UNTIL-UAT-001`

### M3.8 — Runtime Operations
Work Packages: `AICC-V2-RUNTIME-OPERATIONS-001` — `CLOSED`; Runtime Operations V1 is an approved baseline after Owner Human UAT PASS.

`RUNTIME_OPERATIONS_ROADMAP_STATUS = CLOSED`
`CHROME_BRIDGE_STATUS = PAUSED`
`NEXT_MAINLINE_FOCUS = AICC-V2-WORKSPACE-CONTEXT-001`

### M3.85 — Workspace Context
Work Packages: `AICC-V2-WORKSPACE-CONTEXT-001` — `CLOSED`; Workspace Context V1 approved baseline after Owner Human UAT PASS.

`WORKSPACE_CONTEXT_ROADMAP_STATUS = CLOSED`
`NEXT_MAINLINE_FOCUS = AICC-V2-WORK-PACKAGE-LIFECYCLE-001`

### M3.86 — Work Package Lifecycle
Work Packages: `AICC-V2-WORK-PACKAGE-LIFECYCLE-001` — `CLOSED`; Work Package Lifecycle V1 and Human UAT Workspace V1 are approved baselines after Owner Human UAT PASS.

`WORK_PACKAGE_LIFECYCLE_ROADMAP_STATUS = CLOSED`
`WORK_PACKAGE_EXISTENCE_AUTHORITY = CANONICAL_ROADMAP_STRUCTURE`
`WORK_PACKAGE_ID_PREFIX_IS_AUTHORITY = NO`

### M3.87 — Runtime Workspace V1 Freeze
Work Packages: `AICC-V2-RUNTIME-WORKSPACE-REFINE-001` — `CLOSED`; Runtime Workspace V1 approved baseline after real Owner browser UAT PASS.

`RUNTIME_WORKSPACE_ROADMAP_STATUS = CLOSED`
`RUNTIME_WORKSPACE_V1 = APPROVED_BASELINE`
`HUMAN_UAT = PASS`

### M3.9 — Local Service Autostart
Work Packages: `AICC-V2-LOCAL-SERVICE-AUTOSTART-001`

### M4 — PR Runner Foundation
Work Packages: `AICC-V2-PR-RUNNER-001` — `CLOSED / HUMAN_UAT_PASS`.

PR Runner Foundation V1, PR Workspace, global repository PR read model, Roadmap PR projection, one-to-many WP→PR rendering, real PR Canary projection, reconnect idempotency, and historical PR preservation passed Owner Human UAT.

`M4_PR_RUNNER_FOUNDATION = APPROVED_BASELINE`
`M4_OWNER_UAT = PASS`
`M4_ROADMAP_STATUS = CLOSED`

### M4.1 — GPT ↔ AICC ↔ Codex Closed Loop
Work Package: `AICC-V2-GPT-AICC-CODEX-CLOSED-LOOP-001`
Status: `WAITING_UAT / OWNER_UAT_PENDING / FUNCTIONALLY_USABLE_WITH_KNOWN_UI_LIMITATIONS`

Purpose: connect the already-delivered execution panel, GPT Bridge, Codex runtime, result persistence, and ChatGPT return path into one reliable closed loop without adding any AICC semantic decision authority.

Implemented architecture:

1. Unified Action Layer
2. GPT → AICC
3. AICC → Codex Pure Pass-through
4. Codex → AICC Canonical Result
5. AICC → GPT Exactly-once Return
6. Owner Human UAT

Architecture constraints:

```text
AICC_TRANSPORT_ONLY = 1
AICC_DISPLAY_ONLY = 1
AICC_DECISION_AUTHORITY = 0
PRE_CODEX_SEMANTIC_GATE_COUNT = 0
AICC_PASS_FAIL_BLOCKED_AUTHORITY = CODEX
AICC_RESULT_REWRITE = 0
```

### M5 — Review + Exact-head CI
Work Packages: `AICC-V2-REVIEW-EXACT-HEAD-CI-001`
Status: `ACTIVE / OWNER_AUTHORIZED`
Current implementation phase: `Phase 6 — Owner Human UAT`

### M6 — Autonomous PR Delivery
Work Packages: `AICC-V2-AUTONOMOUS-PR-DELIVERY-001`
Status: `CURRENT`
Canonical phase plan: `PLAN A`

### AICC-V2-AUTONOMOUS-PR-DELIVERY-001 Phase Plan

Phase 1 — Delivery Workspace Provisioning + Auto Stage Foundation [COMPLETE]
Phase 2 — Automatic Review Integration [COMPLETE]
Phase 3 — Automatic CI Integration [COMPLETE]
Phase 4 — FAIL → Automatic Remediation [COMPLETE]
Phase 5 — New Head → Automatic Revalidation [COMPLETE]
Phase 6 — Automatic PR State Progression [COMPLETE]
Phase 7 — Stop Condition + Retry Budget [COMPLETE]
Phase 8 — READY_FOR_OWNER_UAT [CURRENT]

### M6.2 — Real Delivery Canary Validation
Work Packages: `AICC-M6.2-REAL-DELIVERY-CANARY-001`

### M7 — Autonomous Development Operations
Status: `CORE_COMPLETE`

- M7.0 WP Lifecycle Unification — `PASS`
- M7.1 Multi WP Scheduler — `PASS`
- M7.2 Provider Intelligence — `PASS`
- M7.3 Autonomous Execution Policy — `PASS`
- M7.4 Autonomous Remediation Loop — `PASS`
- M7.5 Autonomous Delivery Governance — `PASS`
- M7.6 Self Hosted M8 Bootstrap — `PASS`
- M7.7 Roadmap Milestone Alignment — `PASS`

### M7.8 — AICC Proposal Intelligence
Definition: `Optional Autonomous Proposal Source`

- M7.8.1 Auto Create UI Runtime — `PASS`
- M7.8.2 Auto Create Interaction Fix — `PASS`
- M7.8.3 Proposal Experience — `PASS`
- M7.8.4 Governance Hardening — `PASS`
- M7.8.5 Decision Risk Baseline Model — `PASS`
- M7.8.6 Risk Score Engine V2 — `PASS`
- M7.8.7 Optional Autonomous Proposal Source — `PASS`

### M8 — AICC Lifecycle Intelligence
Goal: establish one canonical lifecycle projection across AICC surfaces, restore reliable browser result return and GPT auto-loop continuation, complete the Work Package Homepage, and finish AICC V2 through a real end-to-end Owner Human UAT.

#### M8.0 — GitHub Lifecycle Intelligence
Status: `EXISTING`

#### M8.1 — Delivery Evidence Intelligence
Status: `EXISTING`

#### M8.2 — GPT ↔ Codex Bridge
Work Packages: `AICC-V2-GPT-CODEX-BRIDGE-001`

##### M8.2.1.8 — GPT Auto Control Loop Three-Round Human UAT
Status: `COMPLETE / HUMAN_UAT_PASS`

`M8.2.1.8_GPT_AUTO_CONTROL_LOOP_UAT = HUMAN_UAT_PASS`
`THREE_ROUND_AUTO_LOOP = PASS`
`AUTO_LOOP_V2_MINIMUM_CLOSED_LOOP = COMPLETE`

The closed three-round chapter remains authoritative historical evidence that Round 1 → Round 2 → Round 3 automatic execution, automatic feedback return to the same GPT Conversation, terminal `AICC_OWNER_UAT_V1`, persisted `WAITING_OWNER_UAT`, no fourth Run, and zero Owner actions after Round 1 start all passed at the time of closure.

This historical PASS is not rewritten as FAIL by later regressions.

Current regression remediation is tracked under M8.4.

#### M8.3 — Global Canonical Lifecycle Projection
Status: `CURRENT / ACTIVE`
Priority: `P0`

Work Package: `AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1`

Purpose: all lifecycle-facing surfaces consume one canonical lifecycle projection derived from real runtime/execution evidence. AICC does not gain business decision authority.

Canonical architecture:

```text
Runtime durable truth / canonical execution evidence
        ↓
Global Canonical Lifecycle Resolver
        ↓
Exact Run Lifecycle Projection
        ↓
Execution / Task / Bridge / Runtime Monitor / Global Feedback
```

The Run lifecycle, feedback-delivery lifecycle, and GPT control-loop lifecycle remain separate state dimensions.

Round Plan:

- Round 1 — Existing Status Authority Audit [NEXT]
- Round 2 — Canonical Lifecycle Resolver [PLANNED]
- Round 3 — Execution + Task Projection [PLANNED]
- Round 4 — Bridge Projection [PLANNED]
- Round 5 — Runtime Monitor + Global Feedback Projection [PLANNED]
- Round 6 — Cross-Surface Integration UAT + Freeze [PLANNED]

Regression Canary:

`AICC_EXACT_RUN_TERMINAL_STATE_PROPAGATION_REGRESSION_V1`

The canary is not a separate parallel architecture. It is the first real regression case for M8.3 and must prove that the same exact `RUN_ID` reaches a consistent terminal projection across Runtime, Execution, Task, and Bridge while preserving independent feedback-delivery/control-loop states.

Expected canary terminal projection:

```text
Runtime      = COMPLETED
Execution    = COMPLETED
Task         = COMPLETED
Bridge       = COMPLETED
Result       = AVAILABLE
```

#### M8.4 — Bridge Result Return & Auto Loop Reliability
Status: `PLANNED / NEXT`
Priority: `P0`

Work Packages, in strict order:

1. `AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1`
2. `AICC_AUTO_LOOP_FEEDBACK_DELIVERY_AND_TURN_CORRELATION_V1`

M8.4.1 restores the previously-working base transport contract:

```text
Bridge-originated execution
→ AICC / Codex
→ canonical result
→ exact bound GPT Conversation
→ canonical GPT Composer
→ automatic result submit
```

M8.4.2 then restores and validates the higher-level GPT-controlled multi-round loop:

```text
GPT Round N
→ AICC
→ Codex Round N only
→ AICC_FEEDBACK_V1
→ same bound GPT Conversation
→ GPT analysis
→ Round N+1 AICC_EXECUTION_V1
→ automatic IMPORT_AND_RUN
```

Codex may not self-advance to the next Round. GPT remains the next-action authority.

#### M8.5 — Work Package Homepage
Status: `PLANNED`
Priority: `P1`

Work Package: `WP-WORK-PACKAGE-Homepage-001`

M3.86 remains closed as the Work Package Lifecycle foundation. M8.5 builds the WP Homepage on top of that frozen foundation and does not reopen M3.86.

Round Plan:

- Round 1 — Canonical Selection + Root Contract [PLANNED]
- Round 2 — Left WP Quick List [PLANNED]
- Round 3 — Center Global WP Workspace [PLANNED]
- Round 4 — Selection Sync + Existing WP Detail Routing [PLANNED]
- Round 5 — Right WP Context / Evidence [PLANNED]
- Round 6 — Integration Automated UAT [PLANNED]

Execution model for M8.5:

```text
GPT → Round 1 execution → AICC_FEEDBACK_V1 → GPT
GPT → Round 2 execution → AICC_FEEDBACK_V1 → GPT
...
GPT → Round 6 execution → AICC_FEEDBACK_V1 → GPT
GPT → AICC_OWNER_UAT_V1
```

No single Codex execution may implement all six rounds.

#### M8.6 — Repository Contract Hygiene
Status: `BACKLOG`
Priority: `P2`

Work Package: `AICC_REPOSITORY_STALE_TEST_DEBT_CLEANUP_V1`

Purpose: reconcile historical tests and fixtures with current canonical production contracts without letting unrelated stale assertions repeatedly block active product work.

Policy:

- Real regression → active blocker.
- Stale historical assertion → repository test debt.
- Do not weaken valid tests to force green.

Known debt classes include historical Global Task/PR navigation assertions, Current Context locate-label assertions, removed Phase 2 executable-surface contracts, old ChatGPT Composer submission semantics, and Auto Submit Probe/UAT Trigger assertions.

#### M8.7 — AICC V2 Final Real End-to-End Human UAT
Status: `PLANNED / FINAL_V2_GATE`
Priority: `P0 FINAL GATE`

Gate: `AICC_V2_FINAL_E2E_HUMAN_UAT`

Required real flow:

```text
Owner Requirement
→ GPT Web planning
→ Formal Work Package + Living Roadmap
→ AICC projection
→ PR / Task planning
→ Codex execution
→ AICC canonical result
→ automatic feedback to same GPT Conversation
→ GPT next action / remediation
→ Owner UAT
→ WP Complete
```

AICC V2 may not be frozen or transitioned to V3 until this complete real Human UAT passes.

### M9 — Multi Repository & Multi Project Operations
Goals: Project Registry, Repository Registry, Multi Worktree, and Cross Project Dependency Intelligence.

### M10 — Autonomous Development Operations
Goals: Issue Intelligence, Autonomous Proposal Loop, Autonomous Remediation, and Continuous Delivery Intelligence.

## AICC V2 Core Control Loop Baseline

Status: `OWNER_APPROVED_BASELINE`

Canonical authority: `docs/00_Governance/AICC_V2_CORE_CONTROL_LOOP.md`

Core:

- `ONE_WP_ONE_GPT_CONVERSATION = TRUE`
- `GPT_WEB = PLANNING_AND_NEXT_ACTION_AUTHORITY`
- `CODEX_DEFAULT_EXECUTOR = LUNA`
- `AICC_DECISION_AUTHORITY = 0`

Explicitly rejected for V2:

- `NO_PLANNER_CLI_PER_TASK = TRUE`
- `NO_AUTOMATIC_SOL_LUNA_PLANNER_SWITCHING = TRUE`
- `NO_COMPLEX_LEVEL_ROUTING = TRUE`

V2 Final Closure Gate:

AICC V2 may not be frozen or transitioned to AICC V3 until the complete real End-to-End Human UAT has passed.

## Governance baseline

`AICC_DECISION_AUTHORITY = 0`

The active governance order is Constitution → Core Control Loop → specific Execution / Roadmap Governance.

Roadmap and Current Context visual projection is governed by the frozen canonical baseline `docs/00_Governance/AICC-V2-UI-INTERACTION-STANDARD-001.md`. Roadmap status and progress must use this Markdown document's explicit metadata and must not be independently inferred or calculated by AICC.

AICC may analyze, recommend, explain, and project. AICC may not self approve, override Owner, replace GPT planning, bypass GitHub Source of Truth, or release automatically.

## Legacy Historical Milestones — Non-Authoritative Historical Traceability

`AUTHORITY = 0`
`ACTIVE_ROADMAP_ENTITY_SOURCE = NO`
`ROADMAP_PROJECTION_PARTICIPATION = NONE`

Historical milestone details remain non-authoritative evidence and do not override the Active V2 Milestones above.

## Historical Self-Development Target

AICC responsibilities remain limited to instruction transport, Codex process launch, runtime observation, evidence and terminal persistence, Run/Instruction/Chat correlation, report return, and Owner-facing runtime UI.

`ONE_REPOSITORY_MANY_PARALLEL_RUNS = YES`
`ONE_REPOSITORY_MANY_PARALLEL_PRS = YES`

`NEXT_MAINLINE_FOCUS = AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1`
`NEXT_MAINLINE_FOCUS_LABEL = Global Canonical Lifecycle Projection`
