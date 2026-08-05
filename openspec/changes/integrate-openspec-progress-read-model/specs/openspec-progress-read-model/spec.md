## Purpose

为 AIcontrolcenter 提供一个只读、可诊断且可计算进度的 OpenSpec 读取模型，将规划文档与本地 Git 和验证证据安全映射到冻结的三栏界面。

## ADDED Requirements

### Requirement: Read only the current AIcontrolcenter repository

系统 MUST 只读取当前 AIcontrolcenter 仓库中的 OpenSpec 和本地 Git 数据，不提供添加或切换其他项目的能力。读取模型 MUST 不执行远端同步、仓库写入、PR 创建、部署或任意用户指定命令。

#### Scenario: Build the repository scope
- **WHEN** 读取模型初始化
- **THEN** 它将当前仓库作为唯一项目上下文，并从本地 `openspec/` 和本地 Git 状态读取数据

#### Scenario: Reject write or execution controls
- **WHEN** 用户或界面请求 fetch、远端修改、PR、部署、命令执行或写入仓库
- **THEN** 读取模型拒绝该请求并保持仓库不变

### Requirement: Parse OpenSpec sources into a normalized model

系统 MUST 将 `openspec/specs/` 映射为已批准的系统规格，将 `openspec/changes/` 映射为活跃 Work Packages，将 Change 的 `proposal.md` 映射为摘要、目标和范围，将 `design.md` 映射为技术设计与控制逻辑，将 `tasks.md` checkbox 映射为可计算任务，将归档目录映射为已完成历史。

#### Scenario: Map an active Change
- **WHEN** Change 包含 proposal、delta spec、design 或 tasks 文件
- **THEN** 模型为其生成 Work Package 节点，并保留每个已发现文件的来源路径和解析结果

#### Scenario: Map an archived Change
- **WHEN** Change 位于归档目录
- **THEN** 模型将其标记为历史记录，不将其作为当前活跃 Work Package 计入活动选择

#### Scenario: Handle multiple active Changes
- **WHEN** 当前仓库存在多个活跃 Change
- **THEN** 模型保留全部 Change，并将选择歧义诊断为 `BLOCKED` 或 `UNKNOWN`，不得静默选择一个 Change

### Requirement: Calculate task progress and validate Markdown inputs

系统 MUST 从 `tasks.md` 中识别标准 checkbox 项，分别计算总任务数、已完成数、未完成数和进度百分比。系统 MUST 对缺失文件、Markdown 格式错误以及没有任何任务的 `tasks.md` 产生结构化诊断，而不是伪造完成度。

#### Scenario: Calculate partial completion
- **WHEN** tasks 文件包含已勾选和未勾选的任务
- **THEN** 模型返回对应计数和百分比，并将 Work Package 标记为部分完成而非已验证

#### Scenario: Handle empty tasks
- **WHEN** `tasks.md` 存在但没有 checkbox 任务
- **THEN** 模型返回空任务诊断，进度为不可计算，并至少将状态标记为 `INVALID` 或 `UNKNOWN`

#### Scenario: Handle missing or malformed files
- **WHEN** proposal、spec、design 或 tasks 文件缺失，或文件无法按约定 Markdown 结构解析
- **THEN** 模型保留可读取的部分数据，记录文件级错误，并将受影响状态降级为 `INVALID` 或 `UNKNOWN`

### Requirement: Normalize lifecycle and evidence status

系统 MUST 支持 `PROPOSED`、`PLANNING`、`READY`、`IMPLEMENTING`、`BLOCKED`、`VERIFYING`、`VERIFIED`、`ARCHIVED`、`INVALID`、`UNKNOWN` 状态。状态计算 MUST 同时考虑 OpenSpec 文档状态、任务进度、验证结果和本地 Git Evidence；OpenSpec 状态与 Git Evidence 不一致时 MUST 显式报告不一致，不得将其静默合并为成功状态。

#### Scenario: Report verified work
- **WHEN** Change 文档完整、任务全部完成、验证结果通过且本地 Evidence 与其一致
- **THEN** 模型返回 `VERIFIED` 并展示形成该结论的证据

#### Scenario: Report dirty working tree
- **WHEN** Work Package 看似可实施或已完成但 Git working tree 不干净
- **THEN** 模型展示 dirty 状态，并阻止其被无条件标记为 `VERIFIED`

#### Scenario: Report unavailable remote authority
- **WHEN** 远端 Authority 无法获得
- **THEN** 模型保留本地 HEAD、branch 和 working tree Evidence，并将远端权威标记为不可用，状态不得假设为远端已验证

### Requirement: Map normalized data to the frozen three-column interface

系统 MUST 将 Roadmap 和 Work Package 层级树映射到左栏，将当前 Work Package 的规格、任务、状态和实施详情映射到中栏，将 Evidence、验证结果、文件、Git 状态和 Authority 映射到右栏。每个展示项 MUST 能追溯至本地来源路径或诊断。

#### Scenario: Select a Work Package
- **WHEN** 用户选择左栏中的 Work Package
- **THEN** 中栏展示该 Work Package 的 proposal、delta specs、design、tasks、归一化状态和任务进度，右栏展示其关联证据

#### Scenario: Display diagnostics in context
- **WHEN** 当前 Work Package 存在缺失文件、解析错误或状态不一致
- **THEN** 右栏展示对应诊断、来源路径和影响范围，而不是隐藏或替换错误数据

### Requirement: Preserve authority provenance

系统 MUST 将 OpenSpec 规格和 Change 生命周期作为规格事实源之一，将本地 Git HEAD、branch 和 working tree 作为本地 Evidence，并将测试结果与验证报告作为 Verification Evidence。模型 MUST 区分规格权威、Git Authority 和验证 Evidence 的来源与可信范围。

#### Scenario: Show authority layers
- **WHEN** 当前 Work Package 有 OpenSpec 文档、本地 Git 信息和验证结果
- **THEN** 右栏分别展示这些来源及其时间或可用性信息，不把 OpenSpec 单独表示为唯一 Git Authority
