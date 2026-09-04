# AICC-V3-WP-TASK-CORE-001

Status: `CLOSED / OWNER_UAT_PASS`

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

## Frozen V3.4 contract

- Authority: `docs/40_Architecture/AICC-V3-WP-TASK-STORE-CONTRACT.md`.
- Store: one project-scoped `work-store.v1.json` under `~/.aicc-v3/projects/<project-key>/`.
- WP status: `OPEN | ACTIVE | BLOCKED | DONE`.
- Task status: `TODO | IN_PROGRESS | BLOCKED | DONE | CANCELLED`.
- Task binding to `workPackageId` is immutable.
- No delete, rebind, bulk mutation, title-edit, Codex, GPT Bridge, or PR behavior in V3.4 core.

## V3.4.1 checkpoint

- Project-scoped `work-store.v1.json` implemented under the frozen contract.
- Five minimal APIs implemented with ProjectContext re-load on every mutation.
- Store/API focused tests: `18/18 PASS` on CN Mac Node 22.
- UI intentionally not changed in this checkpoint.

## Next exact gate

Commit/push this store/API checkpoint, require exact-head V3 CI PASS, then implement the minimal WP/Task UI over these APIs only.

## V3.4.2 checkpoint

- Minimal WP/Task UI implemented over the frozen five APIs only.
- UI creates WP/Task, renders persisted lists, and sends explicit status changes.
- Successful mutations always reload `/api/work`; browser does not invent persisted state.
- Delete, rebind, bulk mutation, title-edit, Codex, GPT Bridge, and PR behavior remain absent.
- CN Mac Node 22 focused suite: `20/20 PASS`.

## Owner UAT closure

- Result: `PASS`.
- Owner decision: explicit `pass` on 2026-09-04.
- Exact implementation head under UAT: `91e1067aa4ab25b7da9cc5c7bdade0e38e35ac7f`.
- V3 CI Run #8: `PASS`.
- CN Mac runtime used the same exact head with project-scoped work store available.
- Closure: `AICC-V3-WP-TASK-CORE-001 = CLOSED`.
