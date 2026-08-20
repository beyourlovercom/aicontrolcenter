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

### State-dimension separation

The projection layer must not collapse semantically independent state machines into one status field.

At minimum, keep distinct where applicable:

- Run / Execution lifecycle;
- result availability;
- feedback-delivery lifecycle;
- GPT / AICC control-loop lifecycle;
- WP / PR / Task domain lifecycle.

For example, `Run = COMPLETED` does not by itself mean `Feedback Delivery = DELIVERED` or `Control Loop = COMPLETE`.

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
