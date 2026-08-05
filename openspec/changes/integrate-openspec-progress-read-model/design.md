## Context

本 Change 仅为当前仓库的 v0.2.0-visible 只读应用定义读取模型，应用代码保持不变。OpenSpec 文档结构和本地 Git 状态可能不完整或互相矛盾，因此设计必须优先保留来源、诊断和不确定性，而不是推断成功。

## Goals / Non-Goals

**Goals:**

- 建立从 OpenSpec 文件、归档 Change、本地 Git 和验证结果到统一领域模型的单向读取管线。
- 让任务 checkbox 进度、生命周期状态、文件诊断和 Authority provenance 可被界面直接消费。
- 为三栏界面提供稳定的 Roadmap、Work Package、详情和 Evidence 结构。
- 在输入不完整、多个活动 Change 或证据冲突时安全降级。

**Non-Goals:**

- 不支持多项目注册、项目切换或跨仓库聚合。
- 不执行 shell、Git fetch、远端查询、写文件、修改 Git、创建 PR 或部署。
- 不在本 Change 中实现应用代码、交互控制或新的远端服务。

## Decisions

- **采用分层只读管线：** 先发现文件并解析为带来源的原始文档，再校验和归一化为状态与进度，最后映射为三栏视图模型。相比直接由 UI 读取 Markdown，这能集中处理错误并保持展示结构稳定。
- **采用 capability 级 delta spec：** 新增 `openspec-progress-read-model` 作为唯一能力规格，所有输入、状态和映射行为在同一可验证契约下定义；没有现有主规格需要修改。
- **采用 checkbox 作为任务进度唯一计算输入：** 只统计约定的 Markdown checkbox，保留原始任务文本和解析诊断。相比根据标题或文档状态猜测进度，这避免把计划存在误判为执行完成。
- **采用显式状态优先级和冲突诊断：** 无法满足完整性或证据一致性的条件时输出 `INVALID`、`BLOCKED` 或 `UNKNOWN`，并附冲突原因。相比隐式覆盖状态，这使用户能区分规划问题、实施问题和验证缺口。
- **采用本地 Evidence 与 Authority 分离：** OpenSpec 表示规格与生命周期事实，本地 Git 表示当前 checkout 证据，测试和验证报告表示 Verification Evidence；远端不可用时不进行网络补偿。相比把 branch 或 OpenSpec 当作唯一真相，这符合产品边界并避免虚假确认。
- **采用来源引用而非复制事实：** 每个节点、文件、诊断和 Evidence 项携带仓库相对路径及可用的 Git 标识，界面通过引用展示原文摘要。相比把文档内容散落到多个 UI 状态，这便于审计和错误定位。

## Risks / Trade-offs

- [Markdown 结构变化] → 将解析器限制在可验证的标题、场景和 checkbox 规则，并为未知结构保留诊断与 `UNKNOWN` 状态。
- [多个活跃 Change 造成选择歧义] → 展示全部候选并明确 `BLOCKED`，不使用时间或文件名静默仲裁。
- [本地 working tree 脏导致证据不稳定] → 将 dirty 状态作为一等 Evidence，禁止仅凭文档完整性返回 `VERIFIED`。
- [远端 Authority 不可获得] → 只报告本地 HEAD、branch 和 working tree，明确标注远端不可用，不执行 fetch 或猜测远端状态。
- [测试与验证报告格式不统一] → 将其作为可选、带来源的 Verification Evidence；无法解析时记录诊断，不提升生命周期状态。
- [读取大量历史 Change 的性能成本] → 先建立目录级索引，再按当前选择加载详情；归档数据只用于历史列表和按需详情。

## Migration Plan

本 Change 不迁移持久化数据，也不改变现有 OpenSpec 文件。实现阶段先以只读适配层消费现有目录结构，再接入冻结三栏界面；回滚时移除读取模型接入即可，不需要数据库或远端回滚。

## Open Questions

- 验证报告的具体文件命名和格式尚未由当前仓库既有规范定义；实现时应沿用项目实际产物，并对未识别格式显示诊断。
