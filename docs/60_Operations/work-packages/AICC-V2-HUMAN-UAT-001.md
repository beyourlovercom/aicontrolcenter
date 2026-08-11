# AICC-V2-HUMAN-UAT-001: Owner Human UAT Workspace

Status: FORMAL_READY
Type: HUMAN_UAT_WORKSPACE

## Goal

在 Work Package 的 UAT 标签页提供 Owner-facing Human UAT 工作台，支持确定性的验收清单、分阶段持久化、Owner 通过或需整改决策，以及可追溯的 Human UAT 证据。

Human UAT 是人工判断门。Runtime 与自动化 Validation 只能支持 Owner 审查，不得自动产生 Human UAT PASS。

## Scope

- 在 WP UAT tab 渲染真实人工验收工作台。
- 从本 Work Package 的验收标准解析验收清单，不使用 AI 生成或运行时 fixture。
- 支持每个条目的 PENDING / PASS / FAIL / N_A 决策、Owner 备注与整体 Owner 备注。
- 使用 `~/.aicc-v2/` 的稳定 repository + entityType + Work Package ID 记录本地 UAT 证据。

## Acceptance Criteria

- UAT 标签页渲染真实 Human UAT 工作台；验证：Owner 可在 WP 的 UAT 标签页看到人工验收标题、摘要、清单、问题记录、备注和操作区。
- 验收清单来自本 Work Package 的 canonical acceptance criteria；验证：清单可由正式文档解析，且不存在 AI 生成或运行时 fixture 条目。
- 每个验收条目支持 PENDING、PASS、FAIL、N_A 四种 Owner 决策；验证：每行均可显示并保存四种状态。
- Owner 条目备注持久化；验证：刷新后对应条目备注保持不变。
- Owner 整体备注持久化；验证：刷新后整体备注保持不变。
- 部分 UAT 进度可在 AICC 刷新后恢复；验证：已保存的条目状态保持不变。
- 部分 UAT 进度可在浏览器重新加载后恢复；验证：重新加载后状态与备注保持不变。
- 部分 UAT 进度可在切换到其他 WP 再切回后恢复；验证：证据仍绑定原 Work Package。
- 部分 UAT 进度可在 Local Control Service 重启后恢复；验证：重启服务后读取同一稳定实体记录。
- 未解决的必需条目阻止通过 UAT；验证：仍有 PENDING 条目时「通过 UAT」不可提交。
- 必需 FAIL 条目阻止通过 UAT；验证：存在 FAIL 条目时「通过 UAT」不可提交。
- 「标记需整改」持久化整改证据；验证：FAIL 条目或 Owner 原因保存为 NEEDS_REMEDIATION。
- 明确的 Owner PASS 持久化 Human UAT 证据；验证：Owner 显式提交且所有适用条目已解决后记录 PASS。
- Runtime COMPLETED 不自动通过 Human UAT；验证：终态 Runtime 不改变 Owner 决策。
- Automated Validation PASS 不自动通过 Human UAT；验证：自动化验证结果不改变 Owner 决策。
- Human UAT PASS 更新 WP 的 HUMAN_UAT lifecycle stage；验证：Workflow 从同一 Human UAT evidence 解析阶段状态。
- Human UAT PASS 不自动将 WP 标记 CLOSED；验证：CLOSED 仍是独立生命周期阶段。
- 其他 WP 不能读取本 WP 的 Human UAT evidence；验证：稳定实体键包含 repository、entityType 与 Work Package ID。
- Right Evidence 显示紧凑只读 Human UAT evidence；验证：右侧只显示状态、负责人和计数，不提供编辑控件。
- 正常 Human UAT 操作不污染 Git worktree；验证：保存记录只写入本地 operational state，不修改仓库文件。

## Actionability

UAT 控件只有在 lifecycle/readiness gate 允许进入 Human UAT 时可操作。进入准备阶段前可以预览清单，但 Owner 的最终决策 mutation 必须保持阻塞并显示原因。

## Domain Boundaries

- Human UAT PASS != WP CLOSED。
- Human UAT FAIL / NEEDS_REMEDIATION != 自动启动 Codex remediation。
- Runtime COMPLETED != Human UAT PASS。
- Validation PASS != Human UAT PASS。

## Evidence

Human UAT evidence must preserve repository, entity type, Work Package ID, UAT status, checklist decisions, item notes, overall note, available Owner label, createdAt, updatedAt, and final decision timestamp. No Owner identity may be invented when unavailable.

## Forbidden

- AI-generated checklist items.
- Automatic Human UAT PASS from Runtime or Validation.
- Automatic Codex remediation launch.
- Automatic WP closure.
- Git worktree mutation for normal UAT operation.
