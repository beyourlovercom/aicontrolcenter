# AICC V2 Baseline Registry

| Document ID | Version | Status | Effective | Precedence | Current conformance |
| --- | --- | --- | --- | --- | --- |
| AICC-V2-PROJECT-CONSTITUTION-001 | 1.3 | APPROVED_BASELINE | 2026-08-14 | 1 | PASS |
| AICC-V2-CODE-ARCHITECTURE-STANDARD-001 | 1.0 | APPROVED_BASELINE | 2026-08-12 | 2 | PARTIAL |
| AICC-V2-UI-INTERACTION-STANDARD-001 | 1.2 | APPROVED_BASELINE | 2026-08-13 | 2 | PASS |
| AICC-V2-CANONICAL-EXECUTION-STANDARD-001 | 1.3 | APPROVED_BASELINE | 2026-08-14 | 2 | PASS |

The registry records approved authority documents and current implementation
conformance.

The highest active architecture constraint is now:

```text
AICC = transport + status + display + result return
AICC_DECISION_AUTHORITY = 0
AICC_PASS_FAIL_BLOCKED_AUTHORITY = CODEX
```

No Work Package, UI flow, Bridge behavior, runtime adapter, shortcut, or future
automation may introduce a semantic pre-Codex judgment gate inside AICC.
AICC transport/runtime errors remain separate from Codex execution outcomes.

## Historical baseline traceability

`AICC-V2-PROJECT-CONSTITUTION-001` version `1.0` was an
`APPROVED_BASELINE` effective `2026-08-12`. It remains the historical prior
version; version `1.1`, effective `2026-08-13`, is the Owner-approved governance
successor and does not silently mutate the meaning of v1.0.

Version `1.2`, effective `2026-08-13`, is the Owner-approved pass-through
successor. It preserves v1.0/v1.1 traceability while removing duplicated
pre-Codex execution authority from AICC.

Version `1.3`, effective `2026-08-14`, elevates the pass-through model into the
highest explicit architecture constraint: AICC is only the transport,
execution-state/evidence display, and exactly-once result-return layer. Codex
alone owns task-level `PASS`, `FAIL`, `BLOCKED`, `CANCELLED`, and their reasons.

`AICC-V2-CANONICAL-EXECUTION-STANDARD-001` version `1.3` applies the same rule
to every execution entry point and explicitly forbids semantic pre-Codex gates.

## Change control

Changing an approved baseline requires `BASELINE_CHANGE_PROPOSAL` with
`STANDARD_ID`, current/proposed version, reason, impact analysis, migration
plan, test impact, rollback, and Owner approval. Without Owner approval,
`BASELINE_CHANGE = DENIED`.
