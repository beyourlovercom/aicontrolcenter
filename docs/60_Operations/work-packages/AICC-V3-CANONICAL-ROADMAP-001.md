# AICC-V3-CANONICAL-ROADMAP-001

Status: `CLOSED / OWNER_UAT_PASS`

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

## Implementation evidence

- CN Mac is the local development/runtime authority.
- V3 runtime is pinned to Node 22 while global Node 26 remains unchanged.
- focused V3 tests: `9/9 PASS`.
- `/api/roadmap`: canonical current state + milestone list PASS.
- Roadmap authority binds project id, repository identity, repository HEAD, and fixed repo-relative source.
- missing/invalid Roadmap returns explicit `NOT_AVAILABLE`.
- browser performs no Markdown parsing and no current-state inference.
- CN Mac browser DOM precheck: Revision 4 / V3.3 / current WP / V3.3.2 / milestone list PASS.
- production legacy-boundary scan PASS; old V2 status/branch markers absent from rendered DOM.

## Next exact gate

Closed. Successor authority: `AICC-V3-WP-TASK-CORE-001`.

## Owner UAT closure

- Result: `PASS`
- Owner decision: explicit `pass` on 2026-09-04.
- Exact implementation head under UAT: `3cbf3feb07b35eda3a3833b52ae084f7cc8aab31`.
- V3 CI Run #4: `PASS`.
- Closure: `AICC-V3-CANONICAL-ROADMAP-001 = CLOSED`.
