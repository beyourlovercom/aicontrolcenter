## Why

AIcontrolcenter 需要把仓库内 OpenSpec 的规格、Change 生命周期和任务完成度呈现为冻结的三栏只读界面，否则用户无法从统一视图判断当前 Work Package 的计划状态、证据和权威来源。现在建立只读进度读取模型，可以在不引入执行、远端同步或仓库写入的前提下，把规划事实与本地 Git 验证证据关联起来。

## What Changes

- 新增只面向 AIcontrolcenter 自身仓库的 OpenSpec 进度读取模型。
- 读取 `openspec/specs/`、`openspec/changes/` 和归档 Change，并映射为 Roadmap、Work Package、规格、任务和实施详情。
- 从 `tasks.md` checkbox 计算任务进度，并识别缺失文件、格式错误、空任务和部分完成状态。
- 将 Git HEAD、branch、working tree、测试结果和验证报告作为本地 Evidence，区分 OpenSpec 状态与 Git Evidence 的不一致。
- 将模型映射到冻结的左栏、中栏、右栏；右栏提供 Evidence、验证、文件、Git 状态和 Authority 展示。
- 以安全状态标记无法判定的输入，包括多个活跃 Change、远端 Authority 不可获得和 `UNKNOWN`。
- 明确禁止 `git fetch`、远端修改、PR 创建、部署、进程执行和通过界面写入仓库。

## Capabilities

### New Capabilities

- `openspec-progress-read-model`: 从 OpenSpec 与本地 Evidence 构建只读、可诊断的三栏界面数据模型。

### Modified Capabilities

- 无。当前 `openspec/specs/` 中没有可修改的既有能力规格。

## Impact

- 影响 AIcontrolcenter 的只读数据读取层、状态归一化、任务进度计算和三栏界面数据映射。
- 需要定义 OpenSpec Markdown 解析边界、错误诊断结构、Git 本地证据接口和 Authority 表达方式。
- 不引入外部项目注册、远程 Git 操作、仓库写入、执行器、PR、部署或新的远端 API。
