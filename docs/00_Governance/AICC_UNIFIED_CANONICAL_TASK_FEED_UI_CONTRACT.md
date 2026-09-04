# AICC Unified Canonical Task Feed UI Contract

## Status

`OWNER_APPROVED_BASELINE`

## Purpose

Define the single repository-level UI governance authority for projecting a
Task collection in AICC. This document owns Task collection and list
projection. It does not redefine Task identity, lifecycle, persistence,
execution, or Task-title-to-detail interaction.

## Canonical Work Package Workspace Structure

The canonical Work Package execution workspace is ordered as follows:

```text
Command / Task Input
        ↓
Unified Canonical Task Feed
        ↓
Current Execution
        ↓
Runtime Monitor
        ↓
Execution Provider
```

The Unified Canonical Task Feed is immediately below the command/task input.
The existing Selected Task Detail Inspector remains in the established right
rail and is not part of the center-column ordering.

`WP_WORKSPACE_UI_STRUCTURE = PASS`

## Canonical Task Feed Source

Every Task origin converges through one canonical projection path:

```text
All Task Sources
        ↓
Canonical Task Registry
        ↓
Unified Canonical Task Feed Projection
        ↓
Shared One-Line Task Row
        ↓
Shared Task Title Primitive
        ↓
Global Task Selection Authority
        ↓
Existing Selected Task Detail Inspector
```

Source-specific Task registries and display-only Task duplication are
forbidden. The feed projects existing canonical Task records; it does not
create, migrate, reconcile, or mutate them.

`UNIFIED_TASK_FEED_CANONICAL_SOURCE = PASS`

`SHARED_TASK_TITLE_PRIMITIVE = REQUIRED`

`EXISTING_SELECTED_TASK_DETAIL_INSPECTOR = SINGLE_VISUAL_OWNER`

## One Feed Per Workspace

A workspace has one primary canonical Task collection. It must not split the
same Task lifecycle into primary lists such as Bridge Tasks, Manual Tasks, GPT
Tasks, Runtime Tasks, or Imported Tasks.

Task source is row metadata and may support filtering or explanation. It must
not become competing navigation or a separate primary collection.

`ONE_CANONICAL_TASK_FEED_PER_WORKSPACE = TRUE`

`TASK_SOURCE_IS_METADATA_NOT_NAVIGATION = TRUE`

`TASK_SOURCE_MUST_NOT_CREATE_SEPARATE_TASK_LIST = TRUE`

## Canonical And Display Source

Canonical source values remain stored exactly as received. Presentation uses
an explicit mapping over registered canonical values and never derives source
from labels, instructions, routes, repository names, arbitrary strings, or
other display text.

The currently registered Task execution source values are:

- `CLIPBOARD`
- `CLIPBOARD_DIRECT`
- `WEB_BRIDGE`
- `GPT_BLOCK`
- `GPT_AUTO_CONTROL_LOOP`

Their approved presentation families are:

| Canonical Task source | Display source |
| --- | --- |
| `CLIPBOARD_DIRECT` | AICC Bridge |
| `WEB_BRIDGE` | AICC Bridge |
| `CLIPBOARD` | 手动 |
| `GPT_BLOCK` | GPT Plus |
| `GPT_AUTO_CONTROL_LOOP` | GPT Plus |

Work Package origins such as `GITHUB`, `GPT_ASSISTED`, `OWNER_CREATED`, and
`AICC_SUGGESTION` are a separate domain and must not be used to infer a Task
source. A future Task source receives a display family only after it is added
to the canonical Task source registry and the presentation mapping. Unknown or
unregistered values remain explicitly unknown; they are never guessed.

Presentation mapping must not rename persisted values, rewrite historical Task
records, or alter `origin` / `origin_source` evidence.

`SOURCE_PRESENTATION_MAPPING = PASS`

`CANONICAL_SOURCE_VALUES_PRESERVED = PASS`

## Shared One-Line Task Row

Every Task in the unified feed uses one compact shared row with these visual
fields:

1. Source
2. Status
3. Task Title / Task ID
4. Time
5. Entity / Work Package binding

The row remains one line under normal desktop density. Long identity and
binding values use the established overflow behavior without expanding row
height or introducing card-per-Task presentation. Status and source must have
textual labels and must not depend on color alone.

`TASK_ROW_MODE = ONE_LINE`

`TASK_FEED_COMPACT = PASS`

`SHARED_ONE_LINE_TASK_ROW = REQUIRED`

## Task Title Interaction

The Task title is the only standard detail entry point in a feed row and must
follow `AICC_CANONICAL_TASK_INTERACTION_CONTRACT.md`:

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

The title control remains semantic, keyboard accessible, compact, and
overflow-safe. Selecting it preserves the current Work Package and opens the
existing right-side Inspector. Separate row actions such as `查看指令`,
`运行结果`, and `查看详情` are forbidden because those details belong to the
Inspector.

`TASK_TITLE_SHARED_TRIGGER = PASS`

`REDUNDANT_TASK_ROW_DETAIL_ACTIONS = FORBIDDEN`

## Projection Consolidation

Historical WEB_BRIDGE lists, source-specific Task sections, Run Record lists,
and Result Outbox lists must not remain parallel primary Task browsing
surfaces after unified-feed implementation.

This restriction applies to primary Task navigation only. Canonical Run,
Result, Outbox, instruction, and evidence data remain intact and available to
the Selected Task Detail Inspector, Runtime Monitor, and dedicated operational
or debug surfaces where appropriate.

`DUPLICATE_PRIMARY_TASK_PROJECTIONS = NONE`

`RUN_RESULT_CANONICAL_DATA_PRESERVED = PASS`

## Runtime Modules

Current Execution remains a compact current-runtime summary below the unified
feed. It may identify the current canonical Task when that binding exists, but
it is not a historical Task collection.

Runtime Monitor and Execution Provider remain infrastructure modules. They do
not own Task collection navigation and must not absorb Task history as a
replacement feed.

`CURRENT_EXECUTION_SUMMARY_PRESERVED = PASS`

`RUNTIME_MONITOR_PRESERVED = PASS`

`EXECUTION_PROVIDER_PRESERVED = PASS`

## Single Detail Owner

The existing Selected Task Detail Inspector remains the single visual owner of
Task instruction, execution, Run, Result, evidence, binding, PR, origin,
timestamps, runtime/model, and exit status. The one-line feed must not
duplicate these detail sections.

`TASK_DETAIL_SINGLE_VISUAL_OWNER = PASS`

## Future Task Collections

Any future AICC workspace that presents a primary Task collection must reuse
the canonical shared Task feed architecture and shared row. Specialized
operational, evidence, log, and debug views remain allowed when they do not
become competing primary Task navigation.

`NEW_TASK_COLLECTION_REUSES_CANONICAL_TASK_FEED = TRUE`

## Architecture Guard Contract

Architecture tests must protect ownership and relationships rather than scan
all source files for incidental words. They must verify:

- this document is the single complete Task feed/list projection rule body;
- the shared feed architecture requires the Canonical Task Registry;
- one shared one-line row delegates title interaction to the Shared Task Title
  Primitive;
- source remains metadata and cannot create primary Task lists;
- future primary Task collections reuse this architecture;
- Task detail remains owned by the existing Inspector.

Implementation-phase guards may additionally verify the shared feed and row
components once M8.2.1.10 creates them. This baseline does not claim that the
application UI has already been consolidated.

`TASK_FEED_ARCHITECTURE_GUARD_CONTRACT = PASS`

## M8.2.1.10 Governance Precondition

M8.2.1.10 Unified Canonical Task Feed implementation is not ready to execute
unless this baseline and its architecture guard pass.

`M8_2_1_10_GOVERNANCE_PRECONDITION = PASS`

## Governance Boundary

This baseline changes UI projection authority only. It does not authorize UI
implementation in M8.2.1.10.0 and does not modify Task creation, lifecycle,
persistence, reconciliation, bindings, runtime, Run, Result, Outbox, Roadmap,
or decision authority.

`AICC_DECISION_AUTHORITY = 0`

## Precedence

This document is the complete canonical rule body for Task collection/list
projection. `AICC_CANONICAL_TASK_INTERACTION_CONTRACT.md` remains the distinct
authority for Task title to Task Detail interaction. References elsewhere must
remain compact and must not duplicate either rule body.

