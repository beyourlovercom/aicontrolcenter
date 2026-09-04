# AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1 — Global Canonical Lifecycle Projection

Work Package ID: `AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1`
Parent Milestone: `M8 — AICC Lifecycle Intelligence`
Roadmap Group: `8.3 — Global Canonical Lifecycle Projection`
Status: `ACTIVE / FORMALIZATION_REPAIRED / ROUND_CLOSURE_RECONCILIATION_REQUIRED`
Priority: `P0`

## Objective

Make all lifecycle-facing AICC surfaces consume one canonical lifecycle projection
derived from real runtime/execution evidence while preserving independent domain
state dimensions and `AICC_DECISION_AUTHORITY = 0`.

## Canonical Architecture

```text
Runtime durable truth / canonical execution evidence
        ↓
Global Canonical Lifecycle Resolver
        ↓
Exact Run Lifecycle Projection
        ↓
Execution / Task / Bridge / Runtime Monitor / Global Feedback
```

Run lifecycle, Result availability, Feedback delivery, Control Loop lifecycle,
and Human Owner UAT remain distinct dimensions. One dimension must not invent or
rewrite another.

## Round Plan

1. Round 1 — Existing Status Authority Audit
2. Round 2 — Canonical Lifecycle Resolver
3. Round 3 — Execution + Task Projection
4. Round 4 — Bridge Projection
5. Round 5 — Runtime Monitor + Global Feedback Projection
6. Round 6 — Cross-Surface Integration UAT + Freeze

## Reconciliation Note — 2026-09-03

This formal WP file was missing even though the Living Roadmap had already named
this ID as the current Work Package. The newer development branch contains
substantial implementation and verification evidence beyond the Roadmap's old
`Round 1 — NEXT` label. This file repairs formalization only; it does **not**
retroactively declare any Round CLOSED without a round-bound closure record.

Observed evidence includes:

- `globalStateReadModel.test.ts` reports the global canonical lifecycle projection
  core contract PASS.
- Project-scoped Task / Execution / Run / Result / Feedback / Control Loop work
  exists with exact-binding and no-latest/no-selected fallback contracts.
- PASS-tagged Phase 3, Phase 4, and Phase 5 convergence commits exist in Git history.
- `runtimeResultFeedbackControlLoopProjection.test.ts` PASS proves independent Run,
  Execution, Result, Feedback, and Control Loop projection dimensions on the
  reconciled development baseline.
- `uiLifecycleConsumerProjection.test.ts` PASS proves lifecycle-facing UI consumers
  read Layer-2 projected state rather than becoming independent semantic authority.
- `aeb9ce6` records `[PASS PHASE6-PRE-UAT]`; Human Owner UAT is still not inferred.
- One older Task lifecycle test assertion expects a Bridge invalidation chain that
  was intentionally removed by `a9ee24b` to stop runtime write amplification; it is
  classified as repository stale-test debt and is not silently weakened here.

## Current State

`IMPLEMENTATION_EVIDENCE = PRESENT`

`EXACT_ROUND_CLOSURE_STATE = RECONCILIATION_REQUIRED`

`HUMAN_OWNER_UAT = NOT_CLAIMED`

`AICC_V2_FINAL_E2E_HUMAN_UAT = NOT_YET_PASS`

## Acceptance Criteria

- Canonical projection preserves project identity and exact entity identity.
- No latest/selected fallback invents lifecycle or result authority.
- Run, Execution, Task, Result, Feedback, Control Loop, and Human UAT dimensions
  remain independently sourced.
- Runtime Monitor / Bridge / Task / Execution / Global Feedback render canonical
  projection rather than local semantic derivation.
- Exact-run terminal propagation regression is proven.
- Cross-surface integration verification passes.
- Human Owner UAT is explicitly obtained before final freeze where required.

## Out of Scope

- AICC semantic PASS/FAIL authority.
- Rewriting Codex/provider results.
- Treating Result availability as implied by Run completion.
- Treating Feedback delivery as implied by Result availability.
- Treating machine UAT or test PASS as Human Owner UAT.
- Unrelated stale repository test-debt cleanup.

## Next Exact Gate

Complete mainline reconciliation first, then perform an exact round-by-round M8.3
evidence audit against the converged GitHub head. Only after that audit may the
Roadmap advance a specific Round to CLOSED or move M8.3 to Human Owner UAT.
