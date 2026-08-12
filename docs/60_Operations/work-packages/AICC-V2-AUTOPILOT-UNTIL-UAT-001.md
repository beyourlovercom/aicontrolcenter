# AICC-V2-AUTOPILOT-UNTIL-UAT-001: 自动推进至人工 UAT

Status: FORMAL_READY
Type: AUTOPILOT_UNTIL_UAT

## Goal

在一次明确的 Owner 授权与启动之后，由 AICC 编排多个有界 Codex CLI
运行，完成实现、验证、必要修复、重新验证与机器验收，最终到达
`WAITING_UAT` 并强制停止，等待 Owner 人工 UAT。

Autopilot 是编排器，Codex 是有界 worker；这不是无限 Codex loop。单次
Codex 执行与 Autopilot session 是两个不同层次，Autopilot 必须复用现有
Owner Authorization、Local Control Service、managed `codex exec`、
Writer Lock、Runtime persistence、Runtime Monitor、Validation architecture、
Lifecycle resolver 与 Human UAT gate。

## Owner start and scope

Owner selects the WP, confirms authorization, then explicitly clicks
`自动推进至人工 UAT` and confirms a summary containing target WP, branch,
authorized HEAD, and execution scope. Autopilot never starts without that
Owner action. It may schedule only `IMPLEMENTATION`, `VALIDATION`, `REPAIR`,
`REVALIDATION`, and `MACHINE_ACCEPTANCE`.

It must never automate Human UAT, Owner Override, WP Close, push, PR, review,
merge, or deployment. It must stop at `WAITING_UAT` with Owner-facing result
`自动开发已完成 / 等待人工 UAT`.

## State machine

The canonical machine states are:

`IDLE`, `PREPARING`, `IMPLEMENTING`, `VALIDATING`, `REPAIRING`,
`REVALIDATING`, `MACHINE_ACCEPTANCE`, `WAITING_UAT`, `COMPLETED_TO_UAT`,
`BLOCKED`, `FAILED`, `STOPPING`, `STOPPED`.

UI text must not be used to derive state.

## Control loop and bounded retry

- `PREPARING` verifies entity, branch, authorized HEAD, worktree, authorization,
  Writer Lock, supported execution type and sandbox.
- `IMPLEMENTING` uses the existing runtime. `CODE_CHANGE_PRESENT` proceeds to
  Validation; `NO_CODE_CHANGE` is classified, never assumed successful.
- Validation PASS proceeds to Machine Acceptance. Repairable failures enter a
  new bounded `REPAIR` run with the formal WP contract, repository state,
  failed evidence, normalized failure summary and explicit repair scope.
- `REVALIDATING` may repeat only while the repair budget remains.
- Default maximum repair attempts: `3` (initial implementation is not Repair #1).
- Default maximum total Autopilot duration: `2 hours`.
- Machine Acceptance PASS reaches `WAITING_UAT`, then Autopilot stops successfully.

NO_CODE_CHANGE classifications are `NO_CODE_CHANGE_ALREADY_SATISFIED`,
`NO_CODE_CHANGE_UNEXPECTED`, and `NO_CODE_CHANGE_BLOCKED`. Repeated unresolved
no-change blocks and stops. Failure fingerprints include validation command,
failed test identity, error code and normalized summary; repeated unresolved
failure beyond the threshold becomes `REPEATED_FAILURE_DETECTED` and stops.

## Hard stops

Autopilot hard-stops on: WAITING_UAT; Owner Stop; Writer Lock integrity failure;
branch change; authorized HEAD invalidation; scope violation; unsupported state;
Codex BLOCKED; retry limit; repeated unresolved NO_CODE_CHANGE; repeated same
failure; total time limit; unsafe Local Control Service interruption; evidence
persistence failure; and unverifiable repository integrity. It fails closed.

Every write run uses the canonical repository Writer Lock (`HELD` during managed
write, `NOT_HELD` at terminal state). No stale lock may remain. Repository safety
forbids reset, rebase, destructive clean, push, PR creation, merge and deploy.

## Persistence and restart

Persist `autopilotSessionId`, WP ID, repository identity, authorized branch and
start HEAD, timestamps, terminal state, stop reason, repair count and duration;
each run records run ID, purpose, attempt and terminal result; validation attempts,
Machine Acceptance, and Owner start evidence are retained. Evidence survives
refresh, entity switch and Local Control Service restart.

An interrupted active session must reconstruct as
`AUTOPILOT_INTERRUPTED_REQUIRES_OWNER_RESUME`; restart must never silently launch
another Codex. Owner Stop remains available, stops scheduling, requests the
current managed run through the existing path, persists `STOPPED`, releases the
lock, and never reverts repository changes.

## Machine Acceptance Criteria

1. Autopilot requires explicit Owner start and confirmation.
2. The state machine accepts only the thirteen formal states.
3. PREPARING validates all canonical safety gates.
4. Implementation uses the existing managed Codex runtime.
5. Writer Lock is held for each managed write run.
6. Terminal runs release Writer Lock.
7. Validation is independent of Codex exit code.
8. Validation PASS is required before Machine Acceptance.
9. Repair runs receive failure context and explicit scope.
10. Repair attempts are capped at three.
11. Total duration is capped at two hours.
12. Repeated failure fingerprints are detected deterministically.
13. NO_CODE_CHANGE is classified truthfully.
14. Repeated unresolved NO_CODE_CHANGE blocks and stops.
15. Unrelated repository changes produce SCOPE_VIOLATION.
16. Branch changes hard-stop the session.
17. Authorized HEAD invalidation hard-stops the session.
18. Owner Stop is available and preserves existing changes.
19. Unsupported states fail closed.
20. Codex BLOCKED is not treated as success.
21. Evidence persistence failure blocks progression.
22. Repository integrity cannot be unverifiably bypassed.
23. Machine Acceptance runs only after Validation PASS.
24. Machine Acceptance PASS reaches WAITING_UAT.
25. Autopilot never mutates Human UAT checklist items.
26. Autopilot never invokes Owner Override.
27. Human UAT PASS never automatically closes the WP.
28. Session evidence survives browser refresh.
29. Session evidence survives entity switching.
30. Service restart requires explicit Owner resume and never auto-launches.
31. Existing Runtime Monitor remains the per-run observation surface.
32. No second Codex runtime, Writer Lock or Validation engine is introduced.
33. Major transitions produce persistent Owner Action Feedback.
34. No push, PR, review, CI, merge or deployment is performed.

## Owner Human UAT Plan

This is a dedicated Chinese-first Owner plan, separate from Machine Acceptance.
Each item has a stable ID, Owner operation and human-readable pass standard.

- HUA-01 | 第一轮：启动自动推进 | 选择 WP 并点击自动推进至人工 UAT | 二次确认显示目标 WP、分支、授权 HEAD 与执行范围。
- HUA-02 | 第一轮：启动自动推进 | 确认并启动 Autopilot | 页面显示自动推进已启动，且没有 Owner 操作时不会自行启动。
- HUA-03 | 第一轮：启动自动推进 | 观察准备与实现状态 | 状态按阶段变化，目标与当前 WP 始终一致。
- HUA-04 | 第一轮：启动自动推进 | 观察 Runtime Monitor 与写入锁 | 复用现有监控，运行时锁已持有且终态释放。
- HUA-05 | 第二轮：自动修复循环 | 观察一次验证通过路径 | 验证完成后进入机器验收，不跳过验证。
- HUA-06 | 第二轮：自动修复循环 | 观察可修复验证失败 | 页面显示准备修复及当前修复次数，不显示静默重试。
- HUA-07 | 第二轮：自动修复循环 | 查看修复目标 | Codex 运行上下文包含失败原因、当前仓库状态与明确修复范围。
- HUA-08 | 第二轮：自动修复循环 | 观察达到修复上限 | 达到 3 次后显示已阻塞并停止，不进入无限循环。
- HUA-09 | 第三轮：停止与异常 | 点击停止自动推进 | 不再安排新运行，当前运行按现有停止路径终止并保留证据。
- HUA-10 | 第三轮：停止与异常 | 触发分支或 HEAD 不一致 | 页面显示明确阻塞原因，且不继续写入。
- HUA-11 | 第三轮：停止与异常 | 观察范围外修改 | 系统显示范围违规并停止，不执行破坏性 Git 操作。
- HUA-12 | 第三轮：停止与异常 | 重启 Local Control Service | 活跃 session 显示需要 Owner 恢复，不会静默重新启动 Codex。
- HUA-13 | 第四轮：等待人工 UAT | 等待机器验收完成 | Owner 看到自动开发已完成、等待人工 UAT。
- HUA-14 | 第四轮：等待人工 UAT | 检查 Human UAT 工作台 | 清单保持 Owner 可操作，Autopilot 未替 Owner 修改任何结果。
- HUA-15 | 第四轮：等待人工 UAT | 刷新并切换实体 | session、运行、验证与生命周期证据保持绑定且可恢复。
- HUA-16 | 第四轮：等待人工 UAT | 检查最终边界 | Human UAT、Owner Override、WP Close、Push、PR、Merge 与 Deploy 均未自动发生。

## GPT Bridge compatibility

Compatible future flow: GPT Plus → `AICC_EXECUTION_V1` import → Owner
Authorization → explicit Autopilot start → `WAITING_UAT` or `BLOCKED` →
`AICC_RUN_REPORT_V1` export. No ChatGPT API or browser automation is required.

## Non-goals

The following are NOT IN SCOPE: Human UAT automation, Owner Override automation,
WP automatic Close, push, PR creation, review, CI, merge, production deployment,
ChatGPT API, browser automation, OpenCode, OpenSpec, and OmO.

## Boundaries

`OWNER_EXPLICIT_AUTOPILOT_START = YES`; `AUTOPILOT_CAN_CROSS_HUMAN_UAT = 0`;
`AUTOPILOT_HUMAN_UAT_MUTATION = 0`; `AUTOPILOT_FAILS_OPEN = 0`;
`SILENT_AUTOPILOT_RESUME_AFTER_RESTART = 0`.
