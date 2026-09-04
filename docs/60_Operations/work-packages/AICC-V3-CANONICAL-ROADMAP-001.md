# AICC-V3-CANONICAL-ROADMAP-001

Status: `ACTIVE / OWNER_AUTHORIZED`

## Objective

Add one read-only canonical Roadmap projection to AICC V3, derived only from the active ProjectContext repository.

## Authority

- Repository authority: active `ProjectContext.repository.path`.
- Roadmap source: `docs/10_Planning_Roadmap/AICC-V3-LIVING-ROADMAP.md` inside that repository.
- UI is display-only and must not infer or rewrite current milestone, Work Package, or phase.
- Missing/invalid Roadmap fails closed as `NOT_AVAILABLE`.

## In scope

- typed read-only Roadmap model;
- `/api/roadmap`;
- current milestone / current WP / current phase;
- milestone list projection;
- minimal UI section;
- reload-safe tests;
- V3 CI.

## Out of scope

- WP/Task persistence;
- Codex execution;
- GPT Bridge;
- PR creation/merge;
- migration from V2 Roadmap caches or state.

## Acceptance criteria

- every Roadmap read begins from the same active ProjectContext;
- no hardcoded repository path;
- no browser-side Roadmap parsing;
- no UI inference of current state;
- invalid/missing Roadmap returns explicit unavailable state;
- browser shows the canonical V3 current milestone/WP/phase;
- V3 CI passes on exact pushed head.

## Next exact gate

Implement the minimal parser/API/UI with focused tests, then commit/push and require exact-head V3 CI PASS before Owner UAT.
