# AICC-V2-GPT-CODEX-BRIDGE-001: GPT ↔ Codex Execution Bridge

Type: `WORK_PACKAGE`
Milestone: `M8 — AICC Lifecycle Intelligence`
Phase family: `M8.2 — GPT ↔ Codex Bridge`
Status: `ACTIVE`

## Goal

Provide the single formal Roadmap owner for GPT Web ↔ AICC ↔ Codex Bridge development, runtime transport, result return, and related lifecycle evidence.

## Scope

The Work Package owns Bridge implementation tasks, audits, remediations, runtime execution, result projection, model selection, and Task / Work Package / Roadmap binding normalization.

M8.2.1.x identities are Tasks within this Work Package. They are not independent formal Work Packages and do not independently own Roadmap authority.

## Task family

- `M8.2.1` — Bridge Action Extension
- `M8.2.1.1` — Bridge Action Extension Remediation
- `M8.2.1.3` — Clipboard Codex Execution
- `M8.2.1.4` — Codex Result Insert Reliability
- `M8.2.1.5` — Bridge Runtime Result Panel
- `M8.2.1.6` — Bridge Codex Model Selector
- `M8.2.1.7` — Task / WP / Roadmap Binding Normalization
- `M8.2.1.8` — GPT Auto Control Loop Three-Round Human UAT — `CLOSED / HUMAN_UAT_PASS`

Historical instruction IDs, pseudo-WP references, Run IDs, Result IDs, timestamps, and evidence remain immutable historical identities. Canonical ownership is expressed separately as `formal_wp_id: AICC-V2-GPT-CODEX-BRIDGE-001`.

## M8.2.1.8 closure

`M8.2.1.8_GPT_AUTO_CONTROL_LOOP_UAT = HUMAN_UAT_PASS`

The real Owner browser UAT completed three automatic Luna executions and three
automatic `AICC_FEEDBACK_V1` returns after one explicit Round 1 start. GPT then
emitted `AICC_OWNER_UAT_V1`; AICC persisted `WAITING_OWNER_UAT`; no fourth Run
was created; and the terminal projection remained stable.

The final Round 3 evidence is instruction
`aicc-auto-loop-final-uat-round-3-after-8.10a-001`, Run
`run-1786876841260-1nvtwl`, status `COMPLETED`, exit code `0`. Exact Round 1 and
Round 2 identities remain recorded in the existing M8.2.1.8 task evidence.

The supporting M8.2.1.8.8A, M8.2.1.8.8B, M8.2.1.8.9, M8.2.1.8.9A, and
M8.2.1.8.10A remediations are frozen PASS baselines. The proven direct ChatGPT
auto-submit primitive remains `REAL_OWNER_UAT_PASS`.

This closes the M8.2.1.8 chapter only. The parent Bridge Work Package remains
`ACTIVE` for separately authorized M8.2 work and does not infer completion of
the broader M8 milestone.

## Dependencies

- Canonical Living Roadmap registration under M8
- Durable Inbox, Task Registry, Runtime, and Outbox persistence
- Existing GPT DOM and Chrome Bridge adapters

## Acceptance Criteria

- The Living Roadmap projects exactly one M8 Bridge Work Package.
- Known M8.2.1.x records resolve as Tasks under this formal Work Package.
- Unknown Task references remain unmapped and never fabricate milestone ownership.
- Reconciliation preserves all historical execution and result identities and is idempotent.
- Existing Bridge exactly-once and Owner-control guarantees remain intact.

## Risks

- Legacy pseudo-WP records may otherwise appear as independent Roadmap entities.
- Runtime-derived ownership may otherwise invent milestone authority.
- Non-idempotent migration could duplicate Tasks or damage historical evidence.

## Allowed

- Additive binding metadata and idempotent reconciliation
- Roadmap, Task, runtime, result, and UI projection normalization
- Focused regression coverage

## Forbidden

- Deleting or renumbering historical Tasks, Runs, Results, or evidence
- Creating Roadmap Work Packages from runtime records
- Inferring milestone ownership from M8.2.1.x string patterns
- Automatic approval, merge, release, or AICC decision authority

`AICC_DECISION_AUTHORITY = 0`
