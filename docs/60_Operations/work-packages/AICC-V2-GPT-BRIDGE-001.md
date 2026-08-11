# AICC-V2-GPT-BRIDGE-001: GPT Plus ↔ AICC ↔ Codex Bridge

Status: FORMAL_READY
Type: GPT_BRIDGE

## Goal

建立一个人工确认、可验证、可复制的双向 GPT Plus ↔ AICC ↔ Codex 桥接契约：
Owner 可导入执行指令，AICC 可导出真实运行报告。此 Work Package 只定义
契约与验收边界，本准备任务不实现产品代码。

## Primary surfaces

- `导入执行指令`
- `复制运行报告`
- Optional secondary debugging action: `复制原始日志`

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

The parser must recognize the version, validate all required fields, extract
the instruction body exactly, reject malformed/unsupported envelopes visibly,
and never treat metadata as executable shell input.

Import never auto-executes pasted or clipboard text. Owner must explicitly
launch after the parsed target and gates are shown.

## Import gates

Before launch, the single canonical execution gate must validate:

- ENTITY_MATCH
- BRANCH_MATCH
- EXPECTED_HEAD_MATCH
- WORKTREE_GATE
- OWNER_AUTHORIZATION
- WRITER_LOCK_AVAILABLE
- EXECUTION_TYPE_SUPPORTED
- SANDBOX_SUPPORTED

Mismatch or failure is shown in Owner Action Feedback. A target mismatch must
show `目标实体不一致`; switching to the target, if offered, is explicit.
Imported execution uses the existing Owner action, Local Control Service,
managed Codex runtime, Writer Lock, Runtime Monitor, and persistence path.
No second Codex launcher is permitted.

## AICC_RUN_REPORT_V1

The standard report is human-readable structured text intended for direct paste
into GPT Plus:

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

Each section reports only available evidence. `ABSENT`, `UNAVAILABLE`, and
`FAILED` remain distinct. The report includes entity/parent, execution type,
run ID, status, branch, execution HEAD, elapsed time, exit code, terminal lock,
implementation result, activity counts, final Agent message, stderr/error
summary, validation evidence, resolved lifecycle, repository HEAD/worktree/
changed files, and effective Owner status where available.

`复制运行报告` is primary. `复制原始日志` is optional and secondary. Clipboard
success shows `运行报告已复制`; failure shows `复制失败` and
`CLIPBOARD_WRITE_FAILED`.

## Machine Acceptance Criteria

1. A valid `AICC_EXECUTION_V1` envelope parses deterministically.
2. A malformed envelope is visibly rejected.
3. An unsupported envelope version is visibly rejected.
4. Entity mismatch blocks launch.
5. Branch mismatch blocks launch.
6. Expected HEAD mismatch blocks launch.
7. Unavailable Writer Lock blocks launch.
8. Authorization failure blocks launch.
9. Import uses the existing Codex runtime path.
10. Envelope metadata is never executed as shell input.
11. `AICC_RUN_REPORT_V1` contains all required sections.
12. Unavailable report fields remain truthful and distinct from absent/failed.
13. Clipboard success produces visible feedback.
14. Clipboard failure produces visible feedback and a stable error code.
15. No second Codex runtime implementation is introduced.

## Owner Human UAT Plan

Human UAT is independent of the machine contract and uses Chinese-first,
Owner-readable rounds. Each item has a stable ID, operation, and pass standard.

- HUA-01 | 第一轮：指令导入 | 打开导入执行指令 | 模态框显示中文标题、文本输入区与取消/载入操作。
- HUA-02 | 第一轮：指令导入 | 粘贴一份有效 AICC_EXECUTION_V1 | 解析结果显示目标 WP、分支、HEAD、执行类型与 Sandbox。
- HUA-03 | 第一轮：指令导入 | 修改为错误版本或缺字段 | 页面明确显示解析失败，且不会启动 Codex。
- HUA-04 | 第一轮：指令导入 | 导入目标与当前 WP 不同的指令 | 页面显示目标实体不一致，且不会静默执行。
- HUA-05 | 第二轮：Gate 与执行 | 检查 Gate 结果 | Entity、Branch、HEAD、Worktree、授权与写入锁结果可读且真实。
- HUA-06 | 第二轮：Gate 与执行 | 点击载入并启动 Codex | 必须由 Owner 显式点击后才启动现有 Codex Runtime。
- HUA-07 | 第二轮：Gate 与执行 | 在运行期间观察 Runtime Monitor | 可看到真实运行状态、活动与写入锁，不出现第二套运行器。
- HUA-08 | 第二轮：Gate 与执行 | 触发一个 Gate 失败 | Owner Action Feedback 显示中文原因与稳定错误码。
- HUA-09 | 第三轮：运行报告 | 点击复制运行报告 | 页面显示运行报告已复制，报告以 AICC_RUN_REPORT_V1 开头。
- HUA-10 | 第三轮：运行报告 | 将报告粘贴到 GPT Plus 输入区 | 报告包含实体、执行、锁、实现、活动与终态信息。
- HUA-11 | 第三轮：运行报告 | 检查不可用字段 | ABSENT、UNAVAILABLE、FAILED 没有被混为同一状态。
- HUA-12 | 第三轮：运行报告 | 查看复制原始日志 | 原始日志为次要调试操作，不取代标准运行报告。
- HUA-13 | 第四轮：持久化与异常 | 复制报告时制造失败 | 页面显示复制失败与 CLIPBOARD_WRITE_FAILED，不静默失败。
- HUA-14 | 第四轮：持久化与异常 | 刷新状态并重新打开报告 | 最新可用运行证据与 Owner 状态保持一致。
- HUA-15 | 第四轮：持久化与异常 | 切换实体再切回 | 报告不会串到其他 WP，目标上下文保持隔离。
- HUA-16 | 第四轮：持久化与异常 | 重启 Local Control Service 后刷新 | 已持久化运行状态仍可读取，缺失信息仍如实显示。

## Non-goals

明确不在本 Work Package 范围内：

- ChatGPT API、自动向 ChatGPT 网站发送消息、浏览器扩展、直接浏览器控制。
- PR execution contract、commit/push、Draft PR、CI、Review、Merge。
- PR Runner、GitHub delivery automation、WP Close capability。

## Boundaries

- `PASTE_IMMEDIATELY_EXECUTES = 0`。
- `OWNER_LAUNCH_ACTION_REQUIRED = YES`。
- `SECOND_CODEX_RUNTIME_IMPLEMENTATION = 0`。
- 不改变现有 Runtime、Authorization、Writer Lock 或生命周期语义。
