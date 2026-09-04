# AICC-V2-TERMINAL-HANDOFF-001

Status: PLANNED
Type: SELF_DEVELOPMENT_AUTOMATION
Prerequisite: `AICC-V2-GPT-BRIDGE-001` CLOSED

## Purpose

After a real Codex Run reaches `COMPLETED`, `FAILED`, or `STOPPED`, AICC
generates the canonical Run Report, sends exactly one formal system
notification, and inserts the report into the exact originating ChatGPT
Composer. ChatGPT native Send remains under Owner control.

## Frozen scope

- `TERMINAL_EVENT_SOURCE_COUNT = 1`
- `NOTIFICATION_PER_TERMINAL_RUN = 1`
- `DUPLICATE_NOTIFICATION = 0`
- `PAGE_REFRESH_RENOTIFICATION = 0`
- `SERVICE_RESTART_RENOTIFICATION = 0`
- `AUTO_REPORT_INSERT = 1`
- `AUTO_REPORT_INSERT_PER_RUN = 1`
- `PAGE_REFRESH_REINSERT = 0`
- `SERVICE_RESTART_REINSERT = 0`
- `REPORT_RETURN_TO_ORIGINATING_CHAT = PASS`
- `OWNER_DRAFT_PRESERVED = PASS`
- `AUTO_SEND_CHATGPT_MESSAGE = 0`
- `OWNER_NATIVE_SEND_REQUIRED = PASS`
- `SECOND_EXECUTION_AUTHORITY = 0`
- `SECOND_TERMINAL_AUTHORITY = 0`

No lifecycle, authorization, execution eligibility, terminal authority,
Autopilot, or automatic Owner action is included.

## Human UAT plan

Maximum five items: verify one notification, one insertion in the originating
Composer, refresh/restart idempotency, preservation of the Owner draft, and
that native Send remains Owner-controlled.

## Delivery discipline

Apply the current approved Constitution. P0 is a core-path blocker; P1 and P2
 remain Backlog by default. Do not architecture-expand this WP or start
 Autopilot.
