# AICC UI Localization V1 Roadmap

Roadmap-Revision: 1
Updated-At: 2026-09-07
Status: `IMPLEMENTATION COMPLETE / OWNER UAT GATE`
Authority-Base: `main@4cce081cbc812f3be942c0286ce0253db65d2fa5`

## Current milestone

`AICC UI Localization V1 — 全前台中文化`

Current Work Package: `AICC-UI-LOCALIZATION-V1-001`
Current Task: `LOCALIZE-VISIBLE-UI-001`
Next planned phase: `Owner UAT → merge gate → production code-only deploy gate`

## Goal

将 AICC 前台展示层全部中文化，提高同屏信息密度；GitHub 仓库、SHA、branch、PR 编号、WP/Task ID 与 GitHub 原始事实保持原样，不翻译、不改写。

## Scope

- 顶栏、项目切换器、所有项目总览
- 项目目录 / Development Tree
- 项目详情、路线图、工作包、任务、PR 详情
- 待我处理、三机运行状态、GPT 项目上下文
- FRESH / STALE / DRIFT 与设备状态仅做展示层中文映射
- 加载、错误、空状态、提示、tooltip、状态栏中文化

## Boundaries

- GitHub 仍是唯一项目事实源
- GPT 仍是开发编排中心
- AICC 仍为只读展示 / 建议层
- 不改变 API schema、GitHub fact parsing、runtime observation、mutation gate
- 不重新打开已经关闭的 V4.0 → V4.8 roadmap
- Production 1420 在 Owner UAT / merge / deploy gate 前保持不动
