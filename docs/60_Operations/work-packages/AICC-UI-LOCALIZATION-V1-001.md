# AICC-UI-LOCALIZATION-V1-001

Status: `IMPLEMENTATION COMPLETE / OWNER UAT GATE`
Date: 2026-09-07
Source of Truth: `GitHub`
Base: `main@4cce081cbc812f3be942c0286ce0253db65d2fa5`

## Objective

将 AICC V4 production UI 的所有展示层文案改为中文，并通过更短的中文标签提高页面信息密度。工程标识和 GitHub 原始事实保持原样。

## Implementation contract

- UI labels / empty states / tooltips / status bar 中文化
- Project Switcher 显示 `所有项目`
- Development Tree 显示 `项目目录 / 路线图 / 工作包 / 任务 / 合并请求 / 待我处理`
- FRESH / STALE / DRIFT 内部枚举保持不变，显示为 `最新 / 已过期 / 已漂移`
- ONLINE / OFFLINE 等 runtime 枚举保持不变，显示为 `在线 / 离线 / 观测已过期 / 未观测`
- 机器角色仅在展示层映射为中文
- repo / SHA / branch / PR / WP ID 不翻译

## Non-goals

- 不改 API schema
- 不改 GitHub facts 解析
- 不改 runtime evidence 语义
- 不增加 mutation 或执行能力
- 不在本 WP 内 merge / deploy / restart production

## Verification

- Node syntax check
- V4 full tests
- V3 full regression
- Roadmap documentation regression
- visible-English audit
- real 5-project UAT on temporary port
- production 1420 remains unchanged until explicit deploy authorization
