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
