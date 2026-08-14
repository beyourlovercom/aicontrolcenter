# AICC-V2-GPT-AICC-CODEX-CLOSED-LOOP-001

Status: `PLANNED / OWNER_AUTHORIZED_FOR_DESIGN`
Type: `GPT_AICC_CODEX_CLOSED_LOOP`
Authority: `AICC-V2-PROJECT-CONSTITUTION-001 v1.3`
Execution Standard: `AICC-V2-CANONICAL-EXECUTION-STANDARD-001 v1.3`

## Purpose

Complete the shortest reliable closed loop:

```text
Owner ↔ GPT → AICC → Codex → AICC → GPT
```

AICC is strictly transport, runtime-state/evidence display, persistence, and
result return. AICC performs no business, governance, permission, readiness,
feasibility, repository, Work Package, branch, Git, safety, or task-level
execution judgment.

## Highest architecture constraint

```text
AICC_TRANSPORT_ONLY = 1
AICC_DISPLAY_ONLY = 1
AICC_DECISION_AUTHORITY = 0
AICC_PRE_CODEX_SEMANTIC_GATES = 0
AICC_PASS_FAIL_BLOCKED_AUTHORITY = CODEX
AICC_RESULT_REWRITE = 0
```

No implementation in this Work Package may introduce a semantic gate before
Codex under any name, including preflight, readiness, authorization, policy,
safety, governance, validation, repository, branch, worktree, Work Package,
conflict, or permission checks.

## Existing capabilities to reuse

Reuse the existing AICC execution panel and current canonical actions rather
than creating a second execution UI or runtime.

Manual fallback actions remain first-class:

```text
⌥⌘V  Paste Instruction / 粘贴指令
⌥⌘R  Import & Run / 导入执行
⌥⌘C  Copy Result / 复制结果
```

Optional future shortcut:

```text
⌥⌘E  Execute Current Instruction / 执行当前指令
```

Buttons, keyboard shortcuts, Chrome Bridge, and API calls must converge on the
same canonical action layer. The Chrome extension must not simulate keyboard
shortcuts or DOM clicks as its execution protocol.

## Canonical action layer

Target actions:

```text
pasteInstruction(payload)
importInstruction(payload)
importAndRun(payload)
executeCurrentInstruction()
copyResult()
getExecution(executionId)
getResult(executionId)
```

UI controls and shortcuts are human interaction adapters. Chrome Bridge and
future integrations call the same underlying actions directly.

## Inbound flow

1. GPT emits an executable instruction or `AICC_EXECUTION_V1` envelope.
2. Owner clicks the inline `✦ AICC` action in ChatGPT Web.
3. Chrome Bridge captures exactly that originating instruction and submits it
   to the Local Control Service.
4. AICC creates one durable `execution_id`, records origin correlation, and
   delivers the instruction to Codex.
5. AICC does not decide whether the task should execute.
6. Codex reads the repository and repository-local rules and owns all semantic
   execution decisions.

Canonical path:

```text
GPT
  ↓
Chrome Bridge
  ↓
AICC Local Control Service
  ↓
Codex Runtime
```

## AICC transport checks only

AICC may establish infrastructure truth only:

- instruction payload exists;
- durable execution identity can be created;
- duplicate delivery/replay can be detected;
- Codex runtime can be reached/launched;
- origin conversation/message correlation can be persisted;
- a result can be returned exactly once.

These checks may produce only AICC transport/runtime state. They may never
produce a task-level `BLOCKED`, `PASS`, or `FAIL` result.

## Codex execution ownership

Codex owns task-level reasoning and must return explicit outcome and reason.
Examples include repository absence, branch mismatch, Work Package absence,
permissions, governance, failed tests, dependency failures, implementation
errors, or any repository-local policy finding.

AICC preserves those results without semantic reinterpretation.

## Status model

AICC and Codex states must remain separate:

```text
AICC_STATUS:
QUEUED
SENT
RUNNING
RESULT_RECEIVED
RETURNED_TO_GPT
DELIVERY_FAILED

CODEX_RESULT:
PASS
FAIL
BLOCKED
CANCELLED
NOT_STARTED

CODEX_REASON:
owned by Codex
```

Examples:

```text
AICC_STATUS: RESULT_RECEIVED
CODEX_RESULT: BLOCKED
CODEX_REASON: FORMAL_WORK_PACKAGE_MISSING
```

```text
AICC_STATUS: DELIVERY_FAILED
CODEX_RESULT: NOT_STARTED
AICC_ERROR: CODEX_RUNTIME_UNREACHABLE
```

## Outbound flow

1. Codex reaches terminal state and returns its final result.
2. AICC captures and persists one canonical result bound to `execution_id`.
3. AICC emits/records one durable result-ready event.
4. Chrome Bridge receives or polls that exact result identity.
5. Bridge resolves the originating ChatGPT conversation/message correlation.
6. The result is inserted/returned at most once.
7. GPT receives the result and decides the next conversational/planning step.

Canonical return path:

```text
Codex
  ↓
AICC Result Store
  ↓
Chrome Bridge
  ↓
Originating GPT Conversation
```

## Exactly-once contract

Every execution/result must have durable identity sufficient to prevent the
previous infinite-copy / repeated-insertion failure mode.

Minimum correlation fields:

```text
execution_id
instruction_id when available
origin_conversation_id or stable conversation reference
origin_message_id or stable source reference
result_id
result_hash
return_state
```

Return lifecycle:

```text
RESULT_READY
→ RETURN_SUBMITTING
→ RETURNED_TO_GPT
→ CLOSED
```

Once a `result_id` is `RETURNED_TO_GPT`, DOM rerenders, MutationObserver
activity, page refresh, reconnect, polling, or service restart must never submit
that same result again.

`MUTATION_OBSERVER_IS_EXECUTION_AUTHORITY = 0`
`DOM_RESCAN_CAUSES_RESULT_RESUBMIT = 0`

## Result contract

Use one canonical stored result. Manual `复制结果`, AICC History, Chrome Bridge,
and GPT return must read the same result rather than generate competing copies.

Recommended transport envelope:

```text
AICC_EXECUTION_RESULT_V1

EXECUTION_ID: <id>
INSTRUCTION_ID: <id-or-absent>
AICC_STATUS: <transport/runtime state>
CODEX_RESULT: <Codex outcome>
CODEX_REASON: <Codex reason or ABSENT>

RESULT_BEGIN
<Codex final result preserved by AICC>
RESULT_END
```

AICC formatting may add transport metadata but may not alter Codex semantics.

## Chrome Bridge UI target

Executable Assistant blocks show a compact inline `✦ AICC` action. Normal
Assistant prose does not show the action.

After submission, the action may project transport state such as:

```text
✦ AICC · 已提交
✦ AICC · 运行中
✦ AICC · 已返回
```

These labels describe AICC transport/runtime state only and do not represent
Codex task judgment.

The existing manual AICC execution panel remains the fallback path and must
remain usable when the Chrome Bridge is unavailable.

## Non-goals

This Work Package does not authorize:

- a second execution runtime;
- a second result store;
- a second execution authority;
- semantic AICC preflight;
- AICC Work Package/branch/worktree/authorization gates;
- automatic PR creation, merge, deploy, or Owner UAT decisions;
- automatic GPT planning beyond returning the result into the conversation;
- arbitrary shell execution from the Chrome extension.

## Acceptance

### Architecture

```text
AICC_DECISION_AUTHORITY = 0
PRE_CODEX_SEMANTIC_GATE_COUNT = 0
SECOND_EXECUTION_AUTHORITY = 0
SECOND_RESULT_SOURCE = 0
```

### Shortcuts / action unification

```text
OPTION_COMMAND_V = PASTE_INSTRUCTION
OPTION_COMMAND_R = IMPORT_AND_RUN
OPTION_COMMAND_C = COPY_RESULT
BUTTON_SHORTCUT_ACTION_PARITY = PASS
BRIDGE_USES_CANONICAL_ACTION_LAYER = PASS
BRIDGE_SIMULATES_KEYBOARD = NO
```

### Inbound

```text
ASSISTANT_EXECUTABLE_AICC_BUTTON = PASS
NORMAL_ASSISTANT_AICC_BUTTON = NO
ORIGIN_INSTRUCTION_CAPTURE = PASS
EXECUTION_ID_CREATED_ONCE = PASS
DELIVERY_TO_AICC = PASS
DELIVERY_TO_CODEX = PASS
```

### Runtime ownership

```text
CODEX_OWNS_PASS_FAIL_BLOCKED = PASS
CODEX_REASON_PRESERVED = PASS
AICC_RESULT_REWRITE = NO
AICC_BLOCKS_REPOSITORY_FINDING = NO
AICC_BLOCKS_GOVERNANCE_FINDING = NO
```

### Return

```text
RESULT_ID_DURABLE = PASS
RESULT_HASH_DURABLE = PASS
ORIGIN_CONVERSATION_BINDING = PASS
ORIGIN_MESSAGE_BINDING = PASS
RESULT_RETURN_EXACTLY_ONCE = PASS
DOM_RESCAN_DUPLICATE = NO
PAGE_REFRESH_DUPLICATE = NO
SERVICE_RESTART_DUPLICATE = NO
WRONG_CONVERSATION_RETURN = NO
```

### Fallback

```text
MANUAL_PASTE_SHORTCUT = PASS
MANUAL_IMPORT_RUN_SHORTCUT = PASS
MANUAL_COPY_RESULT_SHORTCUT = PASS
MANUAL_EXECUTION_PANEL_PRESERVED = PASS
```

## Human UAT

One concise Owner UAT round should validate the visible closed loop:

1. GPT outputs one executable instruction and shows one `✦ AICC` action.
2. One click produces exactly one Codex run through AICC.
3. AICC shows transport/runtime progress without producing its own task gate.
4. Codex final result appears once in the originating GPT conversation.
5. Refresh/reconnect/DOM rerender does not duplicate execution or result return.
6. Manual shortcuts remain usable as fallback.

## Relationship to historical Work Packages

`AICC-V2-GPT-BRIDGE-001`, `AICC-V2-TERMINAL-HANDOFF-001`,
`AICC-V2-AUTO-EXECUTE-MODE-001`, and
`AICC-V2-CHROME-BRIDGE-REBUILD-001` remain historical evidence of delivered
capabilities. Where their older wording describes AICC semantic gates, Writer
Lock execution authority, authorization gating, or AICC as execution authority,
the Project Constitution v1.3 and Canonical Execution Standard v1.3 supersede
that wording for all new implementation.

Do not rewrite historical UAT evidence into a different past result. New code
must conform to the v1.3 architecture.
