# AICC-V3-WP-TASK-CORE-001

Status: `ACTIVE / OWNER_AUTHORIZED`

## Objective

Add the smallest durable Work Package + Task core to AICC V3, scoped only to the active ProjectContext repository.

## Authority

- Project authority: active `ProjectContext`.
- Roadmap authority remains read-only canonical V3 Roadmap.
- WP/Task persistence must be explicit and project-scoped.
- UI is display/control surface only; it does not invent lifecycle state.

## In scope

- minimal WP model;
- minimal Task model;
- explicit WP ↔ Task binding;
- project-scoped persistence;
- read/create/update status APIs needed for the minimal core;
- minimal UI;
- focused tests and V3 CI.

## Out of scope

- Codex execution;
- executor lease / run stream;
- GPT Bridge;
- PR creation or merge;
- V2 state migration or compatibility fallback.

## Acceptance criteria

- data belongs to exactly one active ProjectContext;
- no hardcoded repository path;
- WP and Task IDs are durable and reload-safe;
- Task cannot silently detach from or cross-bind to another project WP;
- invalid state fails closed;
- browser reflects persisted facts rather than inferred status;
- exact-head V3 CI passes before Owner UAT.

## Next exact gate

Freeze the V3.4 data model and storage contract before adding UI behavior.
