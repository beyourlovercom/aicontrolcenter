# AICC PR Lifecycle Status V1

`AICC_DECISION_AUTHORITY = 0`

`PR_PERCENTAGE_PROGRESS = REMOVED`
`PR_PROGRESS_BAR = REMOVED`

PR Navigation persists separate factual state, lifecycle status, and mapping status only through explicit `刷新PR`:

- `prState = DRAFT | OPEN | MERGED | CLOSED`
- `PR_LIFECYCLE_STATUS = IN_PROGRESS | BLOCKED | COMPLETE`
- `PR_MAPPING_STATUS = MAPPED | UNMAPPED`

Mapping never determines lifecycle status. `UNMAPPED` is neutral metadata, not a blocker or incomplete state.

Snapshot precedence is factual and deterministic: `MERGED → COMPLETE`; an explicit blocking fact or unmerged `CLOSED` → `BLOCKED`; otherwise `DRAFT` and `OPEN` → `IN_PROGRESS`. No status is inferred from titles, branches, age, milestones, or Parent Work Packages.

The canonical path remains `factual source → explicit REFRESH_PR → AICC snapshot → browser cache → navigation`. Browser selection, filtering, Roadmap refresh, and rendering only consume the persisted snapshot and never calculate lifecycle. New snapshots do not write percentage progress.

Presentation is yellow `执行中`, red `阻塞`, green `☑ Merged`, and neutral `UNMAPPED`. Filters are `All | 执行中 | 阻塞 | 完成 | Unmapped`.
