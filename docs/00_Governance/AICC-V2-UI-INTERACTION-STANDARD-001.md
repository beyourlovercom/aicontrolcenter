# AICC V2 UI / Interaction Standard

- Document ID: `AICC-V2-UI-INTERACTION-STANDARD-001`
- Version: `1.5` (`AICC_ROADMAP_CONTEXT_UI_BASELINE = V1.0`)
- Status: `FROZEN / APPROVED_BASELINE`

`AICC_UI_INTERACTION_BASELINE = FROZEN`
`AICC_ROADMAP_CONTEXT_UI_BASELINE_STATUS = FROZEN`
`SILENT_UI_BASELINE_OVERRIDE = FORBIDDEN`

The Roadmap + Current Context v1.0 baseline freezes the architecture, data
authority, projection, manual synchronization, navigation state, interaction,
and performance rules in this document. Material changes require an explicit
baseline change and Owner approval.

## Three state domains

Roadmap behavior keeps these domains separate:

1. `CANONICAL_ROADMAP_DATA` — Local and configured GitHub copies of
   `docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md`.
2. `AICC_ROADMAP_PROJECTION` — A derived, UI-ready, rebuildable read model;
   it is never a source of truth.
3. `ROADMAP_UI_STATE` — Browser-local interaction state including
   `expanded_nodes`, `selected_entity`, `navigation_context`,
   `locked_execution_context`, `roadmap_expand_mode`, and scroll position.

The domains must not be conflated.

`AICC_DECISION_AUTHORITY = 0`
`ROADMAP_PROJECTION_AUTHORITY = 0`

## Shell and language

The primary shell is Roadmap/Navigation on the left, selected entity and Owner
actions in the center, and Status & Evidence on the right. Feature Work
Packages must not redesign this shell independently. The Roadmap hierarchy and
Current Context behavior are governed by the frozen rules below.

Owner-facing UI is Chinese-first. SHA, HEAD, Run ID, paths, reason codes, and
internal states remain available as secondary evidence.

## Interaction rules

Button enabled state is advisory UX only. Every consequential action performs a
fresh live canonical decision on click. Normal operation must not require
manual refresh, repeated identical authorization, terminal use, or service
restart. Failures visibly include state, reason, impact, and next action.

Runtime COMPLETED, Validation PASS, Human UAT PASS, Bridge CONSUMED, and WP
CLOSED remain separate domains. Human UAT rounds contain at most seven items;
only the current round is expanded by default.

The approved AICC V2 visual system—spacing, cards, badges, actions, evidence
typography, and Chinese-first labels—is shared across features.

The specialized Web Bridge UI authority is
`AICC-WEB-BRIDGE-UI-STANDARD-001` v1.0, frozen and approved effective
`2026-08-14`. It inherits this general baseline and governs Chrome Extension,
GPT Web Bridge, executable action rail, composer action, and Bridge panel UI
specifics without replacing this document.

## Roadmap canonical projection

The Roadmap is a high-information-density project navigation tree with a
maximum of three visual levels:

`Milestone → Formal Work Package → PR or Phase`

PR and Phase are parallel children of a Formal Work Package. A Phase is an
internal progression or delivery phase; a PR is a Git delivery unit. Binding
metadata may relate them, but neither may visually contain the other. Tasks,
Instructions, Executions, and Runs belong to execution or detail surfaces and
must not create another Roadmap level.

- `ROADMAP_MAX_VISUAL_DEPTH = 3`
- `ROADMAP_HIERARCHY = MILESTONE → FORMAL_WP → PR_OR_PHASE`
- `PR_PHASE_RELATION = PARALLEL`

Canonical identifiers and formal English titles remain preserved in source
data. An approved concise Chinese-facing display title may be projected where
it improves information density.

### Roadmap status and progress authority

For every represented Milestone, Formal Work Package, PR, and Phase, visible
status and progress come only from explicit `Status:` and `Progress:` metadata
in `docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md`. Missing percentages must
not be calculated. A complete entity uses `Status: COMPLETE` and
`Progress: 100%`.

AICC must not derive Roadmap status or progress from task, execution, or Run
counts; GitHub state; child averages; or UI-local logic. Runtime Task,
Execution, Run, and Result state remains separate canonical durable truth.

- `ROADMAP_PROGRESS_SINGLE_SOURCE_OF_TRUTH = TRUE`
- `AICC_PROGRESS_CALCULATION_AUTHORITY = 0`
- `AICC_ROADMAP_STATUS_INFERENCE_AUTHORITY = 0`

Canonical workflow statuses retain their exact meaning. The compact Roadmap
projection groups them into exactly three visual icon families:

- red circular icon: blocked, failed, or unable to advance;
- yellow circular icon: planned, ready, active, executing, waiting, reviewing,
  or otherwise not complete;
- green checkbox/checkmark icon: merged, complete, closed, or successfully
  ended.

`ROADMAP_STATUS_ICON_FAMILIES = 3`

Hovering a status icon must expose the exact canonical status and progress in a
tooltip; the three-family icon never replaces detailed state.

`ROADMAP_STATUS_TOOLTIP = REQUIRED`

### Roadmap row geometry

Every row uses one shared horizontal structure:

`[fold affordance] [entity label] [progress] [status icon]`

Owner-approved baseline override: every Roadmap entity label uses the single
canonical string `{CODE} - {TITLE}`. The code and title are one visible text
value and one layout item; they are not separate DOM or grid items. Content is
flexible; progress and status occupy independent fixed areas that a long label
cannot push, cover, or overlap.

`ROADMAP_ENTITY_LABEL_FORMAT = "{CODE} - {TITLE}"`
`ROADMAP_ENTITY_LABEL_DOM_TEXT_NODE_COUNT = 1`
`ROADMAP_CODE_TITLE_SEPARATE_LAYOUT = NO`
`ROADMAP_ENTITY_LABEL_SINGLE_LINE = TRUE`

- `ROADMAP_PROGRESS_COLUMN_STABLE = TRUE`
- `ROADMAP_STATUS_COLUMN_STABLE = TRUE`
- `ROADMAP_ROW_WRAP = FORBIDDEN`
- `ROADMAP_ROW_OVERFLOW = HIDDEN_OR_ELLIPSIS`

Rows remain single-line and fixed-height. Overflow is clipped or ellipsized;
it must not wrap, widen the sidebar, or overlap fixed columns. Each hierarchy
depth adds approximately one full-width character of indentation. PR and Phase
use the same depth. Subtle neutral connector lines may reinforce hierarchy but
must remain light and aligned without implying an extra level.

`ROADMAP_INDENT_PER_LEVEL = ONE_FULLWIDTH_CHARACTER_APPROX`

For entities with children, the fold triangle is hidden or visually inactive
by default and becomes visible/active on row hover. Only clicking the triangle
toggles that entity; the active triangle is green. Clicking elsewhere on the
row selects and navigates. Leaf entities need no triangle.

- `ROADMAP_FOLD_CONTROL_ON_HOVER = TRUE`
- `ROADMAP_ACTIVE_FOLD_COLOR = GREEN`

Large cards, large badges, multiline entities, verbose instructional copy,
oversized spacing, and duplicated status descriptions are forbidden in the
Roadmap tree. Compact rows, fixed right columns, small indentation, hover
affordances, and detail tooltips are preferred.

## Current Context and navigation

Current Context is an Owner-only compact module with no tutorial heading such
as `当前定位` or `Current Context`. It shows only the contextual entity, uses at
most two visual lines, and displays no Roadmap percentage, status, large status
banner, or instructional text.

- `CURRENT_CONTEXT_MAX_LINES = 2`
- `CURRENT_CONTEXT_PROGRESS_VISIBLE = NO`
- `CURRENT_CONTEXT_STATUS_VISIBLE = NO`

Current Context may truthfully represent a Milestone, Formal Work Package, PR,
Phase, or Task. Navigation Context follows selection while unlocked. Locked
Execution Context remains fixed while the Owner browses elsewhere; if useful,
the browsed entity may occupy the second line. The entire locked context text
is green.

- `LOCKED_CONTEXT_TEXT_COLOR = GREEN`
- `OWNER_CONTEXT_LOCK = TRUE`
- `AICC_CONTEXT_DECISION_AUTHORITY = 0`

Locking makes the current entity the Owner-authorized execution context. New
AICC Tasks received while locked are attributed to that context without
rewriting canonical Roadmap hierarchy. Unlocking restores follow-navigation
behavior.

The right side of Current Context contains exactly four compact icon-only
controls, with no Chinese or English labels or tutorial text. Their order and
action-oriented icon set are fixed:

1. lock or unlock: `🔒` / `🔓`;
2. locate: `🚩`;
3. expand all or collapse all: `↕️` / `▶️`;
4. refresh Roadmap: `🔄`.

Each hover, title, and accessible label describes the action that will happen
on click. The four controls occupy one horizontal row with centered alignment
and zero vertical margin and padding on both the row and buttons.

- `CURRENT_CONTEXT_CONTROL_ORDER = LOCK_LOCATE_EXPAND_REFRESH`
- `CURRENT_CONTEXT_ACTION_BASED_HOVER = TRUE`
- `CURRENT_CONTEXT_ICON_ROW_WRAP = FALSE`
- `CURRENT_CONTEXT_ICON_ROW_VERTICAL_SPACING = 0`

The global Roadmap expand/collapse control belongs here and must not appear as
an extra action row in the Roadmap tree.

`GLOBAL_ROADMAP_EXPAND_CONTROL_LOCATION = CURRENT_CONTEXT`
`CURRENT_CONTEXT_CONTROL_COUNT = 4`
`CURRENT_CONTEXT_ICON_ONLY_CONTROLS = TRUE`

Locate is one atomic navigation action: determine the current or locked target,
expand all required ancestors, scroll to and visibly select the exact target
row, and open the matching entity in the central workspace. For a Task, locate
its owning Roadmap context and open the appropriate Task/detail surface.

One shared authority owns `selected_entity`, `navigation_context`,
`locked_execution_context`, `expanded_nodes`, and `roadmap_expand_mode` across
the Roadmap Tree, Current Context, Central Workspace, and Locate action.

`ROADMAP_NAVIGATION_STATE_SINGLE_AUTHORITY = TRUE`

Selecting a Roadmap row opens that entity and updates Navigation Context. If
unlocked, Current Context follows; if locked, workspace navigation does not
change Locked Execution Context.

## Local-first fold interaction

Fold/unfold is a synchronous UI-local action. It reads neither the Living
Roadmap nor GitHub, calls no AICC backend, rebuilds no projection, reloads no
page, and does not block rendering on persistence. If persistence exists, the
UI updates first and persistence is asynchronous.

`ROADMAP_FOLD_INTERACTION = LOCAL_FIRST`
`FOLD_BACKEND_DEPENDENCY = NONE`
`FOLD_ROADMAP_FILE_READ = NO`
`FOLD_ROADMAP_SYNC_TRIGGER = NO`
`FOLD_PROJECTION_REBUILD = NO`
`FOLD_PERSISTENCE_BLOCKS_RENDER = NO`
`SINGLE_NODE_FOLD_TARGET_MS < 100`
`GLOBAL_EXPAND_COLLAPSE_TARGET_MS < 500`

## Manual Roadmap synchronization

The visible Roadmap never refreshes automatically. Runtime polling, task or
Run completion, PR changes, file saves, file watchers, and background sync do
not update the visible Roadmap.

`ROADMAP_SYNC_MODE = OWNER_MANUAL_ONLY`
`ROADMAP_AUTO_REFRESH = OFF`
`ROADMAP_AUTO_FILE_WATCH = OFF`
`ROADMAP_RUNTIME_TRIGGERED_REFRESH = OFF`
`ROADMAP_SYNC_TRIGGER = OWNER_CLICK_ONLY`

The fourth Current Context control performs a Roadmap-only sync:

`Owner click → read Local and GitHub Roadmap → validate revision → compare
equal-revision hashes → select source → parse → compile projection → atomic
in-memory projection swap → rerender Roadmap only`

It must not reload the browser or application, reinitialize unrelated
workspaces, or restart Runtime.

`ROADMAP_SYNC_PAGE_RELOAD = NO`
`ROADMAP_SYNC_APP_RELOAD = NO`
`ROADMAP_PROJECTION_ATOMIC_SWAP = TRUE`

The Local and configured GitHub copies are selected by the highest valid
monotonic canonical revision, never by filesystem mtime, save time, fetch time,
browser time, or GitHub UI time. The canonical document may declare:

```text
Roadmap-Revision: <positive monotonic integer>
Updated-At: <ISO timestamp>
```

`ROADMAP_SOURCE_SELECTION = HIGHEST_VALID_REVISION`

When revisions are equal, compare canonical content hashes. Equal revision
and equal hash is the same Roadmap. Equal revision and different hash is a
fail-closed conflict: retain the current snapshot, do not silently choose a
source, and surface the conflict for Owner resolution.

`ROADMAP_EQUAL_REVISION_HASH_CONFLICT = FAIL_CLOSED`

The only canonical Roadmap truth sources are the Local and configured GitHub
copies of `01_LIVING_ROADMAP.md`:

`ROADMAP_CANONICAL_TRUTH_COUNT = 2`
`ROADMAP_LOCAL_TRUTH = LIVING_ROADMAP`
`ROADMAP_GITHUB_TRUTH = LIVING_ROADMAP`

After Owner-only acceptance, AICC persists a rebuildable derived projection
at `.aicc-v2/roadmap-projection.json` and the browser persists the last
accepted projection at `localStorage[aicc.roadmap.snapshot.v1]`. Neither has
decision authority, and neither may be used as a third Roadmap truth source:

`AICC_ROADMAP_PROJECTION = PERSISTENT_DERIVED_FILE`
`BROWSER_ROADMAP_CACHE = PERSISTENT_LAST_ACCEPTED_SNAPSHOT`
`BROWSER_ROADMAP_CACHE_AUTHORITY = 0`

Application startup reads the browser cache first. It does not read either
canonical source, rebuild the projection, or synchronize the Roadmap. A
manual sync is an acceptance transaction: persist the AICC projection, then
replace the browser cache and in-memory Roadmap. If any required step fails,
the last accepted projection, cache, and visible Roadmap remain unchanged.

Valid UI state is preserved across an atomic projection swap when its entity
still exists: expanded nodes, selected entity, locked execution context, and
scroll position. Missing entities fail safely and must not silently bind to a
different entity.

## Projection and performance

The Roadmap projection is a derived read model containing canonical revision,
source, content hash, hierarchy, display data, status, progress, ordering,
parent relationships, and indexes as appropriate. It is rebuildable and has
zero decision authority.

`ROADMAP_PROJECTION = DERIVED_READ_MODEL`
`ROADMAP_PROJECTION_REBUILDABLE = TRUE`
`ROADMAP_PROJECTION_AUTHORITY = 0`
`ROADMAP_PROJECTION_ATOMIC_SWAP = TRUE`

Roadmap synchronization may take longer because it reads and validates both
canonical sources, but it must not freeze unrelated application UI. UI fold
actions retain the targets above.

## Frozen baseline change control

All future AICC UI changes affecting Roadmap, left navigation, Current Context,
selection, locking, locating, expansion/collapse, progress, status presentation,
or Milestone/WP/PR/Phase projection must conform to this standard.

A material change must identify the affected rule, preserve unchanged rules,
update this canonical standard and the baseline registry where required, and
receive Owner approval before replacing frozen behavior.

`SILENT_UI_BASELINE_OVERRIDE = FORBIDDEN`

## Workspace Context implementation constraint

The Workspace Context Work Package implements `全局任务` as an explicit
center-column Global Workspace. It is a navigation projection only and does
not become an entity or execution authority. The compact Current Context
control may expose an explicit Owner Execution Context Lock; passive Roadmap
navigation and `定位` must never act as an implicit lock.

## Owner blocked status single source

All Owner-facing `阻塞`, `已阻塞`, and `BLOCKED` presentation MUST originate
from `OwnerStatusProjection`. Entity Header, Workflow, Overview, Roadmap, and
Owner Action are projections of that one result; they must not independently
derive Owner blocked status from `context.status`, internal lifecycle state,
FORMAL_READY, Runtime, Validation, Bridge state, raw reason codes, or local
component heuristics.

`FORMAL_READY != OWNER_BLOCKED`. Internal lifecycle `BLOCKED` and terminal
Runtime state remain domain truth and do not by themselves authorize a blocked
Owner presentation. A blocked Owner presentation is allowed only when
`OwnerStatusProjection` confirms a real canonical blocker. Future duplicate
blocked derivation is a UI Standard regression.

## Owner action principle

The Owner Action Zone is contextual, not a command toolbar. Owner-facing
Chinese terminology is `当前操作区` / `当前操作`; `Owner Action Zone` remains
an internal component name when technical context requires it.

- `PRIMARY OWNER ACTION <= 1` at any moment.
- Only actions relevant to the current canonical state may be exposed.
- Actions appear and disappear contextually: ready exposes `启动执行`, an
  authorization-required state exposes `确认授权并启动`, a running state
  exposes `查看运行` and may expose `停止` as a secondary action, a failed
  state exposes `重试`, and a machine-completed state waiting for manual work
  exposes `开始人工 UAT`.
- All possible actions must not remain permanently visible together.
- Refresh, local-main sync, service logs, service restart, repository
  maintenance, and diagnostics do not permanently occupy the primary action
  area. They belong in contextual overflow, repository/status tools, a
  diagnostic area, or the appropriate Operations Tab.
- Authorization appears only when Canonical Execution Decision requires Owner
  action. Stop appears only while a stoppable runtime is active. Retry appears
  only after a retry-eligible failed or stopped state.
- The action surface consumes canonical state and remains a projection; it
  must not create execution authority.

The normal Owner path is intentionally compact:

`启动执行 → 查看运行 → 人工 UAT`

Authorization, lease, HEAD, worktree, scope, Writer Lock, and runtime
eligibility remain background concerns unless Canonical Authority explicitly
requires Owner intervention. This complexity rule applies consistently to WP
and PR pages; entity-specific actions may differ, but both use contextual
visibility and `PRIMARY OWNER ACTION <= 1`.

## Runtime and browser evidence precedence

Real browser evidence has higher authority than source inspection, static
reasoning, focused logic tests, TypeScript success, build success, or
compiled assumptions when evaluating interactive UI behavior.

`REAL_BROWSER_EVIDENCE_OVERRIDES_STATIC_REASONING = TRUE`
`UI_CODE_PASS_WITH_REAL_BROWSER_UNPROVEN = NOT_COMPLETE`

Completion evidence remains distinct:

`CODE_PASS != TEST_PASS != REAL_BROWSER_PASS != OWNER_UAT_PASS`

Automated tests support the evidence chain but never substitute for real
browser validation or Owner UAT. The canonical UI gate is:

`IMPLEMENT → FOCUSED_TEST → REAL_BROWSER → OWNER_UAT → COMPLETE`

When application state demonstrably changes but the visible DOM does not,
the next diagnostic action is runtime and compiled-output inspection first:

`STATE_CHANGED_BUT_DOM_UNCHANGED`
`→ INSPECT_COMPILED_RUNTIME_FIRST`
`→ DO_NOT_REDESIGN_STATE_FIRST`

This includes the actual browser DOM and computed styles, runtime component
props, browser-loaded modules, framework compiled output, reactive
dependencies, and DOM mutation behavior. State architecture, persistence,
cache, projection, synchronization, and component hierarchy must not be
redesigned unless runtime evidence proves one of those layers is defective.

For Svelte, source semantics, compiled reactive dependencies, and real DOM
behavior are separate evidence requirements:

`SOURCE_SEMANTICS_CORRECT != COMPILED_REACTIVE_DEPENDENCY_CORRECT != REAL_DOM_BEHAVIOR_CORRECT`

### Implementation lesson

A logically correct state transition may fail to produce the expected DOM
transition when the framework's compiled reactive dependency is incorrect.
Use runtime and compiled evidence first before changing state design.

## Change history

### v1.1 — OWNER_APPROVED_BASELINE_CHANGE

- Owner Action Zone becomes a contextual Current Action area.
- `PRIMARY OWNER ACTION <= 1`.
- Permanent command-toolbar behavior is prohibited.
- Diagnostic, maintenance, and repository actions are removed from the
  permanent primary action area.
- WP and PR share the contextual Owner action principle.

Reason: simplify the Owner workflow after Canonical Execution convergence and
prevent the primary action area from reverting into a permanent command
toolbar.

### v1.2 — OWNER_APPROVED_BASELINE_CHANGE

- Owner-facing blocked status is single-source through `OwnerStatusProjection`.
- EntityHeader, WorkflowTimeline, Overview, RoadmapTree, and Owner Action are
  aligned to the same Owner status projection.
- Direct lifecycle/context/runtime-to-blocked UI derivation is prohibited.
- A duplicate blocked projection is classified as a UI Standard regression.

Reason: eliminate multiple Owner blocked-status interpretations while keeping
internal lifecycle and execution truth independent.

### v1.3 — OWNER_APPROVED_BASELINE_FREEZE

- Freeze Roadmap visual hierarchy to Milestone → Formal WP → PR or Phase, with
  PR and Phase as parallel children and maximum visual depth three.
- Bind Roadmap status and progress exclusively to explicit Living Roadmap
  Markdown metadata; AICC has no calculation or inference authority.
- Freeze compact row geometry, three icon families with exact-state tooltips,
  single-line overflow, indentation, connector, and hover-fold behavior.
- Freeze compact Current Context, Owner lock semantics, three icon-only
  controls, atomic Locate behavior, and shared navigation-state authority.

Reason: record the Owner-approved top-level Roadmap and Current Context
interaction model as the canonical frozen UI baseline.

### v1.5 — OWNER_APPROVED_EVIDENCE_BASELINE

- Establish Real Browser evidence as authoritative for interactive UI
  behavior over static reasoning and automated checks.
- Keep code, test, real-browser, and Owner-UAT evidence levels distinct.
- Require compiled/runtime-first diagnosis when state changes but the DOM does
  not.

Reason: prevent static PASS claims from substituting for real interactive UI
evidence and avoid state redesign before runtime evidence identifies the
defective layer.
