# AI Control Center Living Roadmap

Roadmap-Revision: 5
Updated-At: 2026-08-20T14:50:00+08:00

## Current milestone

`M8 — AICC Lifecycle Intelligence`

Status: `ACTIVE`

AICC positioning: `Lifecycle Governance Control Center`

Roadmap and Current Context UI/projection behavior is governed by the frozen
canonical standard:
`docs/00_Governance/AICC-V2-UI-INTERACTION-STANDARD-001.md`.

AICC is not the primary Work Package creator. The governed product flow is:

Human → ChatGPT / GPT Web → GitHub WP + Roadmap → AICC Lifecycle Intelligence → Codex Execution → PR / CI / Delivery Evidence

## Authority

Current Authority: `fcd41386fafd6ee2083e73cdee71bee68a3a1e09`

Authority hierarchy:

1. Constitution: `AICC-V2-PROJECT-CONSTITUTION-001 v1.3` —
   `APPROVED_BASELINE`; highest project-level engineering authority.
2. Core Control Loop: `docs/00_Governance/AICC_V2_CORE_CONTROL_LOOP.md` —
   canonical current GPT Web → AICC → Codex Luna control-loop authority.
3. Specific execution and Roadmap governance:
   `docs/00_Governance/AICC-V2-CANONICAL-EXECUTION-STANDARD-001.md` and
   `docs/00_Governance/AICC-V2-UI-INTERACTION-STANDARD-001.md`.

Current specialized control-loop governance supersedes conflicting historical
planner-profile or runtime wording without replacing Constitution authority.

Closed Work Packages: `AICC-VISIBLE-SLICE-001`, `AICC-OPENSPEC-READMODEL-001`,
`AICC-CONTROL-LOOP-001A`, `AICC-V2-PR-RUNNER-001`

Current Work Package: `AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1`

Current implementation phase: `8.3 / Round 1 — Existing Status Authority Audit`

Next Work Package: `AICC_BRIDGE_RESULT_AUTO_RETURN_REGRESSION_V1`

AICC_SELF_DEVELOPMENT_READY: `NOT_YET_PASS`

`AICC-V2-PR-RUNNER-001`

## Active V2 Milestones

`CURRENT_ACTIVE_ROADMAP = TRUE`

### M1 — Control Surface Finalization
Work Packages: `AICC-V2-UI-WORKFLOW-001`, `AICC-V2-DUAL-PANEL-001`, `AICC-V2-VISUAL-IDENTITY-UNIFICATION-001`, `AICC-V2-RUNTIME-OBSERVER-001`

### M2 — Human UAT Control
Work Packages: `AICC-V2-HUMAN-UAT-001`

### M3 — First Usable Version Closure
Work Packages: `AICC-V2-SELF-DEVELOPMENT-UAT-001`

#### 3.4 — Fast Execution Path
Work Packages: `AICC-V2-FAST-EXECUTION-PATH-001`

#### 3.5 — GPT Bridge Contract
Work Packages: `AICC-V2-GPT-BRIDGE-001` — `CLOSED`; 001A and 001B complete,
Human UAT PASS, First Usable Version hard gates 5/5 PASS.

#### 3.6 — Terminal Handoff
Status: `PLANNED`
Work Packages: `AICC-V2-TERMINAL-HANDOFF-001` — `PLANNED`;
next executable self-development Work Package.

#### 3.7 — Auto Execute Mode
Work Packages: `AICC-V2-AUTO-EXECUTE-MODE-001` — `CLOSED`; Auto Execute V1
approved baseline after Human UAT PASS.

`AUTO_EXECUTE_ROADMAP_STATUS = CLOSED`
`CHROME_BRIDGE_STATUS = PAUSED`
`NEXT_MAINLINE_FOCUS = AICC-V2-WORKSPACE-CONTEXT-001`

#### 3.75 — Autopilot Until Human UAT
Work Packages: `AICC-V2-AUTOPILOT-UNTIL-UAT-001`

#### 3.8 — Runtime Operations
Work Packages: `AICC-V2-RUNTIME-OPERATIONS-001` — `CLOSED`; Runtime Operations
V1 is an approved baseline after Owner Human UAT PASS.

`RUNTIME_OPERATIONS_ROADMAP_STATUS = CLOSED`
`CHROME_BRIDGE_STATUS = PAUSED`
`NEXT_MAINLINE_FOCUS = AICC-V2-WORKSPACE-CONTEXT-001`

#### 3.85 — Workspace Context
Work Packages: `AICC-V2-WORKSPACE-CONTEXT-001` — `CLOSED`; Workspace Context V1
approved baseline after Owner Human UAT PASS.

`WORKSPACE_CONTEXT_ROADMAP_STATUS = CLOSED`
`NEXT_MAINLINE_FOCUS = AICC-V2-WORK-PACKAGE-LIFECYCLE-001`

#### 3.86 — Work Package Lifecycle
Work Packages: `AICC-V2-WORK-PACKAGE-LIFECYCLE-001` — `CLOSED`; Work Package
Lifecycle V1 and Human UAT Workspace V1 are approved baselines after Owner
Human UAT PASS.

`WORK_PACKAGE_LIFECYCLE_ROADMAP_STATUS = CLOSED`
`NEXT_MAINLINE_FOCUS = AICC-V2-PR-RUNNER-001`

#### 3.87 — Runtime Workspace V1 Freeze
Work Packages: `AICC-V2-RUNTIME-WORKSPACE-REFINE-001` — `CLOSED`; Runtime
Workspace V1 approved baseline after real Owner browser UAT PASS.

`RUNTIME_WORKSPACE_ROADMAP_STATUS = CLOSED`
`RUNTIME_WORKSPACE_V1 = APPROVED_BASELINE`
`HUMAN_UAT = PASS`
`CHROME_BRIDGE_STATUS = PAUSED`
`NEXT_MAINLINE_FOCUS = AICC-V2-PR-RUNNER-001`

#### 3.9 — Local Service Autostart
Work Packages: `AICC-V2-LOCAL-SERVICE-AUTOSTART-001`

### M4 — PR Runner Foundation
Work Packages: `AICC-V2-PR-RUNNER-001` — `CLOSED / HUMAN_UAT_PASS`.

PR Runner Foundation V1, PR Workspace, global repository PR read model,
Roadmap PR projection, one-to-many WP→PR rendering, real PR Canary projection,
reconnect idempotency, and historical PR preservation passed Owner Human UAT.

`M4_PR_RUNNER_FOUNDATION = APPROVED_BASELINE`
`M4_OWNER_UAT = PASS`
`M4_ROADMAP_STATUS = CLOSED`

#### 4.1 — GPT ↔ AICC ↔ Codex Closed Loop
Work Package: `AICC-V2-GPT-AICC-CODEX-CLOSED-LOOP-001`
Status: `WAITING_UAT / OWNER_UAT_PENDING / FUNCTIONALLY_USABLE_WITH_KNOWN_UI_LIMITATIONS`
Phase-state source: `LOCAL`
Current milestone: `M4.1 — GPT ↔ AICC ↔ Codex Closed Loop`
Current Work Package: `AICC-V2-GPT-AICC-CODEX-CLOSED-LOOP-001`
Current implementation phase: `Phase 6 core closed-loop path — functionally usable`
WP subtitle: `M4.1 practical closure · Human UAT not claimed`

Purpose: connect the already-delivered execution panel, GPT Bridge, Codex
runtime, result persistence, and ChatGPT return path into one reliable closed
loop without adding any AICC semantic decision authority.

Implemented architecture:

1. Unified Action Layer
   - `⌥⌘V` = 粘贴指令
   - `⌥⌘R` = 导入执行
   - `⌥⌘C` = 复制结果
   - Button / shortcut / Bridge / API converge on one canonical action layer.
2. GPT → AICC
   - executable Assistant content exposes compact `✦ AICC`;
   - one Owner click calls the canonical `importAndRun()` path.
3. AICC → Codex Pure Pass-through
   - no semantic pre-Codex gate;
   - Codex owns repository/task reasoning and execution outcome.
4. Codex → AICC Canonical Result
   - one durable `execution_id / result_id / result_hash` result source.
5. AICC → GPT Exactly-once Return
   - bind the originating conversation/message;
   - return each result at most once across rerender, refresh, reconnect, and
     restart.
6. Owner Human UAT
   - verify the full visible `GPT → AICC → Codex → AICC → GPT` loop;
   - verify manual shortcuts remain usable fallback.

### AICC-V2-GPT-AICC-CODEX-CLOSED-LOOP-001 Phase Plan

Phase 1 — Unified Action Layer [COMPLETE]
Phase 2 — GPT → AICC [COMPLETE]
Phase 3 — AICC → Codex Pure Pass-through [COMPLETE]
Phase 4 — Codex → AICC Canonical Result [COMPLETE]
Phase 5 — AICC → GPT Exactly-once Return [COMPLETE]
Phase 6 — Owner Human UAT [FUNCTIONALLY_USABLE_WITH_KNOWN_UI_LIMITATIONS; FULL_OWNER_HUMAN_UAT NOT CLAIMED]

Architecture constraints:

```text
AICC_TRANSPORT_ONLY = 1
AICC_DISPLAY_ONLY = 1
AICC_DECISION_AUTHORITY = 0
PRE_CODEX_SEMANTIC_GATE_COUNT = 0
AICC_PASS_FAIL_BLOCKED_AUTHORITY = CODEX
AICC_RESULT_REWRITE = 0
```

Known non-blocking UI limitations: executable surface detection, floating action rail
anchoring, ChatGPT DOM compatibility, and Bridge UI refinements may require later
stabilization. Blocking defect classes remain duplicate execution, duplicate result
insertion, wrong-conversation result return, canonical result loss/overwrite, and
infinite adapter retry/page freeze.

Future backlog: `AICC Web Bridge Stabilization` (not started in M4.1 closure).

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

Autonomous-delivery definition: Owner starts one Work Package / PR, and AICC
advances implementation, test/build, review, CI, remediation, and revalidation
through PR state progression to `READY_FOR_OWNER_UAT`, where Owner UAT remains
the human stop point. Autonomous merge and deploy are not included in this
milestone baseline.

#### 6.2 — Real Delivery Canary Validation

Work Packages: `AICC-M6.2-REAL-DELIVERY-CANARY-001`

Documentation-only validation target. The canary must provision an isolated
Delivery Context, worktree, deterministic delivery branch, and provider-bound
execution before creating and validating a real PR. It stops at
`READY_FOR_OWNER_UAT`; merge and release remain Owner-gated.

### M7 — Autonomous Development Operations
Status: `CORE_COMPLETE`

Phase 0 — WP Lifecycle Unification [COMPLETE]

`AICC-M7-PHASE-0-WP-LIFECYCLE-UNIFICATION-001` — `PASS`; Roadmap and new Work
Packages use one lifecycle through Delivery Provisioning, Delivery Context,
Execution Context, and the Provider Runtime.

- M7.0 WP Lifecycle Unification — `PASS`
- M7.1 Multi WP Scheduler — `PASS`
- M7.2 Provider Intelligence — `PASS`
- M7.3 Autonomous Execution Policy — `PASS`
- M7.4 Autonomous Remediation Loop — `PASS`
- M7.5 Autonomous Delivery Governance — `PASS`
- M7.6 Self Hosted M8 Bootstrap — `PASS`
- M7.7 Roadmap Milestone Alignment — `PASS`

#### 7.8 — AICC Proposal Intelligence
Definition: `Optional Autonomous Proposal Source`

AICC can analyze, suggest, explain, and evaluate risk. AICC cannot replace GPT
planning, become the GitHub Work Package source of truth, directly activate a
Work Package, or bypass Owner governance.

- M7.8.1 Auto Create UI Runtime — `PASS`
- M7.8.2 Auto Create Interaction Fix — `PASS`
- M7.8.3 Proposal Experience — `PASS`
- M7.8.4 Governance Hardening — `PASS`
- M7.8.5 Decision Risk Baseline Model — `PASS`
- M7.8.6 Risk Score Engine V2 — `PASS`
- M7.8.7 Optional Autonomous Proposal Source — `PASS`

### M8 — AICC Lifecycle Intelligence
Goal: establish one canonical lifecycle projection across AICC surfaces, restore reliable browser result return and GPT auto-loop continuation, complete the Work Package Homepage, and finish AICC V2 through a real end-to-end Owner Human UAT.

#### 8.0 — GitHub Lifecycle Intelligence
Status: `EXISTING`

#### 8.1 — Delivery Evidence Intelligence
Status: `EXISTING`

#### 8.2 — GPT ↔ Codex Bridge
Work Packages: `AICC-V2-GPT-CODEX-BRIDGE-001` — GPT ↔ Codex Execution Bridge

##### 8.2.1.8 — GPT Auto Control Loop Three-Round Human UAT
Status: `COMPLETE / HUMAN_UAT_PASS`

`M8.2.1.8_GPT_AUTO_CONTROL_LOOP_UAT = HUMAN_UAT_PASS`
`THREE_ROUND_AUTO_LOOP = PASS`
`AUTO_LOOP_V2_MINIMUM_CLOSED_LOOP = COMPLETE`

The closed three-round chapter proved Round 1 → Round 2 → Round 3 automatic
Luna execution, automatic feedback return to the same GPT Conversation,
terminal `AICC_OWNER_UAT_V1`, persisted `WAITING_OWNER_UAT`, no fourth Run, and
stable terminal projection with zero Owner actions after the Round 1 start.

This historical PASS remains authoritative evidence of the previously working
baseline and is not rewritten as FAIL by later regressions.

Current result-return / auto-loop regressions are tracked under M8.4.

#### 8.3 — Global Canonical Lifecycle Projection
Status: `CURRENT / ACTIVE`
Priority: `P0`
Work Package: `AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1`

Purpose: all lifecycle-facing surfaces consume one canonical lifecycle projection
derived from real runtime/execution evidence. AICC does not gain business decision
authority.

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

The Run lifecycle, feedback-delivery lifecycle, and GPT control-loop lifecycle
remain separate state dimensions.

Round Plan:

- Round 1 — Existing Status Authority Audit [NEXT]
- Round 2 — Canonical Lifecycle Resolver [PLANNED]
- Round 3 — Execution + Task Projection [PLANNED]
- Round 4 — Bridge Projection [PLANNED]
- Round 5 — Runtime Monitor + Global Feedback Projection [PLANNED]
- Round 6 — Cross-Surface Integration UAT + Freeze [PLANNED]

Regression Canary:

`AICC_EXACT_RUN_TERMINAL_STATE_PROPAGATION_REGRESSION_V1`

The canary is not a separate parallel architecture. It is the first real regression
case for M8.3 and must prove that the same exact `RUN_ID` reaches a consistent
terminal projection across Runtime, Execution, Task, and Bridge while preserving
independent feedback-delivery/control-loop states.

Expected canary terminal projection:

```text
Runtime      = COMPLETED
Execution    = COMPLETED
Task         = COMPLETED
Bridge       = COMPLETED
Result       = AVAILABLE
```

#### 8.4 — Bridge Result Return & Auto Loop Reliability
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

#### 8.5 — Work Package Homepage
Status: `PLANNED`
Priority: `P1`
Work Package: `WP-WORK-PACKAGE-Homepage-001`

M3.86 remains closed as the Work Package Lifecycle foundation. M8.5 builds the
WP Homepage on top of that frozen foundation and does not reopen M3.86.

Round Plan:

- Round 1 — Canonical Selection + Root Contract [PLANNED]
- Round 2 — Left WP Quick List [PLANNED]
- Round 3 — Center Global WP Workspace [PLANNED]
- Round 4 — Selection Sync + Existing WP Detail Routing [PLANNED]
- Round 5 — Right WP Context / Evidence [PLANNED]
- Round 6 — Integration Automated UAT [PLANNED]

Execution model:

```text
GPT → Round 1 execution → AICC_FEEDBACK_V1 → GPT
GPT → Round 2 execution → AICC_FEEDBACK_V1 → GPT
...
GPT → Round 6 execution → AICC_FEEDBACK_V1 → GPT
GPT → AICC_OWNER_UAT_V1
```

No single Codex execution may implement all six rounds.

#### 8.6 — Repository Contract Hygiene
Status: `BACKLOG`
Priority: `P2`
Work Package: `AICC_REPOSITORY_STALE_TEST_DEBT_CLEANUP_V1`

Purpose: reconcile historical tests and fixtures with current canonical production
contracts without letting unrelated stale assertions repeatedly block active product
work.

Policy:

- Real regression → active blocker.
- Stale historical assertion → repository test debt.
- Do not weaken valid tests to force green.

Known debt classes include historical Global Task/PR navigation assertions,
Current Context locate-label assertions, removed Phase 2 executable-surface
contracts, old ChatGPT Composer submission semantics, and Auto Submit Probe/UAT
Trigger assertions.

#### 8.7 — AICC V2 Final Real End-to-End Human UAT
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

AICC V2 may not be frozen or transitioned to V3 until this complete real Human
UAT passes.

### M9 — Multi Repository & Multi Project Operations
Goals: Project Registry, Repository Registry, Multi Worktree, and Cross Project
Dependency Intelligence.

### M10 — Autonomous Development Operations
Goals: Issue Intelligence, Autonomous Proposal Loop, Autonomous Remediation,
and Continuous Delivery Intelligence.

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

AICC V2 may not be frozen or transitioned to AICC V3 until the complete real
End-to-End Human UAT has passed:

Requirement → GPT → Formal WP → AICC → PR Plan → Tasks → Codex Luna → AICC
Feedback → Same GPT Conversation → next Tasks → Owner UAT → remediation if
needed → WP Complete.

`AICC_V2_FINAL_E2E_HUMAN_UAT = REQUIRED`

## Governance baseline

`AICC_DECISION_AUTHORITY = 0`

The active governance order is Constitution → Core Control Loop → specific
Execution / Roadmap Governance. Specialized documents govern their bounded
surfaces and do not remove or replace Constitution metadata.

Roadmap and Current Context visual projection is governed by the frozen
canonical baseline
`docs/00_Governance/AICC-V2-UI-INTERACTION-STANDARD-001.md`. Roadmap status and
progress must use this Markdown document's explicit metadata and must not be
independently inferred or calculated by AICC.

AICC may analyze, recommend, explain, and project. AICC may not self approve,
override Owner, replace GPT planning, bypass GitHub Source of Truth, or release
automatically.

## Legacy Historical Milestones — Non-Authoritative Historical Traceability

`AUTHORITY = 0`
`ACTIVE_ROADMAP_ENTITY_SOURCE = NO`
`ROADMAP_PROJECTION_PARTICIPATION = NONE`

Everything after this boundary is historical evidence only. It cannot define
current Milestone or Phase state, override an active entity, or authorize work.

### Historical M1: Visible Foundation

Work Packages:
`AICC-VISIBLE-SLICE-001`,
`AICC-OPENSPEC-READMODEL-001`

### Historical M2: Authority And Workspace Control

Work Packages:
`AICC-CONTROL-LOOP-001A`,
`AICC-POST-MERGE-UAT-001`,
`AICC-POST-MERGE-UAT-001-R1`,
`AICC-POST-MERGE-UAT-001-R2`,
`AICC-CODEX-ONLY-MIGRATION-001`,
`AICC-CONTROL-LOOP-001B`

### Historical M3: Runtime

Formal Work Packages:

`AICC-V2-001` — `PASS`
`AICC-V2-002` — `PASS`
`AICC-V2-003` — `PASS`
`AICC-V2-004` — `PASS`
`AICC-V2-005` — `WAITING_OWNER_HUMAN_UAT`
`AICC-V2-PR-RUNNER-001` — `READY_FOR_OWNER_AUTHORIZATION` / bootstrap self-development Work Package

Future Work Packages:
`AICC-CONTROL-LOOP-001C`,
`AICC-CONTROL-LOOP-001D`,
`AICC-CONTROL-LOOP-001E`,
`AICC-CONTROL-LOOP-001F`

## Historical Delivery Sequence

1. AICC-VISIBLE-SLICE-001 — closed installable macOS visual app.
2. AICC-OPENSPEC-READMODEL-001 — closed local OpenSpec read model.
3. AICC-CONTROL-LOOP-001A — closed authority, workspace sync, and next Work Package resolver.
4. AICC-POST-MERGE-UAT-001 — 001A closeout, roadmap authority update, and macOS UAT build.
5. AICC-POST-MERGE-UAT-001-R1 — first Human UAT remediation (Human UAT failed).
6. AICC-POST-MERGE-UAT-001-R2 — Human UAT remediation remains unresolved and blocked by the Codex-only architecture migration; it is not closed and Human UAT remains pending.
7. AICC-CODEX-ONLY-MIGRATION-001 — historical Codex-only migration; its
   configured `sol` runtime wording is superseded for the V2 Core Control Loop
   by `docs/00_Governance/AICC_V2_CORE_CONTROL_LOOP.md`.
8. 001B — OpenSpec Binding (planned, owner authorization not authorized).
9. AICC-V2-VISUAL-IDENTITY-UNIFICATION-001 — Visual Identity Unification (ready for Owner authorization; visual remediation only).
11. AICC-V2-SELF-RELOAD-RESILIENCE-001 — Self-Reload Resilience (future; no implementation started).
12. 001D — Owner Authorization & Governed Codex Runtime (future placeholder; no formal WP record).
13. AICC_SELF_DEVELOPMENT_READY — `NOT_YET_PASS`; requires Owner Human UAT.
14. AICC-V2-PR-RUNNER-001 — AICC PR Runner Foundation (ready for Owner authorization; bootstrap self-development Work Package).
15. 001F — Autonomous Delivery Loop (future placeholder; no formal WP record).
16. AICC-V2-GPT-BRIDGE-001 — closed GPT Bridge 001A/001B and First Usable
    Version hard gates 5/5; remaining Composer fallback ambiguity is a
    non-blocking P1 backlog finding.
17. AICC-V2-TERMINAL-HANDOFF-001 — `PLANNED`; next executable WP.
18. AICC-V2-AUTO-EXECUTE-MODE-001 — `CLOSED`; Auto Execute V1 approved
    baseline after Human UAT PASS.
19. AICC-V2-RUNTIME-OPERATIONS-001 — `CLOSED`; Runtime Operations V1 approved
    baseline after Owner Human UAT PASS.
20. AICC-V2-CHROME-BRIDGE-REBUILD-001 — `PAUSED / HUMAN_UAT_NOT_COMPLETED`;
    minimal V2 Chrome Bridge, separate from the frozen Legacy extension.
21. AICC-V2-RUNTIME-WORKSPACE-REFINE-001 — `CLOSED`; Runtime Workspace V1
    frozen after real Owner browser UAT PASS.

## Historical Self-Development Target

After both Work Packages PASS, `AICC_SELF_DEVELOPMENT_MODE = ENABLED`.
AICC responsibilities remain limited to instruction transport, Codex process
launch, runtime observation, evidence and terminal persistence,
Run/Instruction/Chat correlation, report return, and Owner-facing runtime UI.

`ONE_REPOSITORY_MANY_PARALLEL_RUNS = YES`
`ONE_REPOSITORY_MANY_PARALLEL_PRS = YES`

`NEXT_MAINLINE_FOCUS = AICC-V2-PR-RUNNER-001`
`NEXT_MAINLINE_FOCUS_LABEL = PR Runner`

## Historical Safety-State Record

The application is authority-first and Codex-only. It uses fixed typed repository and Codex operations, fails closed on unknown authority, requires evidence-bound Owner authorization and explicit confirmation, and never exposes arbitrary shell input.

## V2 baseline closure

`AICC-V2-UI-WORKFLOW-001` — `OWNER_UI_UAT = PASS`; `STATUS = COMPLETE`.

`AICC_ENTITY_CONTEXT_FOUNDATION` — `STATUS = APPROVED_BASELINE`; frozen authority HEAD: `9ebde86f019b831d41158fe38e3be7078bd02e53`.

The historical bootstrap formalization label remains only as a documented legacy compatibility note. The Entity Context Foundation is not reopened by the Dual Panel Work Package.

The build is an unsigned/ad-hoc UAT artifact only. It does not create a Release or Deploy. AICC-V2-005 remains `WAITING_OWNER_HUMAN_UAT`; only the Owner can produce the final Human UAT PASS. `AICC_SELF_DEVELOPMENT_READY` remains `NOT_YET_PASS`. `AICC-V2-PR-RUNNER-001` is ready for Owner authorization as the bootstrap self-development Work Package; no PR Runner code is implemented here.

## Historical Bootstrap Trace: Former M8 Platform Bootstrap

`AUTHORITY = 0`
`ACTIVE_MILESTONE_DEFINITION = NO`

Former identity: `M8 — Autonomous Product Engineering Platform Bootstrap`.

The former M8 Work Packages were to be created through the AICC Work Package
lifecycle only.

- M8.0 Multi Repository Workspace
- M8.1 Project Registry
- M8.2 Team Ownership
- M8.3 Cross Project Development
- M8.4 Production Governance

Bootstrap state: `SELF_HOSTED_BOOTSTRAP` until all required systems and gates
are ready; then `M8_READY`. AICC cannot approve itself, merge its own PRs, or
release production.

## Historical Self-Development Trace: Former M11 / M11.5

`AUTHORITY = 0`
`ACTIVE_MILESTONE_DEFINITION = NO`

Former identities: `M11 — AICC Self Development` and
`M11.5 — AICC Self Development Real Run`.

Historical Work Packages:

- `AICC-M11.0-SELF-DEVELOPMENT-BOOTSTRAP-001`
- `AICC-M11.1-SELF-OPTIMIZATION-LOOP-001`
- `AICC-M11.2-AGENT-ORCHESTRATION-001`
- `AICC-M11.3-AGENT-MEMORY-KNOWLEDGE-GRAPH-001`
- `AICC-M11.4-FULL-AUTONOMOUS-DELIVERY-VALIDATION-001`
- `AICC-M11.5-REAL-RUN-001`

This lineage records the former self-development and real-run bootstrap scope;
it has no current Roadmap or execution authority.

Historical scope: 建立 AICC 自我开发、自我优化、Agent Orchestration、Knowledge
Graph 与完整 Autonomous Delivery Validation 能力，并验证 AICC 是否可以根据
Living Roadmap 自动驱动自身真实开发。
