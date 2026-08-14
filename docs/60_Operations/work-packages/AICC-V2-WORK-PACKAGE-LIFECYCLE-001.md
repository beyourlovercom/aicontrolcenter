# AICC-V2-WORK-PACKAGE-LIFECYCLE-001

Status: CLOSED
Type: OWNER_WORK_PACKAGE_LIFECYCLE
Role: canonical lifecycle read-model and Owner projection
Prerequisite: `AICC-V2-WORKSPACE-CONTEXT-001` CLOSED
REQUIRES_AUTHORIZATION: false
IMPLEMENTATION: PASS
MACHINE_VALIDATION: PASS
REVIEW_APPLICABILITY: N_A
DELIVERY_APPLICABILITY: N_A
HUMAN_UAT: PASS

`IMPLEMENTATION = PASS`
`MACHINE_VALIDATION = PASS`
`HUMAN_UAT = PASS`
`PACKAGE_STATUS = CLOSED`
`WORK_PACKAGE_LIFECYCLE_V1 = APPROVED_BASELINE`
`HUMAN_UAT_WORKSPACE_V1 = APPROVED_BASELINE`

## Goal

Make every Work Package show its real lifecycle state consistently in the
Roadmap, Entity Header, Workflow and Owner action surfaces. The projection
must be derived from the formal Work Package contract plus persisted lifecycle
evidence, runtime terminal facts and Owner Human UAT evidence.

## Canonical contract

- `WORK_PACKAGE_LIFECYCLE_STAGE_COUNT = 9`
- `WORK_PACKAGE_LIFECYCLE_ROLE = canonical lifecycle projection`
- `SECOND_WP_LIFECYCLE_SOURCE_OF_TRUTH = 0`
- `WP_LIFECYCLE_PROJECTION_OWNER_COUNT = 1`
- `LIFECYCLE_REFRESH_REQUIRES_SERVICE_RESTART = 0`
- `ROADMAP_MANUAL_PERCENT_AUTHORITY = 0`
- `RUN_STATE_EQUALS_WP_STAGE = 0`

The canonical resolver is `resolveWorkPackageLifecycle()`. Components may
render its result but may not infer lifecycle stages from runtime labels,
manual percentages, report state, or local fallback dictionaries.

## State rules

- Formal contract discovery establishes planning/readiness applicability; it
  does not fabricate implementation or validation completion.
- Implementation and Validation require persisted lifecycle evidence, except
  a terminal Runtime fact with `CODE_CHANGE_PRESENT` may establish
  Implementation only.
- Validation PASS never implies Human UAT PASS.
- A missing authorization is `WAITING_OWNER` when the formal contract requires
  authorization; it is not a false blocker.
- Review and Delivery are `N_A` unless the formal contract explicitly
  requires them.
- Human UAT is Owner-authoritative. Machine evidence cannot auto-pass it.
- Human UAT PASS does not close a Work Package. CLOSED requires explicit
  closure evidence or a formally recorded closed package with Human UAT PASS.
- Runtime completion is a Runtime fact and never by itself closes a Work
  Package.

## Machine validation

The implementation is validated with:

```text
npm test
npm run build
npx tsc --noEmit
git diff --check
```

## Machine Acceptance

The lifecycle resolver, live Roadmap read model, Entity Context, Workflow and
Owner status projection must agree on the same real Work Package evidence.

## Owner Human UAT plan (5 items)

The Owner verifies the same selected Work Package after a browser refresh and
after a normal live state refresh. No result is preselected by this plan.

1. **真实阶段** — 选择一个已正式登记的 Work Package；通过标准：当前阶段与
   其实际持久化证据一致，不显示静态默认阶段。
2. **Roadmap 状态** — 在左侧 Roadmap 查看该 Work Package；通过标准：状态、
   百分比与 Workflow 使用同一真实生命周期投影。
3. **等待授权** — 选择一个要求 Owner 授权但尚未授权的 Work Package；通过
   标准：显示等待授权，不显示虚假的阻塞。
4. **Human UAT 边界** — 选择已完成机器验证但未完成人工验收的 Work Package；
   通过标准：显示等待人工 UAT，机器验证不会自动通过 UAT。
5. **刷新一致性** — 刷新页面并切换到另一个实体再切回；通过标准：阶段、状态、
   Roadmap 百分比和 Workflow 仍来自同一持久化事实。

## Non-goals

No Runtime architecture, Auto Execute, Terminal Handoff, GPT Bridge,
authorization policy, Human UAT semantics, PR Runner or lifecycle automation
is introduced by this Work Package.

## Human UAT status

`MACHINE_VALIDATION = PASS`
`OWNER_HUMAN_UAT = PASS`
`PACKAGE_STATUS = CLOSED`

## Approved Human UAT Workspace V1 baseline

`OPEN_UAT_MODE = ACTIONABLE`
`CLOSED_UAT_MODE = READ_ONLY_HISTORY`
`HUMAN_UAT_AUTHORITY = OWNER`
`UAT_ACTION_AUTHORITY_COUNT = 1`
`UAT_FOREIGN_ENTITY_DATA_COUNT = 0`
`OWNER_ACTIONS_AT_TAB_TOP = 1`
`BOTTOM_BUSINESS_ACTION_COUNT = 0`

Open UAT has one top action row. Read actions are `验收证据`、`运行结果`、
`原始指令`; mutation actions are `保存进度`、`退回整改`、`通过UAT`.
The summary fields are `验收状态`、`验收进度`、`验收方式`. The checklist
columns are `检查项`、`预期结果`、`实际结果`、`状态`; actual results,
checkbox state, issues and Owner note are persisted by `保存进度`.
`通过UAT` requires required items, non-empty actual results and no unresolved
blocking issues. Human UAT PASS does not automatically close the Work Package.

Closed UAT is read-only history with the top read actions plus `已完成 · 只读`.
Its summary includes `验收状态`、`验收进度`、`验收方式` and actual completion time.
Its historical checklist uses the same four columns, and checklist state,
actual results, issue history and Owner notes are not editable.
