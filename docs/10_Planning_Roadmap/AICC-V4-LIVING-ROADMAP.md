# AICC V4 Living Roadmap

Roadmap-Revision: 4
Updated-At: 2026-09-07
Status: `V4.8 ACTIVE / MULTI-PROJECT REAL-USE HARDENING`
Authority-Base: `main@1cb45f91cfb458baf2a146ebf0bcfbc6974e387b`
V3-Runtime-Baseline: `8998f46805723e661e700e3c55695fd3095f5fa5`

## Current milestone

`V4.8 — Multi-project Real-use Hardening`

Current Work Package: `AICC-V4-MULTI-PROJECT-HARDENING-001`
Current implementation phase: `V4.8 — implementation complete / Draft PR + exact-head CI gate`
Next planned phase: `V4 final merge gate / closure; production cutover remains a separate Owner gate`

## Canonical architecture

GitHub is the only project Source of Truth. GPT is the development orchestrator. GPT uses GitHub and Remote Desktop Commander to inspect and execute work across the authorized computers and repositories. AICC is not an execution engine and is never project authority.

```text
GITHUB_SOURCE_OF_TRUTH = 1
GPT_ORCHESTRATION_AUTHORITY = 1
AICC_AGGREGATION = 1
AICC_PROJECTION = 1
AICC_RECOMMENDATION = 1
AICC_ALERTING = 1
AICC_DISPLAY = 1
AICC_REPOSITORY_AUTHORITY = 0
AICC_ROADMAP_AUTHORITY = 0
AICC_WP_AUTHORITY = 0
AICC_TASK_AUTHORITY = 0
AICC_PR_AUTHORITY = 0
AICC_CI_AUTHORITY = 0
AICC_EXECUTION_AUTHORITY = 0
AICC_DECISION_AUTHORITY = 0
```

If AICC disagrees with GitHub, AICC is stale or drifting. GitHub wins. AICC must surface `STALE`, `DRIFT`, or `REFRESH REQUIRED`; it must not overwrite GitHub facts.

## V4 product model

AICC becomes a GitHub-backed multi-project development dashboard for Owner + GPT. It answers five questions: which projects exist, how far each project has progressed, what is active now, what requires Owner attention, and what GPT should inspect next.

Project switching changes only the displayed project context. It never switches branches, starts execution, mutates a repository, or changes machine state.

## Accepted UI baseline

The Owner accepted the V4 desktop layout on 2026-09-06.

- Top-right: `Project Switcher` with one-click switching and `All Projects`.
- Left: collapsible `Development Tree` for Roadmap / WP / Task / Pull Requests / Owner Attention.
- Center: selected item detail with progress, GitHub source SHA, PR/CI, blockers, suggested next, runtime and evidence.
- Bottom: GitHub provenance / sync status.
- Status and progress are projections of GitHub-backed facts, never an independent AICC authority.

## V4 delivery sequence and effort budget

| Phase | Capability | Planned effort |
| --- | --- | ---: |
| V4.0 | GitHub Source-of-Truth Rebaseline | 3–5h |
| V4.1 | Project Registry + GitHub Project Facts | 4–7h |
| V4.2 | Project Switcher + All Projects Dashboard | 4–7h |
| V4.3 | Development Tree + Detail View | 5–8h |
| V4.4 | Progress + Drift / Stale Detection | 3–5h |
| V4.5 | Owner Attention Center | 3–5h |
| V4.6 | Three-machine Runtime Overview | 3–5h |
| V4.7 | GPT Context Snapshot + Suggested Next | 3–5h |
| V4.8 | Multi-project Real-use Hardening | 3–5h |

Total V4 budget: `31–52h` of focused engineering work. Passive CI queue time, third-party outages and unrelated environment failures are excluded.

## V4.0 — GitHub Source-of-Truth Rebaseline

Goal: remove the obsolete planning/execution-control roadmap, lock GitHub as the only project truth, lock GPT as orchestrator, and freeze AICC as an advisory projection layer.
Exit: corrected roadmap and UI baseline are reviewed; PR remains separate from merge authorization.

## V4.1 — Project Registry + GitHub Project Facts

Goal: register multiple projects and their GitHub repositories without creating a second project authority database.
Each project exposes repository identity, default branch, main SHA, roadmap location, active WP/Task references, PR/CI facts and last refresh provenance.

## V4.2 — Project Switcher + All Projects Dashboard

Goal: add the accepted top-right one-click project switcher and an `All Projects` overview.
Switching changes only `viewProjectId`; active work in other projects continues unaffected.

## V4.3 — Development Tree + Detail View

Goal: move the accepted collapsible Roadmap / WP / Task / Pull Requests / Owner Attention hierarchy into the left navigation and show the selected node in the center detail view.
The tree must remain compact, preserve expand/collapse state per project and link every status back to GitHub evidence.

## V4.4 — Progress + Drift / Stale Detection

Goal: calculate useful progress summaries from GitHub-backed roadmap/WP/task evidence and clearly mark stale or conflicting projections.
AICC never resolves a conflict by overriding GitHub.

## V4.5 — Owner Attention Center

Goal: aggregate Human UAT, merge approval, deploy approval and other explicit Owner gates across projects.
AICC may highlight an item; GPT/GitHub reconciliation remains required before action.

## V4.6 — Three-machine Runtime Overview

Goal: display CN Mac, US Mac and Windows availability, current observed project/branch role and last activity as runtime evidence.
Runtime observations do not override GitHub project truth and do not give AICC remote execution authority.

## V4.7 — GPT Context Snapshot + Suggested Next

Goal: provide a compact, copyable project snapshot containing GitHub facts, current roadmap/WP/task, PR/CI, runtime evidence, blockers and advisory next checks.
`Suggested Next` is explicitly advisory; GPT decides and executes through GitHub/DC.

## V4.8 — Multi-project Real-use Hardening

Goal: validate the dashboard while several real projects are simultaneously active and ensure project isolation, refresh correctness, staleness handling and Owner attention remain trustworthy.

## Final operating model

```text
GitHub (only Source of Truth)
        ↓
GPT reconciliation + planning + decisions
        ↓
GitHub tools + Remote Desktop Commander
        ↓
CN Mac / US Mac / Windows / Codex / browser / runtimes
        ↓
execution evidence returns to GitHub + GPT
        ↘
         AICC projection / navigation / alerts / suggestions
```

V4 Definition of Done: AICC is a lightweight, trustworthy multi-project navigation and status layer. It never becomes a second Source of Truth and never duplicates GPT's execution role.
