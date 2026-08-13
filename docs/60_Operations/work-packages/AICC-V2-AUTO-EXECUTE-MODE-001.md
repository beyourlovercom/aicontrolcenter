# AICC-V2-AUTO-EXECUTE-MODE-001

Status: IMPLEMENTED / MACHINE_VALIDATED / HUMAN_UAT_PENDING
Type: SELF_DEVELOPMENT_AUTOMATION
Prerequisite: `AICC-V2-TERMINAL-HANDOFF-001` PASS

## Purpose

Provide the Owner setting `自动执行模式` with `OFF` and `ON` values. The
default is `OFF`. When `ON`, an incoming task causes AICC to launch Codex
automatically. AICC remains a pass-through Codex Control Plane and does not
duplicate Codex repository, Git, worktree, scope, or implementation reasoning.

## Frozen scope

- `AUTO_EXECUTE_MODE_DEFAULT = OFF`
- `AUTO_EXECUTION_PER_INSTRUCTION = 1`
- `PAGE_REFRESH_REEXECUTION = 0`
- `SERVICE_RESTART_REEXECUTION = 0`
- `BRIDGE_REDELIVERY_REEXECUTION = 0`
- `DUPLICATE_RUN = 0`
- `SILENT_REPLAY = 0`
- `AUTO_HUMAN_UAT = 0`
- `AUTO_OWNER_APPROVAL = 0`
- `AUTO_WP_CLOSE = 0`
- `AUTO_SEND_CHATGPT_MESSAGE = 0`
- `AUTO_EXECUTE_DEFAULT = OFF`
- `AUTO_EXECUTE_OWNER_CONTROLLABLE = 1`
- `AICC_PASS_THROUGH_EXECUTION = 1`
- `PRE_CODEX_SEMANTIC_GATE_COUNT = 0`
- `AUTO_EXECUTE_NEW_SCHEDULER = 0`
- `REPOSITORY_GLOBAL_AUTO_EXECUTE_LOCK = 0`
- `MULTI_CODEX_RUNTIME = PASS`
- `AUTO_EXECUTE_FAILURE_RETRY_LOOP = 0`
- `AUTO_RUN_USES_EXISTING_RUNTIME = 1`

No automatic authorization, Human UAT, WP closure, ChatGPT Send, Autopilot,
or second execution authority is included.

## Human UAT plan

Maximum five items: verify the `OFF` default, one automatic launch when
enabled, no launch for unauthorized or blocked instructions, replay
idempotency across refresh/restart/redelivery, and no automatic UAT,
approval, closure, or ChatGPT Send.

## Delivery discipline

Apply the current approved Constitution. P0 is a core-path blocker; P1 and P2
 remain Backlog by default. Do not architecture-expand this WP or start
 Autopilot.
