# AICC Canonical Task Interaction Contract

## Status

`OWNER_APPROVED_BASELINE`

## Purpose

Define one permanent interaction architecture for every canonical Task rendered
in AICC UI. This contract applies to current and future pages, workspaces,
tables, lists, dashboards, Roadmap projections, Work Package projections, PR
projections, and execution/history projections.

This document is the single canonical Source of Truth for Task-title-to-Task-
Inspector interaction across AICC.

## Canonical Hierarchy

```text
Task data
   ↓
Canonical task_id
   ↓
Shared Task Title Primitive
   ↓
Global Task Selection Authority
   ↓
Existing Selected Task Detail Inspector
```

`CANONICAL_TASK_INTERACTION_HIERARCHY = PASS`

No page may bypass this hierarchy when presenting a canonical Task as an
inspectable Task identity.

## Canonical Task Identity

Task Detail always resolves from canonical `task_id`.

`TASK_DETAIL_RESOLUTION_KEY = canonical task_id`

A page's current Work Package, Milestone, PR, Roadmap selection, route, or
display label must not override the Task's actual canonical binding. Arbitrary
display text must not be used to derive Task Detail identity.

`TASK_DATA_TO_CANONICAL_TASK_ID = PASS`

## Shared Task Title Primitive

One shared UI primitive owns the rendering of inspectable canonical Task titles
and IDs. Its final implementation name must follow repository component naming
conventions and reuse an equivalent shared owner if one exists.

`SHARED_TASK_TITLE_PRIMITIVE_REQUIRED = TRUE`

`CANONICAL_TASK_TITLE_RENDERING_AUTHORITY = SHARED_TASK_TITLE_PRIMITIVE`

M8.2.1.9 may create one shared primitive only if no equivalent reusable
primitive exists. Pages must not create independent trigger behavior.

## Future Task Surface Contract

`FUTURE_TASK_SURFACE_CONTRACT`

Any present or future AICC UI surface that renders a resolvable canonical Task
title or canonical Task ID as the primary inspectable Task identity must use the
shared Task Detail trigger primitive.

Pages must not:

- implement page-specific Task Detail open behavior;
- create a competing selected-Task state authority;
- create another right-side Task Detail;
- navigate to a duplicate Task Detail page merely to inspect a Task;
- render an inspectable, resolvable canonical Task title as inert text.

`NEW_TASK_SURFACE_REUSES_SHARED_TASK_TRIGGER = TRUE`

`PAGE_SPECIFIC_TASK_DETAIL_TRIGGER = FORBIDDEN`

## Task Collection Projection Reference

Task collection/list projection is governed separately by
`AICC_UNIFIED_CANONICAL_TASK_FEED_UI_CONTRACT.md`. This document continues to
own only Task title to Task Detail interaction; the unified feed contract owns
Task collection composition, source presentation, and shared-row reuse.

## Global Task Selection Authority

Every shared Task-title interaction resolves canonical `task_id` and delegates
to one global Task selection owner, which projects the selected Task through the
existing Inspector.

```text
Shared Task Title Primitive
   ↓
select/open canonical task_id
   ↓
Global Task Selection Authority
   ↓
Existing Selected Task Detail Inspector
```

`GLOBAL_TASK_SELECTION_AUTHORITY = SINGLE`

`TASK_SELECTION_SINGLE_SOURCE_OF_TRUTH = PASS`

Page-local state may coordinate presentation only when it delegates to the
single canonical owner and does not become a second source of truth.

## Single Task Detail Owner

The existing Selected Task Detail Inspector remains the only Task Detail visual
owner and consumes the existing canonical Task Detail data pipeline.

`EXISTING_SELECTED_TASK_DETAIL_INSPECTOR = SINGLE_VISUAL_OWNER`

`TASK_DETAIL_SINGLE_VISUAL_OWNER = PASS`

`TASK_DETAIL_SINGLE_DATA_OWNER = PASS`

`DUPLICATE_TASK_DETAIL_IMPLEMENTATION = FORBIDDEN`

`DUPLICATE_TASK_DETAIL_FETCH_PIPELINE = FORBIDDEN`

Forbidden page-specific variants include `TaskDetailV2`, `WpTaskDetail`,
`PrTaskDetail`, `RoadmapTaskDetail`, `DashboardTaskDetail`, `TaskQuickDetail`,
`TaskModalDetail`, and `TaskDrawerDetail`, unless an Owner-approved architecture
change explicitly supersedes this baseline.

## Right-Side Inspector Contract

The established right-side Inspector is the canonical Task Detail location.

```text
Current page
   ↓
click canonical Task title
   ↓
current page remains active
   ↓
Existing Selected Task Detail Inspector appears
   ↓
close / deselect
   ↓
previous right-side context returns
```

`TASK_DETAIL_LOCATION = EXISTING_RIGHT_INSPECTOR`

`CURRENT_PAGE_PRESERVED = TRUE`

`TASK_INSPECTOR_TEMPORARY_OWNERSHIP = TRUE`

`PREVIOUS_RIGHT_CONTEXT_RESTORATION = REQUIRED`

The standard inspect action must not introduce a modal, bottom drawer, second
right rail, duplicate center-panel detail, or route-only Task Detail.

## Task Switching

When the Inspector is open, selecting Task B replaces Task A in the same
Inspector. Inspectors never stack and duplicate panels never open.

`TASK_SWITCH_USES_EXISTING_INSPECTOR = TRUE`

`TASK_INSPECTOR_STACKING = FORBIDDEN`

## Canonical and Non-Canonical Content

A canonical Task uses the shared clickable primitive only when canonical
`task_id` is resolvable and the UI represents that Task as an inspectable Task
identity. This includes canonical Task tables and WP, PR, Roadmap, and
execution/history Task projections.

`UNKNOWN`, `UNMAPPED`, legacy free text, plain logs, counts, and unresolved
historical strings remain normal text and must never fabricate a Task identity.

```text
CANONICAL TASK
→ SHARED CLICKABLE TASK PRIMITIVE

UNKNOWN / UNMAPPED / NON-CANONICAL STRING
→ NORMAL TEXT
→ NO FABRICATION
```

`UNKNOWN_TASK_NOT_FABRICATED = PASS`

## Presentation and Accessibility

The shared primitive must use a semantic keyboard-accessible control with
pointer and hover affordance while preserving the existing visual language,
ellipsis, row height, and table/list dimensions.

It must not add redundant detail buttons, wrap IDs, expand columns, increase
row height, or introduce horizontal overflow.

`TASK_TITLE_LINK_AFFORDANCE = REQUIRED`

`TASK_TITLE_KEYBOARD_ACCESSIBLE = TRUE`

`TASK_TITLE_LAYOUT_REGRESSION = FORBIDDEN`

## Architecture Test Contract

Focused architecture and UI tests must protect behavior and ownership rather
than naively banning the legitimate text `task_id` repository-wide. Tests must
verify the shared primitive contract, canonical `task_id` resolution, known
Task renderer adoption, the single global selection authority, the single
Inspector owner, Task switching, deselection restoration, and the future
surface reuse rule.

`TASK_INTERACTION_ARCHITECTURE_TEST_CONTRACT = PASS`

Every future WP or PR introducing a canonical Task UI surface must prove:

`NEW_TASK_SURFACE_REUSES_SHARED_TASK_TRIGGER = PASS`

## M8.2.1.9 Governance Precondition

M8.2.1.9 Universal Task Detail Inspector Trigger is not ready to execute until
this governance baseline passes. Its implementation must follow the canonical
hierarchy and establish or reuse one shared Task Title Primitive; it must not
patch pages independently.

`M8_2_1_9_GOVERNANCE_PRECONDITION = PASS`

## Precedence

This document is the repository governance baseline for canonical Task UI
interaction. If a page implementation, generated code, Codex instruction, Task
UI, Roadmap UI, WP UI, PR UI, dashboard UI, agent suggestion, or historical
design note conflicts with this contract, this baseline wins unless explicitly
superseded by Owner-approved architecture change control.
