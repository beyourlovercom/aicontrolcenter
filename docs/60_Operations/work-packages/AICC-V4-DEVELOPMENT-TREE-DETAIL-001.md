# AICC V4.3 — Development Tree + Detail View

Status: IMPLEMENTATION COMPLETE / PR GATE PENDING
Source of Truth: `GitHub`

## Scope

- Move Roadmap / WP / Task / Pull Requests / Owner Attention into the left project navigation.
- Project Roadmap headings are projected only from the exact roadmap file on GitHub main.
- Current WP and Current Task are shown only when explicit canonical labels exist.
- Open PR nodes are projected from GitHub; no merge or review decision is inferred.
- Preserve expand/collapse state per project as browser UI preference only.
- Clicking a node changes only the center detail view.
- Owner Attention remains a reserved navigation section until V4.5 provides explicit Owner-gate evidence.

## Non-goals

- No progress inference; V4.4 owns progress and drift.
- No Owner-gate inference; V4.5 owns Owner Attention facts.
- No GitHub mutation, branch switch, executor start, machine control, deploy, release, or production cutover.

## Verification Gate

- V4 unit/UI tests.
- V3 full regression.
- Real GitHub/runtime smoke for all registered project views.
- POST mutation remains rejected.
- `v3/` remains unchanged.

## Verification Result

- V4 tests: `15/15 PASS`.
- V3 regression: `63/63 PASS`.
- Real GitHub smoke: `5/5` project views available.
- AICC main correctly remained on the merged V4.2 pointer while this V4.3 branch was unmerged.
- POST mutation gate: `HTTP 405`.
- `git diff --check`: PASS.
- `v3/` changed files: `0`.
