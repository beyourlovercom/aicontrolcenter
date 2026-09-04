# AICC-V2-SELF-DEVELOPMENT-UAT-001: First Self-Development Dogfood

Status: FORMAL_READY
Type: SELF_DEVELOPMENT_UAT
Milestone: M3 — First Usable Version Closure

## Goal

使用 AICC 自身的 Owner 控制面启动 Codex，完成一次真实、受约束的 AICC
产品代码改动，并通过 Runtime、Validation 与 Human UAT 形成可恢复的
self-development dogfood evidence。

## Self-development payload

本次 dogfood 的实现 payload 是：为 Human UAT 工作台增加一个紧凑、中文优先
的「验收方式」只读标识，明确显示「逐项验收」或「Owner 直接通过」，并在
刷新、切换实体及 Local Control Service 重启后保持与 canonical Human UAT
evidence 一致。

该改动是真实 Owner-facing AICC 产品代码改动，范围小、可独立视觉验收，
不改变 lifecycle、progress、Runtime、Authorization 或 Writer Lock 语义，
也不依赖 PR Runner / GitHub delivery。它不是 canary 文件，也不是文档-only
改动。本准备任务不实施该 payload。

## Execution contract

- Selected Work Package: `AICC-V2-SELF-DEVELOPMENT-UAT-001`
- Execution Type: `IMPLEMENTATION`
- Sandbox: `workspace-write`
- Writer Lock: repository-level canonical lock
- Start authority: Codex MUST be started by the AICC Owner action
- External/manual Codex execution does not satisfy this Work Package gate.
- Implementation success requires `exitCode = 0` and `implementationResult = CODE_CHANGE_PRESENT`.

## Acceptance Criteria

1. AICC starts Codex for this Work Package through the Owner action.
2. The repository-level Writer Lock is `HELD` during the run.
3. The center Runtime Monitor observes the real selected-WP run, including process health and elapsed activity.
4. The run terminates truthfully with terminal state, exit code, and last activity evidence.
5. Codex produces `CODE_CHANGE_PRESENT` in real AICC product code.
6. The Writer Lock returns to `NOT_HELD` after the run terminates.
7. The implementation payload is independently verifiable without PR Runner or GitHub delivery.
8. `npm test`, `npm run build`, `npx tsc --noEmit`, and `git diff --check` pass through canonical Validation evidence.
9. Validation evidence is persisted and remains distinct from Human UAT evidence.
10. Human UAT becomes actionable only after the real implementation and validation prerequisites are reconciled.
11. Owner can complete the 20-item Human UAT Workspace using either `ITEMIZED_PASS` or `OWNER_OVERRIDE_PASS`.
12. The selected Human UAT decision mode and checklist truth are durably persisted.
13. Human UAT `PASS` does not automatically set the Work Package `CLOSED` stage to complete.
14. Authorization, implementation, validation, Human UAT, and terminal runtime evidence survive refresh, browser reload, entity switching, and Local Control Service restart.
15. No external manual mutation or fabricated lifecycle fact is required to advance this Work Package.

## Owner Human UAT Plan

以下是独立于机器 Acceptance Criteria 的 Owner-facing 人工验收计划。每项均包含稳定 ID、Owner 操作与人工可判断的通过标准。

- HUA-01 | 第一轮：启动与运行 | 在 Roadmap 选择本 Work Package | 页面显示当前 Work Package 与人工 UAT 工作台。
- HUA-02 | 第一轮：启动与运行 | 点击确认授权并确认授权结果 | Owner 授权状态显示有效且绑定本 Work Package。
- HUA-03 | 第一轮：启动与运行 | 点击启动 Codex | AICC 启动真实 Codex 运行，反馈显示已启动。
- HUA-04 | 第一轮：启动与运行 | 观察 Runtime Monitor | 运行监控显示运行中、耗时与当前活动。
- HUA-05 | 第一轮：启动与运行 | 观察运行期间的写入锁 | 运行期间写入锁显示已持有且范围为仓库。
- HUA-06 | 第二轮：真实自开发结果 | 观察 Agent 消息与命令 | 监控中能看到真实活动记录，不是静态示例。
- HUA-07 | 第二轮：真实自开发结果 | 等待 Codex 运行结束 | 终态、退出码与最近活动显示真实且一致。
- HUA-08 | 第二轮：真实自开发结果 | 查看 Runtime 的实现结果 | 实现结果显示已产生代码变更。
- HUA-09 | 第二轮：真实自开发结果 | 查看文件变更事件 | 变更事件指向 HumanUatWorkspace 产品代码。
- HUA-10 | 第二轮：真实自开发结果 | 打开 Human UAT 工作台 | 工作台显示中文优先的验收方式字段。
- HUA-11 | 第三轮：状态与持久化 | 查看逐项验收方式 | `ITEMIZED_PASS` 对应显示「逐项验收」。
- HUA-12 | 第三轮：状态与持久化 | 查看 Owner 直接通过方式 | `OWNER_OVERRIDE_PASS` 对应显示「Owner 直接通过」。
- HUA-13 | 第三轮：状态与持久化 | 点击刷新状态 | 刷新后运行、生命周期与验收方式保持一致。
- HUA-14 | 第三轮：状态与持久化 | 切换到其他实体再切回 | 本 Work Package 的证据没有丢失或串到其他实体。
- HUA-15 | 第三轮：状态与持久化 | 重新加载浏览器 | 验收方式与 Runtime 终态仍可恢复。
- HUA-16 | 第四轮：最终验收 | 重启 Local Control Service 后刷新 | 授权、验证与 Human UAT 证据仍可读取。
- HUA-17 | 第四轮：最终验收 | 检查写入锁终态 | 运行结束后写入锁显示未持有。
- HUA-18 | 第四轮：最终验收 | 逐项检查全部人工验收项 | 所有必验项均已由 Owner 明确通过或标记不适用。
- HUA-19 | 第四轮：最终验收 | 点击通过 UAT | Human UAT 显示已通过且验收方式保持真实。
- HUA-20 | 第四轮：最终验收 | 检查最终生命周期 | HUMAN_UAT 完成，但 CLOSED 仍保持未开始。

## Persistence and evidence

The dogfood loop must preserve the Owner authorization, implementation lifecycle
evidence, Validation evidence, Human UAT evidence, and latest terminal runtime
evidence where available. Rehydration must resolve the same selected Work Package
from the stable repository/entity identity.

## Domain boundaries

- `CODE_CHANGE_PRESENT` is required; a no-op run does not pass implementation.
- Runtime completion and Validation PASS do not auto-pass Human UAT.
- Human UAT PASS does not close the Work Package.
- Unresolved checklist items remain truthful under `OWNER_OVERRIDE_PASS`.
- No PR execution contract, commit/push automation, Draft PR, review, exact-head CI,
  automatic merge, or production deployment is included.

## Forbidden

- PR Runner implementation or GitHub delivery automation.
- Fake canary changes, documentation-only payloads, or synthetic lifecycle history.
- Automatic Human UAT or Work Package closure.
- Changes to Runtime, Roadmap progress, Authorization, Writer Lock, or lifecycle semantics.
