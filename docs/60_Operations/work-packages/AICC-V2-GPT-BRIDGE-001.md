# AICC-V2-GPT-BRIDGE-001: GPT Plus Web ↔ AICC ↔ Codex

Status: CLOSED
Parent Status: CLOSED
001A Status: COMPLETE / SEALED
001B Status: COMPLETE / HUMAN_UAT_PASS
Type: GPT_BRIDGE_BIDIRECTIONAL

Phase 001A Bridge Core is complete. Canonical read-only and bounded write
runtime dogfood have passed, including instruction delivery, Writer Lock,
terminal Runtime evidence, `AICC_RUN_REPORT_V1`, and Result Outbox READY.
Owner Human UAT Rounds 1 and 2 are PASS. Round 3.1 is PASS. Round 3.2
remains a non-blocking P1 backlog finding because it has machine-tested
remediation but no separate real Owner verification recorded in this closure.

Closure point: `GPT_BRIDGE_001B_CLOSURE`

Current truth: `001A = COMPLETE`; `001B = COMPLETE / HUMAN_UAT_PASS`; parent
`AICC-V2-GPT-BRIDGE-001 = CLOSED`. This document does not claim production
release or remote delivery readiness.

Constitution v1.1 closure rationale: the five First Usable Version hard gates
are PASS. The remaining Composer fallback source-selection ambiguity is P1,
does not block those gates, and has no execution authority. The canonical
Assistant capture path remains the workaround. No historical failure is
rewritten as a pass.

## Formal closure evidence

- `GPT_BRIDGE_001B_UAT_ROUND_1 = PASS`
- `GPT_BRIDGE_001B_UAT_ROUND_2 = PASS`
- `GPT_BRIDGE_001B_UAT_ROUND_3 = PASS_WITH_NON_BLOCKING_P1_BACKLOG`
- `GPT_BRIDGE_001B_HUMAN_UAT = PASS`
- `GPT_BRIDGE_PARENT_ACCEPTANCE_CRITERIA = PASS`
- `HUMAN_UAT = PASS`
- `WP_STATUS = CLOSED`
- `FIRST_USABLE_HARD_GATE_COUNT = 5`
- `FIRST_USABLE_HARD_GATE_PASS_COUNT = 5`
- `AICC_V2_FIRST_USABLE_VERSION = PASS`

## Backlog finding

### GPT Bridge Composer fallback source-selection ambiguity

- Severity: `P1`
- Blocks First Usable Version: `NO`
- Blocks current WP closure: `0`
- Execution authority: `0`
- Workaround: use canonical Assistant capture.
- Future direction: retain deterministic Composer-first source selection and
  complete a separately recorded real Owner verification before treating the
  fallback finding as fully UAT-verified.

001B Human UAT Round 1 = PASS. Real Owner evidence: the Chrome extension
loaded without error and displayed the AICC Bridge on chatgpt.com; an
Assistant response was captured without composer copy; the instruction was
sent with `source = WEB_BRIDGE` and correlated to Inbox
`owner-uat-001b-round1-direct-20260813`. The canonical dirty-worktree Gate
blocked execution, which is expected for this development worktree. Receive
did not auto-execute (`AUTO_EXECUTE_ON_RECEIVE = 0`). The original Round 1
record above predates the later Round 2 and Round 3.1 evidence; the formal
closure evidence above is authoritative for final status.

Round 1 also verified the read-only Execution Inbox inspection surface:
Inbox ID, `WEB_BRIDGE` source, execution type, state, latest-item identity,
Gate reason, exact Inbox/Run correlation, and the full received
`AICC_EXECUTION_V1` instruction are inspectable. The persisted Inbox item
`owner-uat-001b-round1-direct-20260813` remains `BLOCKED` only because the
development worktree is dirty; it was not a transport failure.

## Goal and delivery phases

## Goal

Provide a bounded, Owner-triggered bridge from a validated `AICC_EXECUTION_V1`
instruction into the existing AICC Fast Execution and Codex Runtime path.

## Scope

Implement the 001A Bridge Core: parse and persist the Execution Inbox, expose
the canonical eight protocol gates, launch only explicit READY items through
Fast Execution, bind real runtime evidence, generate `AICC_RUN_REPORT_V1`, and
persist Result Outbox READY evidence.

## File Scope

- `src/lib/bridgeCore.ts`
- `src/lib/bridgeCore.test.ts`
- `src/lib/runtimeManager.ts`
- `src/lib/runtimeManager.test.ts`
- `src/App.svelte`
- `vite.config.ts`
- `docs/60_Operations/work-packages/AICC-V2-GPT-BRIDGE-001.md`

This semantic scope covers the Bridge Core protocol adapter, its direct tests,
the existing canonical Runtime instruction handoff, the current Bridge UI and
localhost transport integration, and this formal contract. It does not include
Constitution or approved baseline documents.

## Acceptance Criteria

Machine acceptance: the 001A parser, inbox, outbox, canonical Fast Execution
handoff, Writer Lock, runtime binding, terminal report generation, failure
handling, persistence, and explicit Owner launch behavior must be validated.

The parent contract covers a bidirectional GPT Plus Web ↔ AICC ↔ Codex task/result bridge.
It is delivered as two phases; these are formal phases inside the parent Work Package,
not a new unsupported Roadmap hierarchy level:

- `AICC-V2-GPT-BRIDGE-001A` — Bridge Core. Independently usable without browser DOM integration.
- `AICC-V2-GPT-BRIDGE-001B` — ChatGPT Web Adapter. Depends on 001A.

Delivery order: 001A Bridge Core → 001A Machine Validation → 001A Human UAT →
001B Web Adapter → 001B Machine Validation → 001B Human UAT → parent complete.

## 001A — Bridge Core

The canonical business flow is:

`External Adapter → Execution Inbox → ImportedExecutionInstruction → parser → 8 Gates → existing Codex runtime / future Autopilot`

Outbound flow is:

`Runtime / Validation terminal → AICC_RUN_REPORT_V1 → Result Outbox → External Adapter`

Core scope:

1. Execution Inbox
2. Result Outbox
3. `AICC_EXECUTION_V1` parser
4. `AICC_RUN_REPORT_V1` generator
5. canonical import gates
6. existing Codex runtime integration
7. clipboard import fallback
8. copy-report fallback
9. local bridge API contract for adapters

Clipboard is only a fallback, never the canonical source. Source adapters are
`CLIPBOARD` and `WEB_BRIDGE`; `MCP` and `API` are reserved, not implemented.
The source-independent instruction model preserves:
`instructionId`, `sourceType`, `sourceReference`, `receivedAt`, `envelopeVersion`,
`entityType`, `entityId`, `executionType`, `branch`, `expectedHead`, `sandbox`,
`instructionBody`, `parseStatus`, and `gateStatus`.

### Execution Inbox

Stable inbox entries preserve the original imported text without mutation and use:
`RECEIVED`, `PARSED`, `INVALID`, `READY`, `BLOCKED`, `LAUNCHED`, `CONSUMED`.
Future Owner UI is Chinese-first: `执行指令收件箱`, source, target WP, execution type,
received time and gate status. View/load/reject/delete behavior is subject to the
implementation contract; this preparation does not add UI.

### Result Outbox

Stable outbox entries preserve `resultId`, related instruction ID where available,
entity ID, run ID, created time, report version, report text, delivery state and
source conversation reference where available. Delivery states are `READY`,
`DELIVERED`, `ACKNOWLEDGED`, `FAILED`; `DELIVERED` never means a ChatGPT message
was actually sent.

## AICC_EXECUTION_V1

```text
AICC_EXECUTION_V1

ENTITY_TYPE: WORK_PACKAGE
ENTITY_ID: <stable entity id>
EXECUTION_TYPE: IMPLEMENTATION
BRANCH: <expected branch>
EXPECTED_HEAD: <full sha>
SANDBOX: workspace-write

INSTRUCTION_BEGIN

<instruction passed to Codex>

INSTRUCTION_END
```

The parser recognizes the version, validates required fields, extracts the body
exactly, rejects malformed/unsupported envelopes visibly, and never treats metadata
as executable shell input. Imported text never executes immediately; Owner must
explicitly launch after gates pass.

The eight canonical gates are: `ENTITY_MATCH`, `BRANCH_MATCH`,
`EXPECTED_HEAD_MATCH`, `WORKTREE_GATE`, `OWNER_AUTHORIZATION`,
`WRITER_LOCK_AVAILABLE`, `EXECUTION_TYPE_SUPPORTED`, `SANDBOX_SUPPORTED`.

## 001B — ChatGPT Web Adapter

Inbound happy path: ChatGPT Web detects an explicit `AICC_EXECUTION_V1` block;
Owner clicks `发送到 AICC`; the adapter sends it to the localhost AICC service;
the instruction enters the Execution Inbox. Receipt never auto-executes.

Outbound happy path: the adapter polls the Result Outbox, shows `AICC 有新的运行报告`,
and after Owner clicks `插入运行报告`, inserts `AICC_RUN_REPORT_V1` into the active
ChatGPT composer. Owner must click ChatGPT's native Send action.

Conversation metadata (`CHATGPT_WEB`, source conversation URL, bridge session ID)
is advisory only and never becomes repository/WP truth. If exact routing cannot be
proven, do not insert into an arbitrary conversation; show `发现 AICC 运行结果，请确认目标对话`.

## AICC_RUN_REPORT_V1

The standard human-readable report contains these sections and only truthful data:

```text
AICC_RUN_REPORT_V1
ENTITY
EXECUTION
WRITER LOCK
IMPLEMENTATION
ACTIVITY SUMMARY
FINAL AGENT MESSAGE
ERROR SUMMARY
VALIDATION
LIFECYCLE
REPOSITORY STATE
OWNER STATUS
```

`ABSENT`, `UNAVAILABLE`, and `FAILED` remain distinct. The report may include
parent, execution type, run ID, runtime status, branch, execution HEAD, elapsed,
exit code, terminal lock, implementation result, activity counts, final Agent
message, stderr/error summary, validation evidence, lifecycle, repository HEAD,
worktree, changed files and effective Owner status.

## Local transport and security

V1 uses a browser adapter/content bridge to the AICC Local Control Service at
`127.0.0.1`. Conceptual endpoints are:

- `POST /api/gpt-bridge/inbox`
- `GET /api/gpt-bridge/outbox`
- `POST /api/gpt-bridge/outbox/:id/ack`

Simple polling is sufficient; WebSocket/SSE is not required. The browser adapter
may deliver text only and must never invoke shell, `codex exec`, Git, or filesystem
mutation. AICC remains the execution authority and reuses the existing runtime,
Writer Lock, persistence and Owner action.

If Web DOM integration breaks, clipboard import and copy-report remain usable.
Recognition must target explicit `AICC_EXECUTION_V1` content, not arbitrary page
scraping. Composer-target failure is visible and must not click unrelated controls.

## 001A Machine Acceptance Criteria

1. Inbox entries persist with stable IDs and original source text.
2. Outbox entries persist with stable IDs and report text.
3. Valid `AICC_EXECUTION_V1` envelopes parse deterministically.
4. Malformed envelopes are rejected visibly.
5. Unsupported versions are rejected visibly.
6. All eight gates are evaluated from one canonical gate resolver.
7. Instruction business state is independent of adapter source type.
8. Clipboard import works as fallback only.
9. `AICC_RUN_REPORT_V1` generation includes required sections.
10. ABSENT, UNAVAILABLE and FAILED remain semantically distinct.
11. Local adapter API accepts an inbox instruction safely.
12. Existing Codex runtime is reused.
13. An adapter cannot directly execute code or mutate the repository.
14. Web adapter failure does not block Bridge Core.
15. READY inbox items require an explicit Owner launch action.
16. Receiving or parsing never auto-executes Codex.
17. Bridge launch delegates to canonical Fast Execution preflight.
18. Bridge launch reuses the existing WP Execution Lease.
19. Worktree provenance and semantic scope evolution are preserved.
20. Canonical Writer Lock and managed Runtime are reused.
21. A launched inbox item persists its real Run ID and runtime state.
22. Terminal runtime evidence generates a real `AICC_RUN_REPORT_V1`.
23. A real terminal report creates Result Outbox `READY` and consumes the inbox.
24. Hard preflight blockers fail closed without creating a fake runtime.

001A Human UAT Plan (Chinese-first, max 7 per round, recommended 3–5):

- HUA-A01 | 第一轮：指令收件箱 | 查看一条外部指令 | 收件箱显示来源、目标 WP、收到时间与 Gate 状态。
- HUA-A02 | 第一轮：指令收件箱 | 导入有效指令 | 原文保持不变且状态进入可解析路径。
- HUA-A03 | 第一轮：指令收件箱 | 导入无效指令 | 页面明确拒绝，不会自动启动 Codex。
- HUA-A04 | 第二轮：运行与 Gate | 检查八项 Gate | Entity、Branch、HEAD、Worktree、授权、锁、类型、Sandbox 结果真实可读。
- HUA-A05 | 第二轮：运行与 Gate | Owner 显式载入并启动 | 只通过既有 AICC Runtime 执行，未得到 Owner 点击不会运行。
- HUA-A06 | 第二轮：运行与 Gate | 观察运行结果 | 运行、锁、终态与错误证据保持一致。
- HUA-A07 | 第三轮：报告与回退 | 复制运行报告 | 报告可粘贴到 GPT Plus，复制成功/失败都有反馈。
- HUA-A08 | 第三轮：报告与回退 | 关闭 Web Bridge 后复制报告 | Core 仍可通过复制报告完成交接。
- HUA-A09 | 第四轮：持久化与隔离 | 刷新并切换实体 | Inbox、Outbox 与实体上下文保持绑定，不发生串线。
- HUA-A10 | 第四轮：持久化与隔离 | 重启服务后读取证据 | 持久化记录恢复，缺失与不可用状态不被伪造。

## 001B Machine Acceptance Criteria

1. Adapter detects explicit `AICC_EXECUTION_V1` blocks only.
2. `发送到 AICC` requires explicit Owner action.
3. Delivery targets the correct localhost AICC endpoint.
4. Receipt never auto-executes.
5. Adapter polls Result Outbox.
6. `REPORT_READY` produces visible notification.
7. `插入运行报告` targets only the active composer after Owner action.
8. ChatGPT native send is never automated.
9. Conversation routing metadata is advisory.
10. Routing mismatch never inserts into an arbitrary conversation.
11. Missing DOM target fails visibly.
12. Arbitrary page scraping is not used.
13. Clipboard and copy-report fallbacks remain available.
14. Adapter never invokes shell, Codex, Git or filesystem mutation.
15. Adapter uses only the intended `127.0.0.1:1420` control boundary.
16. Refresh recovery restores correlation without replaying execution.

001B Human UAT Plan (Chinese-first, three rounds, max 3 per round):

- HUA-B01 | 第一轮：发送到 AICC | 在 ChatGPT Web 准备 AICC_EXECUTION_V1 并点击「发送到 AICC」 | 适配器出现，指令进入本机 Inbox，页面显示 Inbox 身份与状态。
- HUA-B02 | 第一轮：发送到 AICC | 检查接收后的 AICC 页面 | 收到指令不会自动执行，仍需 Owner 在 AICC 中启动。
- HUA-B03 | 第一轮：发送到 AICC | 发送格式错误的内容 | 页面显示可读失败原因与下一步，不静默失败。
- HUA-B04 | 第二轮：运行报告 | 等待匹配的 AICC 运行结果 | 适配器按 Inbox/Run 身份显示对应报告，不使用最新结果猜测。
- HUA-B05 | 第二轮：运行报告 | 点击「插入运行报告」 | 报告进入当前 ChatGPT composer，Run ID 保持一致。
- HUA-B06 | 第二轮：运行报告 | 检查插入后的对话 | 不触发 ChatGPT 原生发送，Owner 仍需手动点击发送。
- HUA-B07 | 第三轮：持久化与回退 | 刷新 ChatGPT 页面后继续检查 | 发送关联仍可恢复，不会静默重放执行。
- HUA-B08 | 第三轮：持久化与回退 | 关闭适配器或使 composer 不可用 | 可回退为复制/粘贴 AICC 指令与运行报告，并显示失败原因。

## Non-goals

NOT IN SCOPE: ChatGPT API, OpenAI API, ChatGPT Work, Codex Desktop, MCP write access,
automatic ChatGPT message sending, automatic exact conversation opening, cross-device sync, browser cloud
service, multiple-browser routing, WebSocket/SSE requirement, PR execution,
commit/push, Draft PR, CI, Review, Merge, PR Runner, WP Close, deployment,
OpenCode, OpenSpec and OmO.

## Boundaries

`EXECUTION_INBOX_CANONICAL = PASS`; `RESULT_OUTBOX_CANONICAL = PASS`;
`CLIPBOARD_IS_ONLY_FALLBACK = YES`; `AUTO_SEND_CHATGPT_MESSAGE = 0`;
`CONVERSATION_ROUTING_IS_ADVISORY = PASS`; `V1_WEBSOCKET_REQUIRED = NO`;
`V1_SIMPLE_POLLING_ALLOWED = YES`; `BROWSER_ADAPTER_CAN_EXECUTE_CODE = 0`;
`AICC_REMAINS_EXECUTION_AUTHORITY = YES`; `WEB_ADAPTER_FAILURE_BLOCKS_CORE = 0`.

## MVP delivery discipline classification

`GPT_BRIDGE_001B_UAT_ROUND_3 = PASS_WITH_NON_BLOCKING_P1_BACKLOG`.

| Finding / proposed area | Severity | Hard gate impact | Current closure effect | Backlog / workaround |
| --- | --- | --- | --- | --- |
| Current idle-page instability | P0 | Gates 1 and 2 | Resolved; Round 2 PASS and no remaining closure impact | Historical remediation cycle 1 evidence retained |
| Formal Web Host / Control Service process separation | P2 | None proven | Does not block MVP by default | Backlog; future architecture phase |
| Complete Desktop process isolation | P2 | None proven | Does not block MVP by default | Backlog; future architecture phase |
| Advanced automatic self-healing | P2 | None proven | Does not block MVP by default | Backlog; future recovery phase |

Every new UAT finding must report `BUG_SEVERITY`,
`BLOCKS_FIRST_USABLE_GATE`, `BLOCKED_GATE_ID`,
`REMEDIATION_CYCLE_NUMBER`, `CURRENT_WP_CLOSURE_BLOCKED`, and
`BACKLOG_IF_NOT_P0`. The normal maximum is
`NORMAL_MAX_P0_REMEDIATION_CYCLES = 1`; only new real Owner evidence proving a
continued core-path block may authorize another cycle. Backlog findings have
`BACKLOG_FINDING_HAS_EXECUTION_AUTHORITY = 0`.
