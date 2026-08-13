# AICC-V2-WORKSPACE-CONTEXT-001

Status: IMPLEMENTED / MACHINE_VALIDATED / HUMAN_UAT_PENDING
Type: OWNER_WORKSPACE_CONTEXT
Prerequisite: `AICC-V2-RUNTIME-OPERATIONS-001` CLOSED

`GLOBAL_TASK_WORKSPACE_V1 = IMPLEMENTED_BASELINE_PENDING_UAT`
`EXECUTION_CONTEXT_LOCK_V1 = IMPLEMENTED_BASELINE_PENDING_UAT`

## Frozen scope

- `GLOBAL_TASK_VIEW_TYPE = GLOBAL_WORKSPACE`
- `GLOBAL_TASK_RENDER_TARGET = CENTER_COLUMN`
- `GLOBAL_TASK_INLINE_TREE_EXPANSION = 0`
- `GLOBAL_TASK_SCOPE = GLOBAL`
- `GLOBAL_TASK_BECOMES_ENTITY_AUTHORITY = 0`
- `GLOBAL_TASK_SECOND_SOURCE_OF_TRUTH = 0`
- `VIEW_CONTEXT_SEPARATE_FROM_EXECUTION_CONTEXT = 1`
- `EXECUTION_CONTEXT_PRECEDENCE = EXPLICIT_ENTITY > OWNER_LOCK > UNKNOWN`
- `PASSIVE_NAVIGATION_CHANGES_LOCKED_EXECUTION_CONTEXT = 0`
- `OWNER_CONTEXT_LOCK_CAN_BIND_UNSCOPED_TASK = 1`
- `EXECUTION_CONTEXT_LOCK_PERSISTENT = PASS`
- `GLOBAL_TASK_VIEW_CHANGES_EXECUTION_CONTEXT = 0`
- `GLOBAL_SURFACE_IS_EXECUTION_ENTITY = 0`
- `LOCATE_ACTION_EQUALS_CONTEXT_LOCK = 0`
- `PRE_CODEX_SEMANTIC_GATE_COUNT = 0`
- `AICC_PASS_THROUGH_EXECUTION = 1`

The Global Task Workspace is a compact navigation projection of canonical
Inbox/Run state. It does not own entities, lifecycle truth, or execution.
Entity detail surfaces continue to enforce the AICC Scope Ownership Baseline.

The Execution Context Lock is an explicit Owner binding for Milestone, Work
Package, or PR. Browsing, polling, tab changes, Global Task navigation, and
unlocking do not silently change the locked target. An explicit entity in an
instruction always overrides the lock; otherwise the task remains UNKNOWN
when no explicit lock exists.

## Human UAT focus

Owner must verify the center-column Global Task Workspace, item navigation,
lock persistence across refresh and navigation, explicit-entity precedence,
unscoped task binding under an explicit lock, and strict entity isolation after
execution. No Human UAT result is preselected by this Work Package.
