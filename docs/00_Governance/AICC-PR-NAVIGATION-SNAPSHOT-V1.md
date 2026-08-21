# AICC PR Navigation Snapshot V1

## 1. Scope

The top workspace switcher remains:

`蓝图 / WP / PR / Task`

When `PR` is active:

- left = PR Navigation
- center = selected PR Detail
- right = selected PR Status / Evidence

The left side is navigation only. It must not become a PR detail panel.

## 2. Final left-sidebar structure

The PR sidebar contains only:

1. the existing current-context / lock row
2. the PR status filter row
3. the compact PR list
4. the source / refresh footer at the very bottom

Final conceptual structure:

```text
蓝图 | WP | PR | Task

CURRENT CONTEXT ROW
────────────────────────

All | Open | Draft | Merged | Closed | Unmapped

PR #1   short-title        Merged   100%
PR #2   short-title        Merged   100%
PR #3   short-title        Merged   100%
...

────────────────────────
数据来源：AICC 内部 PR 快照文件 → 浏览器缓存
手动刷新：最后更新：xx 分钟前                 ↻
```

Do not add additional cards or directory trees.

## 3. Existing current-context row must not visually change

The first row under the workspace tabs already exists, for example:

`WP - AICC-V2-DUAL-PANEL-001`

Its existing controls may include lock, flag, run, and refresh. Its height,
border, background, typography, icon placement, spacing, and interaction layout
must remain unchanged. Do not redesign this row.

The only PR-specific behavioral difference is its refresh action. When the
workspace is `PR`, refresh means `刷新PR`, not Roadmap refresh. Its visible style
remains the same.

## 4. PR status filters

Use one horizontal compact filter row:

`All | Open | Draft | Merged | Closed | Unmapped`

Rules:

- default = `All`
- use the existing active-pill visual language
- filter browser-side against the already loaded PR snapshot
- clicking a filter must not access GitHub
- clicking a filter must not read the local source again
- clicking a filter must not refresh Roadmap
- clicking a filter must not rebuild the PR snapshot

No accordion status directory or Milestone/WP tree is required.

## 5. PR list row content

Each PR row may display only:

- PR number
- short title
- status
- progress percentage
- progress bar

Example:

```text
PR #8   rebuild/aicc-v2   Draft    60%
```

Do not show repository details, a full PR description, Parent WP, SHA, commit
information, CI details, Review details, Evidence, Diff, lifecycle details,
authorization details, runtime details, or Current Action details in the left
list. Those belong in the center/right workspace.

## 6. Selected PR

Clicking a PR performs selection only:

```text
selectedPrId = prNumber
```

It then changes the center PR Detail. Clicking a PR must not refresh the PR
source, access GitHub, refresh Roadmap, recalculate PR progress, rebuild the
snapshot, or reorder the list.

The selected row uses the existing selection highlight. Preserve sidebar
scroll position and the current filter.

## 7. PR states

Navigation may expose the factual states `OPEN`, `DRAFT`, `MERGED`, `CLOSED`,
and `UNMAPPED`. The browser displays the state stored in the AICC PR snapshot
and must not infer state from UI conditions.

## 8. PR progress

Progress is stored by AICC. The browser must not calculate PR progress.

Example persisted value:

```json
{
  "progress": 60
}
```

The browser renders `60%`. Progress must not change automatically because of
execution completion, a Codex result, CI completion, Review completion, GitHub
PR state changes, WP state changes, Task changes, or reactive UI updates.

## 9. AICC PR Snapshot is the browser navigation source

Canonical flow:

```text
Local / GitHub factual source
        ↓
manual PR refresh
        ↓
AICC PR Snapshot File
        ↓
browser cache
        ↓
PR Navigation UI
```

All status and progress used by PR Navigation must first exist in an AICC-owned
persistent file. The browser UI must not use GitHub as its live source.

## 10. Persistent AICC file

Implement a dedicated persistent PR navigation snapshot/registry, following
the existing Roadmap persistence architecture where appropriate rather than
inventing a duplicate persistence system.

At minimum, each persisted PR navigation record supports:

```text
repository
prNumber
shortTitle
status
progress
parentWpId
mapped / unmapped
lastUpdated
snapshotVersion
```

Additional factual metadata may be stored when needed. The exact location
follows repository conventions. The canonical data must not live only in
component state or solely in browser `localStorage`.

## 11. Browser cache

Browser-side data is a cache of the AICC PR snapshot, not a live projection.
Normal application activity continues displaying the cached snapshot until an
explicit PR refresh. Do not introduce background polling, reactive source
re-fetch, or hidden automatic synchronization.

## 12. Only explicit PR refresh changes the snapshot

The formal PR refresh action is `刷新PR`. When the PR workspace is active and
the existing refresh control is clicked, it runs:

```text
REFRESH_PR
```

It must not run `REFRESH_ROADMAP`. The control style remains identical to the
existing Roadmap/current-context control; only behavior and context change.

## 13. Roadmap refresh and PR refresh are isolated

There are two logically distinct actions:

```text
REFRESH_ROADMAP
REFRESH_PR
```

They must not implicitly invoke one another. Roadmap refresh updates Roadmap
state. PR refresh updates the PR navigation snapshot/cache. PR refresh may read
the current factual Living Roadmap source as an input for PR-to-WP mapping,
without refreshing or mutating the visible Roadmap browser snapshot.

## 14. PR refresh factual sources

On explicit `刷新PR`, use the latest appropriate factual inputs from the
existing architecture. Inputs may include local repository facts, GitHub PR
facts, and the latest Living Roadmap when needed for mapping.

Normalize and persist the result into the AICC PR snapshot first. Replace the
browser cache/read model only after persistence succeeds. Never project raw
GitHub API responses directly into navigation UI.

## 15. Absolutely no automatic PR navigation refresh

None of the following may update PR Navigation automatically:

- switching to the PR tab
- leaving and returning to the PR tab
- selecting a PR, WP, or Task
- execution creation, running, or completion
- receiving a Codex result
- Owner UAT
- CI or Review changes
- GitHub PR changes, merge, or creation
- local branch changes
- Roadmap disk changes or Roadmap browser refresh
- Task refresh
- right-side Evidence refresh
- component mount or rerender
- a Svelte reactive update
- polling or websocket events
- app or browser reload

Only explicit `刷新PR` may rebuild the PR navigation snapshot.

## 16. Browser/App reload behavior

Browser or app reload is not PR refresh:

```text
Cmd+R / browser reload != 刷新PR
```

Reload restores or reads the existing persisted snapshot/cache. It must not
access GitHub solely because the UI was reloaded.

## 17. Unmapped

When a PR cannot be factually mapped to a Work Package, store and render
`UNMAPPED`. Do not guess. Do not infer ownership from title similarity or from
branch naming unless existing canonical evidence explicitly establishes the
mapping. Unmapped is a valid navigation state, not an error.

## 18. Ordering

V1 default ordering is stable PR number ascending:

```text
PR #1
PR #2
PR #3
...
```

Do not dynamically reorder based on current status, latest update, recent
selection, or execution activity. Filtering may hide rows but must preserve
canonical order.

## 19. Source footer placement

The source module is at the absolute bottom of the PR left sidebar and matches
the existing Roadmap source footer pattern. Do not put source information under
the PR Navigation heading, between filters and rows, or in a separate large
Source card.

Minimal footer:

```text
数据来源：AICC 内部 PR 快照文件 → 浏览器缓存
手动刷新：最后更新：2 分钟前                 ↻
```

Use the actual persisted last-refresh time.

## 20. Last Updated meaning

`最后更新` is the time of the most recent successful explicit PR refresh that
produced and persisted the current PR snapshot. It is not the last page render,
PR selection, execution, GitHub event, or Evidence refresh.

## 21. Center workspace responsibility

After selecting a PR, the center workspace owns detailed information such as
PR Identity, title, repository, branch, Parent WP, state, progress, lifecycle,
Current Action, Evidence, Diff, Review, CI, and Merge. Do not duplicate this
detail into left navigation.

## 22. Right Evidence responsibility

The right panel remains Status / Evidence. It may contain PR Workspace,
Exact-head Validation, Current Review, Current CI, Historical Review,
Historical CI, and Parent Work Package. Refreshing or changing right-side
evidence must not silently modify the left PR navigation snapshot.

## 23. Final V1 principle

The implementation preserves these invariants:

```text
AICC writes PR state.
AICC writes PR progress.
AICC persists the PR snapshot.
Browser caches and renders the snapshot.

Only 刷新PR fetches/rebuilds the PR source snapshot.

All other actions are read/select/filter only.

Left = Navigation.
Center = Detail.
Right = Evidence.
```

This document is the canonical baseline: `AICC PR NAVIGATION SNAPSHOT V1`.
