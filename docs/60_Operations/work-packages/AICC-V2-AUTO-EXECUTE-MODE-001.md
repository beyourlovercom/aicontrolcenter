# AICC-V2-AUTO-EXECUTE-MODE-001: Auto Execute Mode

Status: PLANNED
Type: SELF_DEVELOPMENT_AUTOMATION
Prerequisite: `AICC-V2-GPT-BRIDGE-001` CLOSED; Terminal Handoff integration is
consumed where required by the normal terminal flow.

## Purpose

Provide an Owner setting, `自动执行模式`, with `OFF` and `ON` values. The
default is `OFF`. When enabled, a valid incoming `AICC_EXECUTION_V1` may
launch Codex only after the existing Canonical Execution Decision returns
`ALLOW`.

This Work Package is planning-only until explicitly authorized. Manual
execution remains unchanged when the setting is `OFF`.

## Frozen contract

- `AUTO_EXECUTE_MODE = OFF` by default.
- `OFF` preserves the current manual Owner launch flow.
- `ON` may auto-launch only when the existing Canonical Execution Decision is
  exactly `ALLOW`.
- `ALLOW_WITH_WARNING`, `OWNER_ACTION_REQUIRED`, and `HARD_BLOCK` never
  auto-launch.
- Consume the existing Canonical Execution Decision; do not recreate Formal
  WP, repository, branch, scope, authorization, worktree, Writer Lock,
  runtime-conflict, or execution-policy gates.
- One Instruction may auto-launch at most one Run.
- Refresh, reconnect, service restart, and Bridge redelivery must not replay
  the Instruction or create a duplicate Run.
- Auto Execute does not automate Human UAT, Owner approval, or WP closure.
- `SECOND_EXECUTION_AUTHORITY = 0`; `AUTO_EXECUTE_GATE_BYPASS_COUNT = 0`.

## Human UAT plan

One round, five items maximum:

1. `自动执行模式 = OFF` preserves the current manual Run flow.
2. `自动执行模式 = ON` with canonical `ALLOW` starts Codex automatically.
3. `OWNER_ACTION_REQUIRED` and `HARD_BLOCK` do not auto-start.
4. Refresh and reconnect do not create a duplicate Run.
5. A completed Run enters the normal Terminal Handoff flow without automatic
   Human UAT, Owner approval, or WP closure.

Each item is Owner-verified against the canonical decision, Runtime, and
persisted evidence. No UAT result is preselected by this plan.

## Acceptance gates

- `AUTO_EXECUTE_MODE_DEFAULT = OFF`
- `AUTO_EXECUTE_ALLOW_ONLY = PASS`
- `SECOND_EXECUTION_AUTHORITY = 0`
- `AUTO_EXECUTE_GATE_BYPASS_COUNT = 0`
- `AUTO_EXECUTION_PER_INSTRUCTION = 1`
- `PAGE_REFRESH_REEXECUTION = 0`
- `SERVICE_RESTART_REEXECUTION = 0`
- `BRIDGE_REDELIVERY_REEXECUTION = 0`
- `DUPLICATE_RUN = 0`
- `SILENT_REPLAY = 0`
- `AUTO_HUMAN_UAT = 0`
- `AUTO_OWNER_APPROVAL = 0`
- `AUTO_WP_CLOSE = 0`

## Non-goals

No Terminal Handoff implementation, Autopilot, second execution backend,
gate bypass, automatic ChatGPT Send, or remote delivery is included.
