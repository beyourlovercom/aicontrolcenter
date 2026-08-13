# AICC-V2-TERMINAL-HANDOFF-001: Terminal Handoff

Status: PLANNED
Type: SELF_DEVELOPMENT_AUTOMATION
Prerequisite: `AICC-V2-GPT-BRIDGE-001` CLOSED

## Purpose

After a real Codex Run reaches `COMPLETED`, `FAILED`, or `STOPPED`, provide
one canonical terminal handoff: generate the Run Report, notify the Owner,
and insert the report into the exact originating ChatGPT conversation. The
final native ChatGPT Send remains under Owner control.

This Work Package is planning-only until explicitly authorized. It does not
change lifecycle, authorization, execution eligibility, or terminal result
semantics.

## Frozen contract

- `TERMINAL_EVENT_SOURCE_COUNT = 1`; reuse the existing durable terminal event.
- Emit exactly one formal notification per terminal Run:
  - `AICC · Codex 执行完成`
  - `AICC · Codex 执行失败`
  - `AICC · Codex 执行已停止`
- Do not notify during `STARTING`, `RUNNING`, polling, Inbox `READY`, or report
  preparation.
- When the Run Report is `READY`, insert it once into the exact originating
  ChatGPT conversation.
- Persist advisory correlation for Instruction ID, Run ID, and available
  ChatGPT tab/conversation identity. Never select the latest tab by guess.
- If the originating conversation is unavailable, retain `PENDING_INSERT` and
  insert once when that correlated conversation returns.
- Preserve an existing Owner Composer draft with a safe separator.
- `AUTO_SEND_CHATGPT_MESSAGE = 0`; native Send remains an Owner action.
- Terminal Handoff does not auto-pass UAT, close a WP, approve authorization,
  start remediation, create eligibility, or alter the Runtime result.
- `SECOND_EXECUTION_AUTHORITY = 0`; `SECOND_TERMINAL_AUTHORITY = 0`.

## Human UAT plan

One round, five items maximum:

1. A `COMPLETED` Run produces exactly one system notification.
2. The same Run Report appears automatically in the originating ChatGPT
   Composer.
3. The inserted report contains the exact Run ID.
4. Refresh, reconnect, and service restart do not duplicate notification or
   insertion.
5. ChatGPT does not auto-send; Owner retains the native Send action.

Each item is Owner-verified against the visible result and persisted Run
evidence. No UAT result is preselected by this plan.

## Acceptance gates

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
- `REPORT_NOT_LOST_WHEN_CHAT_CLOSED = PASS`
- `OWNER_DRAFT_PRESERVED = PASS`
- `OWNER_NATIVE_SEND_REQUIRED = PASS`

## Non-goals

No Auto Execute, Autopilot, notifications framework, second runtime, second
terminal authority, automatic Owner action, or remote delivery is included.
