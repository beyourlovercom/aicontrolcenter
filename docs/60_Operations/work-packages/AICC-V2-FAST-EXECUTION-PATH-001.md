# AICC-V2-FAST-EXECUTION-PATH-001: 快速执行路径

Status: OWNER_UAT_PASS / STABILIZED
Type: GLOBAL_EXECUTION_FOUNDATION_REMEDIATION

## Goal

Owner 点击执行后由 AICC 自动进行 bounded live preflight，复用现有 Owner Authorization、Writer Lock 和 Codex Runtime，在不要求手动刷新或重复授权的情况下开始安全执行。

## Stabilization Evidence

- Gate Consolidation: PASS
- Local Service stale recovery: PASS
- Expected in-scope scope evolution: AUTO_REMEDIATE; same lease remains active

## Gate severity

- AUTO_REMEDIATE：陈旧快照、陈旧 HEAD/Worktree 展示、服务刚重连、授权元数据需要安全重验证。
- WARN：非关键 Evidence 不可用、已知非冲突的范围外修改。
- HARD_BLOCK：仓库/分支错误、未知冲突修改、Writer Lock 被他人持有、范围越界、Sandbox 不匹配或危险操作。

## Scope

实现 worktree provenance 与 WP Execution Lease 基础；执行请求自动读取 live repository、Roadmap、formal WP、授权、Writer Lock、execution type、sandbox 与 runtime availability。Lease 允许同一 WP 的 bounded implementation/validation/revalidation，直到 Owner 停止、范围越界、分支/仓库改变、过期、未知冲突或 Human UAT hard stop。

## File Scope

- `docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md`
- `docs/60_Operations/work-packages/AICC-V2-FAST-EXECUTION-PATH-001.md`
- `package.json`
- `scripts/aicc-local-service-supervisor.sh`
- `src/App.svelte`
- `src/app.css`
- `src/lib/context/**`
- `src/lib/model/**`
- `src/lib/controlService.ts`
- `src/lib/authorizationTransition.test.ts`
- `src/lib/authorization.test.ts`
- `src/lib/fastExecution.ts`
- `src/lib/fastExecution.test.ts`
- `src/lib/runtimeManager.ts`
- `src/components/entity/OwnerActionZone.svelte`
- `src/lib/actionFeedback.test.ts`
- `vite.config.ts`

## Known Non-Conflicting WIP

- `src/lib/bridgeCore.ts`
- `src/lib/bridgeCore.test.ts`
- `src/lib/localServiceAutostart.test.ts`
- `src/lib/localServiceRecovery.ts`
- `src/lib/localServiceRecovery.test.ts`

## Machine Acceptance

1. 自动刷新陈旧快照；2. 无需手动刷新；3. CLEAN 通过；4. 已知范围内 dirty 通过；5. AICC run-owned dirty 通过；6. 已知非冲突 dirty 警告；7. 未知冲突 dirty 阻塞；8. provenance 保留；9. lease 可授予；10. 预期修改不使 lease 失效；11. 分支改变失效；12. 仓库改变失效；13. scope 扩大失效；14. Owner stop 失效；15. Human UAT hard stop；16. stale snapshot 不阻塞授权；17. 不重复授权；18. canonical Writer Lock；19. 非关键 evidence 不阻塞；20. hard blocker fail closed；21. bounded remediation；22. 无 dead-end；23. 保留诊断刷新；24. 复用 Codex Runtime；25. GPT Bridge 可消费基础。

## Owner Human UAT Plan

### 第一轮 · 快速执行

- FEP-HUA-01 | 不点刷新直接执行 | AICC 自动读取最新状态并开始 preflight。
- FEP-HUA-02 | 已授权 WP 再次执行 | 不重复要求同一授权。
- FEP-HUA-03 | 当前 WP 产生已知范围内 dirty | 仍可继续并显示 provenance。
- FEP-HUA-04 | 观察 Runtime | Codex 真实进入 RUNNING，而非伪造状态。

### 第二轮 · 真正阻塞

- FEP-HUA-05 | 模拟 stale state | AICC bounded 自动修复并继续或给出原因。
- FEP-HUA-06 | 关闭非关键 Evidence 源 | 执行仍可开始，缺失证据显示警告。
- FEP-HUA-07 | 引入未知冲突修改 | 执行被 hard block，不绕过安全门。
- FEP-HUA-08 | 查看阻塞页面 | 页面说明原因和 Owner 下一步。

## Boundary

不实现完整 Autopilot、GPT Bridge 001B、PR Runner、自动 Human UAT、Owner Override 或 WP 自动关闭。Bridge 001A 复用本基础；刷新按钮仅为诊断入口。
