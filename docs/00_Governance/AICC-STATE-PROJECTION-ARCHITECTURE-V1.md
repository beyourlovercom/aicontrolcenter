# AICC State Projection Architecture V1

- Document ID: `AICC_STATE_PROJECTION_ARCHITECTURE_V1`
- Version: `1.0`
- Status: `FROZEN / APPROVED_BASELINE`
- Effective date: `2026-08-18`
- Applies to: Roadmap, Blueprint, PR, and Task state projection

`AICC_STATE_PROJECTION_ARCHITECTURE_V1 = FROZEN`
`THREE_STAGE_PERSISTENT_DATA_MODEL = TRUE`

## Purpose and precedence

This is the canonical AICC V2 shared state-update architecture. New entity
types must use these layers rather than introduce independent persistence or
synchronization architectures. It governs projection architecture; specialized
entity policies remain authoritative where they add constraints without
conflicting with this document. In particular,
`AICC-V2-UI-INTERACTION-STANDARD-001` remains the specialized Roadmap UI,
interaction, and Owner-manual-sync authority.

`REAL_BROWSER_EVIDENCE_OVERRIDES_STATIC_REASONING = TRUE`
`UI_CODE_PASS_WITH_REAL_BROWSER_UNPROVEN = NOT_COMPLETE`

For state-driven UI behavior, if state changes while the DOM does not, inspect
the compiled runtime first. Do not redesign state first.

## Canonical pipeline

```text
CANONICAL_TRUTH
  -> RECONCILIATION
  -> AICC_PERSISTENT_PROJECTION
  -> BROWSER_PERSISTENT_CACHE
  -> BROWSER_MEMORY
  -> UI
```

The three persistent levels are:

1. `LEVEL_1 = CANONICAL_TRUTH`
2. `LEVEL_2 = AICC_PERSISTENT_PROJECTION`
3. `LEVEL_3 = BROWSER_PERSISTENT_CACHE`

Browser memory and UI consume Level 3. They are not additional truth levels.

`CANONICAL_TRUTH_AUTHORITY = DECLARED_ENTITY_TRUTH_SOURCE`
`AICC_PROJECTION_AUTHORITY = 0`
`BROWSER_CACHE_AUTHORITY = 0`
`UI_AUTHORITY = 0`

Both projection and browser cache are persistent and derived, rebuildable where
applicable, and non-authoritative.

`PROJECTION_PERSISTENT = TRUE`
`PROJECTION_DERIVED = TRUE`
`PROJECTION_REBUILDABLE = TRUE`
`PROJECTION_AUTHORITATIVE = FALSE`
`BROWSER_CACHE_PERSISTENT = TRUE`
`BROWSER_CACHE_DERIVED = TRUE`
`BROWSER_CACHE_AUTHORITATIVE = FALSE`

## Atomic accepted update

Every accepted update follows exactly this sequence:

```text
Canonical Truth
  -> validate and reconcile
  -> build complete new Projection
  -> atomically persist Projection
  -> update Browser Cache
  -> swap Browser Memory
  -> rerender affected UI
```

`PARTIAL_UPDATE_ALLOWED = NO`
`KEEP_LAST_ACCEPTED_STATE = TRUE`
`FAILED_UPDATE_RETains_LAST_ACCEPTED_STATE = TRUE`

If any stage fails, the last accepted projection and browser snapshot remain
visible. No partial projection or browser snapshot may be exposed.

## Data state and UI state

`DATA_STATE_UI_STATE_SEPARATED = TRUE`

Data state includes entities, lifecycle and status, progress, binding,
revision, hash, and execution or result data. UI state includes folded nodes,
selection, active tab, filters, sort, scroll position, locked context, and
panel dimensions.

UI interactions modify UI state only unless they represent a real canonical
truth mutation. Roadmap folding, Task selection, and PR filtering must not
rewrite canonical projection data.

## Entity update policies

The architecture is shared; update triggers are entity-specific.

### Roadmap

`ROADMAP_UPDATE_TRIGGER = OWNER_MANUAL_SYNC`
`ROADMAP_AUTO_SYNC = OFF`
`ROADMAP_AUTO_FILE_WATCH = OFF`
`ROADMAP_BACKGROUND_SYNC = OFF`

The Owner syncs local and GitHub Roadmap truth, reconciles it, atomically
persists `roadmap-projection.json`, updates the Browser Roadmap Cache, and
rerenders the Roadmap. This retains the specialized Roadmap policy.

### Task

`TASK_UPDATE_TRIGGER = DURABLE_TASK_EVENT`
`TASK_MANUAL_REFRESH_REQUIRED = NO`
`TASK_NORMAL_UPDATE_MODE = EVENT_DRIVEN`
`TASK_CREATE_AUTO_VISIBLE = TRUE`
`TASK_STATUS_CHANGE_AUTO_VISIBLE = TRUE`
`TASK_RESULT_AUTO_VISIBLE = TRUE`

`TASK_CREATED`, `TASK_UPDATED`, `TASK_STATUS_CHANGED`, `EXECUTION_STARTED`,
`EXECUTION_RESULT_RECEIVED`, and `TASK_COMPLETED` automatically project from
AICC Task Truth to `task-projection.json`, Browser Task Cache, browser memory,
and Task UI. Any manual Task refresh is recovery or reconciliation only.

### PR

`PR_UPDATE_TRIGGER = CANONICAL_PR_EVENT_OR_RECONCILIATION`

Trusted GitHub or AICC PR lifecycle and binding events may automatically update
the PR projection. Manual refresh is recovery or reconciliation only.

`PR_LIFECYCLE != PR_MAPPING`

### Blueprint

`BLUEPRINT_UPDATE_TRIGGER = CANONICAL_BLUEPRINT_CHANGE`

Accepted Blueprint changes automatically rebuild its projection. Manual refresh
is recovery or reconciliation only.

## Startup policy

`STARTUP_CACHE_FIRST = TRUE`
`STARTUP_EXTERNAL_TRUTH_SYNC = NO`

Browser startup first reads the browser persistent cache and renders immediate
UI. Entity policy may then reconcile that browser cache with the local AICC
projection through an internal API without contacting external truth. For Task,
this startup reconciliation is allowed and is not an external truth sync.

## Standard locations and cache keys

The AICC V2 projection family is:

```text
~/.aicc-v2/roadmap-projection.json
~/.aicc-v2/blueprint-projection.json
~/.aicc-v2/pr-projection.json
~/.aicc-v2/task-projection.json
```

The standard browser cache keys are:

```text
aicc.roadmap.snapshot.v1
aicc.blueprint.snapshot.v1
aicc.pr.snapshot.v1
aicc.task.snapshot.v1
```

Only the Roadmap path is an existing implementation baseline. The other paths
and keys are architectural targets; this baseline does not create placeholder
projections, cache entries, or entity behavior.

## Reusable implementation layers

```text
Canonical Source Adapter
  -> Reconciliation Policy
  -> Projection Builder
  -> Atomic Projection Store
  -> Browser Snapshot Store
  -> Browser Memory Store
  -> UI Projection
```

Each new entity implementation must identify these layers and preserve the
authority and atomic-update rules above.

## Proven Roadmap baseline

Roadmap is the first proven implementation of this architecture:

`ROADMAP_THREE_STAGE_DATA_PIPELINE_REAL_UAT = PASS`
`LOCAL_GITHUB_TRUTH_SYNC = PASS`
`OWNER_MANUAL_SYNC = PASS`
`AICC_PROJECTION_UPDATE = PASS`
`BROWSER_ROADMAP_CACHE_UPDATE = PASS`
`LEFT_ROADMAP_RERENDER = PASS`
`CANONICAL_ORDER_REAL_BROWSER_UAT = PASS`
`FIRST_MILESTONE = M1`
`M5_FIRST = NO`
`PAGE_RELOAD_OCCURRED = NO`
`WORKSPACE_CONTEXT_PRESERVED = PASS`
`ROADMAP_BROWSER_CACHE_PERSISTENCE = PASS`
`BROWSER_RELOAD_PERSISTENCE = PASS`

## Scope boundary and change control

This baseline freezes the shared architecture only. It does not implement
Blueprint, PR, or Task application behavior, create persistent projections, or
alter existing Roadmap behavior.

Changes require the repository baseline change-control process and explicit
Owner approval.
