# AICC-V2-LOCAL-SERVICE-AUTOSTART-001: AICC 本地服务自动启动

Status: FORMAL_READY
Type: LOCAL_RUNTIME_EXPERIENCE

## Goal

使用 macOS launchd 在 Owner 登录时启动现有 Vite 集成 Local Control Service，固定绑定仓库、`127.0.0.1:1420`，并在异常退出后恢复。日常使用不要求 Owner 打开 Terminal 或运行 npm。

## Scope

- 仓库管理的 launchd 安装、状态、重启、停止与禁用脚本
- 固定仓库工作目录和持久化 stdout/stderr 日志
- `/api/health`、服务状态、日志读取与受限重启控制
- 页面加载自动刷新、服务断线重连与实体恢复
- 保留现有 Roadmap、Git、Authorization、Runtime、UAT 真值

## Machine Acceptance

1. launchd plist 存在且语法有效；2. 固定仓库 cwd；3. 登录启动；4. localhost-only；5. 端口 1420；6. 单实例/strict port；7. `/api/health`；8. 仓库可用性；9. 页面自动刷新；10. 无 Terminal 可用；11. 异常退出自动恢复；12. 重连状态；13. 重连自动刷新；14. 选中实体保持；15. Owner 重启服务；16. 重启由 supervisor 执行；17. 日志可读；18. Owner 可停止；19. Owner 可禁用；20. 证据跨重启保留；21. 不静默恢复 Autopilot；22. 不新增第二服务；23. 不暴露公网；24. UI 无任意进程执行；25. Roadmap runtime-read 不回归；26. 固定安装路径可重复执行。

## Owner Human UAT Plan

### 第一轮 · 无终端启动

- LSA-HUA-01 | 登录 Mac 后打开 `http://127.0.0.1:1420/` | 看到 AICC 页面自动加载并显示最新路线图。
- LSA-HUA-02 | 不打开 Terminal，直接选择一个 Work Package | 页面显示仓库、分支和状态证据。
- LSA-HUA-03 | 关闭并重新打开浏览器页面 | 页面自动读取本地状态，不要求手动刷新。
- LSA-HUA-04 | 观察页面顶部服务状态 | 显示本地服务正常、仓库可用、Codex CLI 状态。

### 第二轮 · 自动恢复与刷新

- LSA-HUA-05 | 暂时停止本地服务后等待 | 页面显示“本地服务正在重新连接…”。
- LSA-HUA-06 | 服务恢复后不刷新浏览器 | 页面自动恢复路线图和当前实体。
- LSA-HUA-07 | 服务恢复后切换到原选中实体 | 仍能看到同一实体的上下文和证据。
- LSA-HUA-08 | 修改正式 Roadmap 后点击刷新状态 | 新 Work Package 出现在路线图中，不需要重启服务。

### 第三轮 · 重启与日志

- LSA-HUA-09 | 点击“重启本地服务”并确认 | 页面进入重连状态，随后服务自动恢复。
- LSA-HUA-10 | 点击“查看服务日志” | 能看到启动、stdout、stderr 或明确的不可用原因。
- LSA-HUA-11 | 点击“停止自动启动” | launchd 不再登录自动启动，但 AICC 数据仍保留。
- LSA-HUA-12 | 重新启用自动启动并重新登录 | 服务按固定仓库和 localhost 端口启动。

## Safety and Non-goals

launchd 仅负责监督现有 Vite 服务，不实现 GPT Bridge、Autopilot、PR Runner 或第二后台服务。重启操作仅允许固定的本地服务 supervisor 操作，不接受 Owner 提供的命令、PID 或 shell 字符串。服务重启不得静默恢复中断的 Autopilot。

## Owner Human UAT Evidence

OWNER_HUMAN_UAT: PASS

- 页面打开后自动刷新在数秒内结束，无需点击刷新状态。
- 点击“查看服务日志”立即显示加载/日志界面。
- 点击“重启本地服务”并确认后，页面立即进入“本地服务正在重新连接…”，服务自动恢复，无需手动刷新浏览器。
- Terminal 保持关闭时，AICC 仍正常运行。
