# AI Control Center Agent Contract

## Authority

`origin/main` exact SHA and formal governance documents are authoritative.

OpenSpec, Codex sessions, runtime state, dashboards, local workspaces, caches, and agent output are non-authoritative.

No tool, agent, artifact, task checkbox, local session, or application state may authorize its own execution.

## Permanent global state architecture

All AICC status, lifecycle, progress, binding, and state-facing UI must follow this architecture. This is a permanent cross-module rule and applies to existing migrations and all future modules.

### Layer 1 — Domain canonical data

Domain entities remain independently authoritative. They must not be collapsed into one monolithic state file merely for UI convenience.

- Work Package (`WP`) → its own canonical Work Package files, Living Roadmap structure, lifecycle data, and governed metadata.
- Pull Request (`PR`) → its own canonical PR record, snapshot, provider evidence, and binding data.
- Task → one canonical Task state model. Task status must not be inferred independently by each UI surface.
- Run / Execution → canonical Runtime / Execution state and durable execution evidence.

The domain canonical sources remain the write and truth authorities for their own bounded semantics.

`DOMAIN_CANONICAL_DATA_REMAINS_INDEPENDENT = TRUE`
`WP_PR_TASK_RUN_COLLAPSED_STORAGE = FORBIDDEN`

### Layer 2 — Global State Projection

AICC must provide one shared read-only projection layer above the domain canonical sources:

`AICC Global State Read Model`

Its canonical directory / projection implementation is responsible for:

- reading the real Layer 1 canonical sources;
- resolving and preserving explicit entity binding between WP / PR / Task / Run / Execution;
- exposing one normalized state vocabulary without rewriting domain truth;
- producing efficient entity and cross-entity read models;
- maintaining monotonic projection revision metadata;
- performing revision-aware cache invalidation;
- preventing stale cached state from overriding newer canonical source state;
- preserving `UNKNOWN` / unresolved states when the underlying source does not establish a value;
- keeping separately governed state dimensions separate when their semantics differ.

The Global State Read Model is a projection, not a new business authority, lifecycle decision authority, execution authority, or write-back authority.

It must not invent PASS / FAIL / BLOCKED / COMPLETE, ownership, binding, progress, or lifecycle facts that are absent from Layer 1 canonical data.

`GLOBAL_STATE_READ_MODEL = REQUIRED`
`GLOBAL_STATE_READ_MODEL_AUTHORITY = READ_ONLY_PROJECTION`
`GLOBAL_STATE_WRITE_AUTHORITY = NONE`
`AICC_STATE_INFERENCE_AUTHORITY = 0`
`UNKNOWN_MUST_NOT_BE_GUESSED = TRUE`

`GLOBAL_STATE_WRITE_AUTHORITY = NONE` is scoped to the Global State Read Model itself. It does not remove or weaken the governed Layer 1 write authorities for their own canonical domains.

### State-dimension separation

The projection layer must not collapse semantically independent state machines into one status field.

At minimum, keep distinct where applicable:

- Run / Execution lifecycle;
- result availability;
- feedback-delivery lifecycle;
- GPT / AICC control-loop lifecycle;
- WP / PR / Task domain lifecycle.

For example, `Run = COMPLETED` does not by itself mean `Feedback Delivery = DELIVERED` or `Control Loop = COMPLETE`.

The canonical read model must preserve these as independent lifecycle namespaces rather than one overloaded `status` value.

`LIFECYCLE_DIMENSIONS_ARE_INDEPENDENT = TRUE`

Conceptually, where applicable, preserve separate dimensions such as:

- `run.lifecycle`;
- `execution.lifecycle`;
- `task.lifecycle`;
- `wp.lifecycle`;
- `pr.lifecycle`;
- `result.availability`;
- `feedback.delivery`;
- `controlLoop.lifecycle`.

A combination such as `run.lifecycle = COMPLETED`, `result.availability = AVAILABLE`, `feedback.delivery = FAILED`, and `controlLoop.lifecycle = WAITING_OWNER` is valid when established by the corresponding Layer 1 sources. The projection must not flatten those facts into one synthetic status.

### Layer 3 — UI read contract

All production UI state and progress surfaces must consume Layer 2 rather than independently re-reading, re-deriving, or caching Layer 1 domain state.

This includes, without exception for normal production state rendering:

- left navigation / quick lists;
- center workspaces;
- right inspectors / evidence context;
- Global Feedback Island;
- Runtime Summary / Runtime Monitor projections;
- Desktop App;
- Mobile / Web control surfaces;
- future state, status, progress, lifecycle, and binding UI.

`UI_STATE_READ_AUTHORITY = AICC_GLOBAL_STATE_READ_MODEL`
`UI_DIRECT_DOMAIN_STATE_DERIVATION = FORBIDDEN`
`DUPLICATE_UI_STATUS_RESOLVER = FORBIDDEN`

UI actions may invoke the appropriate governed domain command/write path, but UI rendering must then read the resulting state back through the Global State Read Model. The Read Model itself must never become a write API.

### Required projection flow

```text
WP canonical data
PR canonical data
Task canonical state
Run / Execution canonical state
        ↓
Canonical State Directory / Global State Projection
        ↓
AICC Global State Read Model
        ↓
Left / Center / Right UI
Global Feedback Island
Runtime Summary
Desktop App
Mobile / Web
```

All future status synchronization, lifecycle projection, progress rendering, cross-surface consistency fixes, and state-related regressions must be solved by restoring this flow rather than adding local UI-specific status logic or one-off synchronization patches.

### Exact-bound invalidation and live reprojection

State protection must prevent incorrect mutation, not suppress legitimate read-model refresh.

When a Layer 1 canonical entity changes, every Layer 2 projection that directly depends on that exact entity must be invalidated and reprojected. Unrelated entities must not be mutated merely because another entity changed.

For an exact Task → Execution → Run binding, a canonical terminal transition of that exact Run must invalidate and reproject the dependent Task / Execution read model without requiring a browser reload.

`EXACT_BOUND_STATE_CHANGE_INVALIDATION = REQUIRED`
`EXACT_BOUND_CHANGE_AUTO_REPROJECT = TRUE`
`UNRELATED_ENTITY_INVALIDATION = NOT_REQUIRED`
`UNRELATED_ENTITY_MUTATION = FORBIDDEN`
`MANUAL_BROWSER_REFRESH_REQUIRED_FOR_STATE_SYNC = NO`

Browser refresh is recovery only. It is not an accepted state-propagation mechanism.

`BROWSER_REFRESH_IS_RECOVERY_ONLY = TRUE`
`BROWSER_REFRESH_IS_STATE_PROPAGATION = FALSE`
`PAGE_RELOAD_MUST_NOT_REEXECUTE_TASK = TRUE`
`PAGE_RELOAD_MUST_NOT_MUTATE_CANONICAL_STATE = TRUE`

If a state becomes correct only after manual browser refresh, that is a projection-synchronization regression and must be traced through Layer 1 → Layer 2 invalidation/revision → Layer 3 consumption.

### Revision, cache, and freshness contract

Projection revisions are monotonic freshness metadata. They must represent real canonical change and must not be synthetically advanced merely to force UI refresh.

`GLOBAL_STATE_REVISION = MONOTONIC`
`ENTITY_STATE_REVISION = MONOTONIC`
`CANONICAL_CHANGE_INVALIDATES_DEPENDENT_PROJECTION = TRUE`
`NO_CANONICAL_CHANGE_NO_SYNTHETIC_REVISION = TRUE`

Where the implementation persists or exposes browser-cacheable projection slices, the cache must be revision-aware and invalidatable.

`BROWSER_STATE_CACHE = ALLOWED`
`REVISION_BASED_CACHE_INVALIDATION = REQUIRED`
`STALE_CACHE_CAN_OVERRIDE_NEWER_CANONICAL = NO`

Where practical, state-bearing projections should expose enough freshness metadata to diagnose stale reads, including source revision, projection revision, and projection time.

### Projection provenance contract

State, lifecycle, binding, ownership, progress, result-availability, and delivery fields exposed by Layer 2 must remain traceable to the Layer 1 canonical source that established them.

`PROJECTED_STATE_FIELD_PROVENANCE = REQUIRED`
`PROJECTION_TRACEABLE_TO_LAYER1_SOURCE = TRUE`

The read model must retain or expose sufficient provenance to answer, for a projected fact, which canonical entity/source and source revision established that fact. Visual truncation or normalized display vocabulary must not destroy this traceability.

### Rebuildability and reconciliation contract

Layer 2 must remain fully rebuildable from Layer 1 canonical data. It must not become a hidden source of truth merely because it is persistent or cached.

`GLOBAL_STATE_READ_MODEL_REBUILDABLE_FROM_LAYER1 = REQUIRED`
`MISSED_EVENT_RECOVERY_BY_RECONCILIATION = REQUIRED`
`PROCESS_RESTART_RECONCILIATION = REQUIRED`
`CACHE_LOSS_RECONCILIATION = REQUIRED`

A process restart, missed live event, browser reconnect, or deleted Layer 2 cache must be recoverable by deterministic reconciliation from Layer 1 without inventing state and without requiring Layer 2 write-back into Layer 1.

### Canonical ordering and terminal regression protection

Older canonical revisions/events must never overwrite a newer projected fact.

`CANONICAL_EVENT_ORDERING = REQUIRED`
`OLDER_REVISION_CAN_OVERRIDE_NEWER_REVISION = NO`
`TERMINAL_PROJECTION_REGRESSION_FROM_STALE_EVENT = FORBIDDEN`

This protection is revision/order based. It must not introduce an independent AICC lifecycle inference engine. Layer 2 still has `AICC_STATE_INFERENCE_AUTHORITY = 0`.

### Task state protection contract

Task state protection is strict against contamination, while legitimate exact-bound read-model refresh is mandatory.

`UNRELATED_RUN_CAN_MUTATE_TASK = NO`
`GLOBAL_LATEST_RUN_FALLBACK = NO`
`SELECTED_RUN_FALLBACK = NO`
`EXACT_BOUND_EXECUTION_RUN = REQUIRED`
`TASK_READ_MODEL_AUTO_REFRESH = YES`
`EXACT_BOUND_CHANGE_AUTO_REPROJECT = YES`
`MANUAL_BROWSER_REFRESH_REQUIRED = NO`
`BROWSER_REFRESH_REEXECUTES_TASK = NO`
`RERENDER_REEXECUTES_TASK = NO`
`POLLING_REEXECUTES_TASK = NO`

Task / Execution / Run identities remain separate. AICC must not implement a shortcut such as `task.status = run.status`. The required behavior is exact dependency projection: when the canonical state of the exact bound Run or Execution changes, invalidate and recompute only the dependent Task read model while preserving separate lifecycle semantics and identities.

### State synchronization remediation policy

When two AICC surfaces disagree about status, lifecycle, progress, binding, or result availability, do not patch either surface locally.

Trace and repair the first broken boundary in this order:

```text
Layer 1 canonical truth
        ↓
Layer 2 projection / binding
        ↓
invalidation / revision / reconciliation
        ↓
Layer 3 consumer
```

`LOCAL_UI_STATE_SYNC_PATCH = FORBIDDEN`
`ONE_OFF_STATUS_REFRESH_PATCH = FORBIDDEN`
`LATEST_RUN_STATUS_FALLBACK = FORBIDDEN`
`STATE_SYNC_BUG_REPAIR_FIRST_BROKEN_BOUNDARY = REQUIRED`

Do not add per-component status resolvers, ad hoc `setInterval` refreshes, latest-run fallbacks, selection-based status fallbacks, or one-off synchronization bridges to hide a broken Global State Read Model flow.

## Permanent Roadmap hierarchy semantics

AICC Roadmap hierarchy uses one fixed semantic model. Milestone identity, structural Roadmap grouping, execution planning units, delivery units, tasks, and runtime executions must remain distinct.

### Canonical hierarchy vocabulary

`M#` is the only Milestone entity identifier form.

`#.#` is a Roadmap Section number under a Milestone. A Roadmap Section is a structural grouping node only; it is not a business entity and does not create a new global entity class.

`WP` is the Work Package execution-planning unit.

`PR` is the delivery unit.

`Task` is the execution task.

`Run / Execution` is the exact runtime execution identity.

`Phase` is an implementation phase owned by a Work Package.

`Gate` is an acceptance or closure gate and must not be confused with a Milestone or Roadmap Section.

`AICC_ROADMAP_HIERARCHY_SEMANTICS_V1 = FROZEN`
`MILESTONE_ID_FORMAT = M#`
`ROADMAP_SECTION_ID_FORMAT = #.#`
`M#.#_AS_ENTITY_ID = FORBIDDEN`
`TRACK_ENTITY = NOT_USED`

Historical prose may retain legacy labels such as `M8.3` for traceability, but production parsers, read models, selectors, lifecycle logic, and UI must not treat `M#.#` as a Milestone or business entity.

### Roadmap Section contract

Roadmap Sections exist only to organize canonical Roadmap structure beneath a Milestone and above Work Packages.

They may be rendered as expandable/collapsible grouping nodes, show their title, show descendant Work Package counts, and expose summaries derived from descendant Work Package projections.

They must not own independent canonical business state, lifecycle state, execution authority, write authority, authorization, Work Package execution, PR execution, Task execution, or Run execution.

`ROADMAP_SECTION_IS_STRUCTURAL_NODE = TRUE`
`ROADMAP_SECTION_IS_BUSINESS_ENTITY = FALSE`
`ROADMAP_SECTION_EXECUTION_AUTHORITY = NONE`
`ROADMAP_SECTION_WRITE_AUTHORITY = NONE`
`ROADMAP_SECTION_LIFECYCLE_AUTHORITY = NONE`
`ROADMAP_SECTION_AUTHORIZATION_AUTHORITY = NONE`

If a Section status or progress summary is displayed, it must be a Layer 2 derived summary of its descendant Work Packages and must never become an independent Layer 1 lifecycle source.

`ROADMAP_SECTION_STATUS_SOURCE = DESCENDANT_WORK_PACKAGE_PROJECTION`
`ROADMAP_SECTION_PROGRESS_SOURCE = DESCENDANT_WORK_PACKAGE_PROJECTION`

### Blueprint and execution hierarchy

The canonical Blueprint hierarchy is:

```text
Milestone
    ↓
Roadmap Section
    ↓
Work Package
```

The canonical execution/delivery hierarchy is:

```text
Work Package
    ↓
Pull Request
    ↓
Task
    ↓
Run / Execution
```

`BLUEPRINT_HIERARCHY = MILESTONE -> ROADMAP_SECTION -> WORK_PACKAGE`
`EXECUTION_HIERARCHY = WORK_PACKAGE -> PR -> TASK -> RUN`

A Work Package remains the real execution-planning and governed lifecycle unit beneath Roadmap structure.

`WORK_PACKAGE_IS_EXECUTION_PLANNING_UNIT = TRUE`

### Phase ownership

Implementation phases belong to Work Packages, not to Milestones and not to Roadmap Sections.

For example, Phase 0 through Phase N beneath a Section are phases of the bound Work Package, even when the UI visually groups them under that Section.

`PHASE_OWNER = WORK_PACKAGE`
`MILESTONE_PHASE_AUTHORITY = NONE`
`SECTION_PHASE_AUTHORITY = NONE`

### Global navigation contract

Roadmap Sections do not create a new Global Track or Global Section product surface.

The global navigation remains:

```text
Blueprint | WP | PR | Task
```

Do not add `Track` or `Section` as a first-level global navigation entity merely because Roadmap Sections exist structurally.

`GLOBAL_TRACK_NAVIGATION = NO`
`GLOBAL_SECTION_NAVIGATION = NO`
`ROADMAP_SECTION_GLOBAL_WORKSPACE = NO`
`ROADMAP_SECTION_GLOBAL_QUICK_LIST = NO`
`GLOBAL_NAVIGATION = BLUEPRINT | WP | PR | TASK`

Blueprint / Roadmap UI may render the structural hierarchy `Milestone -> Roadmap Section -> Work Package`. Global WP remains a direct cross-Section Work Package view.

### Read Model contract

Roadmap Layer 2 projections must preserve the structural distinction:

```text
milestones[]
  -> sections[]
       -> work_packages[]
```

They must not model Roadmap Sections as nested Milestone entities.

`NODE_TYPE_MILESTONE = milestone`
`NODE_TYPE_SECTION = roadmap_section`
`NODE_TYPE_WORK_PACKAGE = work_package`
`ROADMAP_SECTION_ENTITY_AUTHORITY = NONE`

Roadmap parsing and structural discovery must derive Section and Work Package membership from canonical Roadmap hierarchy, not from identifier prefixes, hard-coded module allowlists, or UI convenience assumptions.

`WORK_PACKAGE_EXISTENCE_AUTHORITY = CANONICAL_ROADMAP_STRUCTURE`
`WORK_PACKAGE_ID_PREFIX_IS_AUTHORITY = NO`
`ROADMAP_SECTION_DISCOVERY_AUTHORITY = CANONICAL_ROADMAP_STRUCTURE`

### Status and PASS semantics

A structural projection test result such as `SECTION_8_4_PROJECTION = PASS` means only that the Roadmap Section and its descendants were projected correctly. It must not be interpreted as business completion of that Section or its Work Packages.

Do not use `M8.3 = PASS`, `M8.4 = PASS`, or equivalent forms to represent Section business completion.

`SECTION_PROJECTION_PASS_IS_BUSINESS_COMPLETE = FALSE`
`ROADMAP_STRUCTURE_PASS_IS_LIFECYCLE_COMPLETE = FALSE`

Business lifecycle state remains owned by the appropriate canonical Layer 1 entity, especially Work Packages beneath the Section.

## Permanent denials

- Arbitrary shell strings from the application UI or runtime.
- OpenSpec Sync.
- Self-authorization or automatic authorization.
- Automatically starting, applying, or executing the next Work Package.
- Silently selecting one of multiple authorized Work Packages.
- Parallel writers.
- Force push.
- `git reset --hard`.
- `git clean`.
- Automatic conflict resolution.
- Automatic rebase.
- Production deployment, destructive database operations, secrets mutation, security architecture changes, and irreversible external writes without a separate Owner Gate.
- Treating unavailable or unknown Authority as verified.

## Governed development automation

Repository development automation may create commits, push a feature branch, and create or update a Draft PR only when all of the following are true:

- the Owner explicitly authorized the named Work Package;
- the branch and Authority SHA are fixed;
- the changes remain inside the authorized scope;
- no force operation is used;
- Ready for Review and Merge remain separate Owner Gates unless a named Work Package explicitly authorizes normal-risk autonomous delivery through exact-head CI and squash merge.

AICC-CONTROL-LOOP-001A already has this whole-Work-Package authorization.

## Governed repository commands

AICC-CONTROL-LOOP-001A may implement only fixed typed repository commands.

Authority Check:

- may execute `git ls-remote origin refs/heads/main`;
- must not fetch or mutate local refs;
- must fail closed.

Owner-triggered Workspace Sync:

- may execute only `git fetch origin main`, `git switch main`, and `git merge --ff-only origin/main`;
- requires clean worktree and all execution guards to pass;
- requires explicit Owner action and confirmation;
- must revalidate immediately before execution;
- must not reset, clean, rebase, force, resolve conflicts, push, or merge a PR.

## Work Package Resolver And Codex Runtime

The resolver may calculate and display `START_ALLOWED` or one or more explicit blocker codes.

The resolver must not:

- authorize a Work Package;
- modify its status;
- run OpenSpec Apply without the named Work Package capability;
- start Codex without a matching persisted Owner authorization;
- acquire a real Writer Lock;
- execute implementation.

The governed Codex runtime may expose only typed operations. It must bind Owner authorization to the Work Package ID, Authority SHA, branch, worktree, scope, allowed capabilities, forbidden capabilities, and timestamp. It must never accept arbitrary shell input from the Owner UI.

## Current implementation phase

Current milestone: `M2 — Authority And Workspace Control`

Current Work Package: `AICC-CODEX-ONLY-MIGRATION-001`

Authority base: `fcd41386fafd6ee2083e73cdee71bee68a3a1e09`

This Work Package may introduce:

- Codex-only roadmap and application architecture;
- persisted, evidence-bound Owner authorization;
- typed Codex runtime state and bounded controls;
- Codex CLI execution contracts using the configured `sol` profile;
- independent review, PR, exact-head CI, squash merge, and UAT artifact phases for normal-risk scoped delivery;
- corresponding Chinese-first Owner UI and tests.

This Work Package must not introduce:

- arbitrary command execution;
- OpenSpec Sync;
- automatic Work Package authorization;
- production deployment, destructive database operations, secrets mutation, security architecture changes, or irreversible external writes;
- Human UAT PASS without human evidence.

## Parallel Bug Governance — AICC_PARALLEL_BUG_GOVERNANCE_V1

This frozen rule applies to all AICC development work. Mainline development
and the Bug Backlog operate in parallel: discovering a Bug does not itself
authorize interrupting the current Work Package.

- `P0`: immediately report and interrupt.
- `P1`: interrupt only when it blocks the current authorized scope; otherwise
  record and continue unless the Owner reprioritizes.
- `P2` and `P3`: record and defer; do not interrupt or fix opportunistically.
- `UNTRIAGED`: record only; do not invent severity.

`BUG_DISCOVERY_DOES_NOT_INTERRUPT_MAINLINE = TRUE`
`P2_P3_NORMAL_DEVELOPMENT_INTERRUPTION = FORBIDDEN`
`UNRELATED_OPPORTUNISTIC_FIX = FORBIDDEN`
`FINAL_PROJECT_BUG_SWEEP = REQUIRED`

`AICC_SEVERITY_JUDGMENT = NO`
`AICC_DECISION_AUTHORITY = 0`

### Canonical Bug Registry

`AICC_CANONICAL_BUG_REGISTRY_V1 = FROZEN`
`CANONICAL_BUG_REGISTRY = docs/80_Bug_Record/01_bug_record.md`

- All deferred AICC Bugs must be recorded there; do not maintain competing Bug
  lists as authority.
- New evidence for the same underlying defect updates its existing stable Bug
  record; never renumber or silently delete historical Bug IDs.
- Closing a Bug requires explicit Fixed → Verified → Closed evidence.

## GPT Bug Capture Bridge — AICC_GPT_BUG_CAPTURE_BRIDGE_V1

`GPT_BUG_CAPTURE_PROTOCOL = AICC_BUG_CAPTURE_V1`
`GPT_BUG_CAPTURE_REGISTRY = docs/80_Bug_Record/01_bug_record.md`

- GPT → AICC → Registry capture requires a complete explicit protocol block;
  ordinary chat prose is never classified as a Bug.
- AICC persists `CAPTURE_ID + SOURCE_CONVERSATION + SOURCE_MESSAGE` and
  reconciles it exactly once before Registry mutation.
- AICC performs no semantic Bug, severity, blocking, or remediation judgment.
- Bug capture does not authorize an automatic Task, Work Package, Codex
  remediation, test change, or other fix.

## GPT GitHub Bug Registry — AICC_GPT_GITHUB_BUG_REGISTRY_V1

Status: FROZEN

Canonical Registry: `docs/80_Bug_Record/01_bug_record.md`

- GPT may directly persist confirmed Bug records to the canonical GitHub
  Registry; Local Codex is not required solely for Bug recording.
- Direct GPT GitHub writes are limited to Bug Registry governance and
  bookkeeping. Bug recording does not authorize remediation, application-code
  changes, or test-code changes.
- Before every GitHub Registry write, read the latest remote file and blob SHA.
  Never overwrite a newer remote Registry version.
- Reconcile existing Bug IDs before allocating a new ID. Never renumber or
  silently delete historical Bug records.
- The same underlying defect updates its existing record and appends evidence.
  If Bug identity is uncertain, do not force a duplicate match.
- AICC does not decide severity; GPT must use `UNTRIAGED` when governed
  severity is not established. Non-blocking Bug recording must not interrupt
  active mainline work.

`AICC_GPT_GITHUB_BUG_REGISTRY_V1 = FROZEN`
`GPT_CHAT_DIRECT_GITHUB_WRITE = YES`
`LOCAL_CODEX_REQUIRED_FOR_BUG_RECORDING = NO`
`CANONICAL_BUG_REGISTRY = docs/80_Bug_Record/01_bug_record.md`
`BUG_RECORDING_ONLY = YES`
`BUG_RECORDING_AUTHORIZES_FIX = NO`
`AICC_SEVERITY_JUDGMENT = NO`
`AICC_DECISION_AUTHORITY = 0`

## Bug Registry Enforcement — AICC_BUG_REGISTRY_ENFORCEMENT_V1

`AICC_BUG_REGISTRY_ENFORCEMENT_V1 = FROZEN`

This is the mandatory execution layer for
`AICC_PARALLEL_BUG_GOVERNANCE_V1` and `AICC_CANONICAL_BUG_REGISTRY_V1`.

Every governed Codex development Run must read `AGENTS.md` and
`docs/80_Bug_Record/01_bug_record.md` before execution. When a confirmed
non-blocking defect is discovered, search the registry first; update the
existing record and append evidence when the underlying defect already has a
stable Bug ID. Bug recording must not broaden implementation scope.

`EVERY_CODEX_RUN_PRECHECK = REQUIRED`
`DURING_EXECUTION_BUG_CAPTURE = REQUIRED`
`SEARCH_EXISTING_BUGS = REQUIRED`
`CREATE_DUPLICATE_BUG = NO`
`DUPLICATE_PROTECTION = PASS`
`BUG_RECORDING_AUTHORIZES_FIX = NO`
`UNRELATED_OPPORTUNISTIC_FIX = FORBIDDEN`
`AICC_SEVERITY_JUDGMENT = NO`
`AICC_DECISION_AUTHORITY = 0`

## Local UAT / Verify Worktree And Tauri Cache Hygiene

`TEMP_UAT_VERIFY_WORKTREE_AUTO_CLEANUP = REQUIRED`
`TEMP_WORKTREE_CLEANUP_METHOD = GIT_WORKTREE_REMOVE_THEN_PRUNE`
`TEMP_WORKTREE_RM_RF = FORBIDDEN`
`TEMP_WORKTREE_DIRTY_AUTO_DELETE = FORBIDDEN`
`TAURI_TARGET_AUTHORITY = NON_AUTHORITATIVE_REBUILDABLE_CACHE`
`TAURI_TARGET_LONG_TERM_RETENTION = NOT_REQUIRED`
`TAURI_TARGET_DISK_PRESSURE_CLEANUP = CARGO_CLEAN_ALLOWED`

A temporary UAT / verify worktree must be cleaned up as part of the same
lifecycle once its UAT or verification purpose is complete. Before automatic
cleanup, stop services started from that worktree, verify that no running process
references the worktree, require `git status --porcelain` to be empty, and verify
that the checked-out commit is preserved by the intended branch, remote, or other
reviewed Git reference. If any tracked or untracked change would be lost, or the
commit is not otherwise preserved, cleanup must stop and surface the evidence
instead of deleting the worktree.

Eligible temporary worktrees must be removed with `git worktree remove <path>`
and stale registrations cleaned with `git worktree prune`. This lifecycle rule
does not authorize `git clean`, `reset --hard`, or deletion of active/formal
implementation worktrees.

`src-tauri/target/` is local Rust/Tauri build output, is Git-ignored, and is not
source or delivery authority. It may be removed with
`cargo clean --manifest-path <worktree>/src-tauri/Cargo.toml` when disk pressure
warrants cleanup, and should normally be cleaned after one-off temporary Tauri
UAT / verify worktrees are retired. Before `cargo clean`, verify that no active
`cargo`, `rustc`, `tauri`, or executable launched from that target directory is
running. The next build may regenerate the cache and may therefore be slower.
