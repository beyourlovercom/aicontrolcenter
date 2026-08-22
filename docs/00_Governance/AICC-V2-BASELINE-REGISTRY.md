# AICC V2 Baseline Registry

| Document ID | Version | Status | Effective | Precedence | Current conformance |
| --- | --- | --- | --- | --- | --- |
| AICC-V2-PROJECT-CONSTITUTION-001 | 1.2 | APPROVED_BASELINE | 2026-08-13 | 1 | PASS |
| AICC-V2-CODE-ARCHITECTURE-STANDARD-001 | 1.0 | APPROVED_BASELINE | 2026-08-12 | 2 | PARTIAL |
| AICC-V2-UI-INTERACTION-STANDARD-001 | 1.5 (`AICC_ROADMAP_CONTEXT_UI_BASELINE = V1.0`) | FROZEN / APPROVED_BASELINE | 2026-08-18 | 2 | PASS |
| AICC_STATE_PROJECTION_ARCHITECTURE_V1 | 1.0 | FROZEN / APPROVED_BASELINE | 2026-08-18 | Shared state projection architecture; specialized entity baselines may add stricter policy | Roadmap PASS; Blueprint / PR / Task architecture-only |
| AICC-WEB-BRIDGE-UI-STANDARD-001 | 1.0 | FROZEN / APPROVED_BASELINE | 2026-08-14 | Specialized under AICC-V2-UI-INTERACTION-STANDARD-001 | PASS |
| AICC_CANONICAL_TASK_INTERACTION_CONTRACT | 1.0 | OWNER_APPROVED_BASELINE | 2026-08-16 | Canonical Task UI interaction authority | PASS |
| AICC_UNIFIED_CANONICAL_TASK_FEED_UI_CONTRACT | 1.0 | OWNER_APPROVED_BASELINE | 2026-08-16 | Canonical Task collection/list projection authority | PASS |
| AICC_V2_CORE_CONTROL_LOOP | 1.0 | OWNER_APPROVED / HUMAN_UAT_PROVEN | 2026-08-16 | Canonical V2 GPT Web → AICC → Codex Luna control-loop authority | PASS |
| AICC_LOCAL_PAGE_FAILSAFE_STATUS_V1 | 1.0 | OWNER_APPROVED_BASELINE | 2026-08-22 | Specialized local-page failure evidence baseline under Local Service Health Recovery and UI standards | PASS |
| AICC_CANONICAL_PATH_IDENTITY_V1 | 1.0 | OWNER_APPROVED_BASELINE | 2026-08-22 | Canonical filesystem/project path identity boundary; raw path equality forbidden as identity authority | PASS |
| AICC-V2-CANONICAL-EXECUTION-STANDARD-001 | 1.2 | APPROVED_BASELINE | 2026-08-13 | 2 | PASS |

The registry records approved authority documents and current implementation
conformance. Execution conformance is PASS for the v1.2 pass-through
control-plane model; v1.0/v1.1 wording remains historical traceability only.

`AICC_V2_CORE_CONTROL_LOOP` conformance includes the closed M8.2.1.8 real
three-round Human UAT, exact Conversation binding, durable expected-turn and
submission reconciliation, exactly-once control/feedback handling, Luna as the
default executor, and terminal stop-state monotonicity. This registry entry
records conformance to the existing approved authority document; it does not
change its semantics or grant AICC decision authority.

## Historical baseline traceability

`AICC-V2-PROJECT-CONSTITUTION-001` version `1.0` was an
`APPROVED_BASELINE` effective `2026-08-12`. It remains the historical prior
version; version `1.1`, effective `2026-08-13`, is the Owner-approved governance
successor and does not silently mutate the meaning of v1.0.

Version `1.2`, effective `2026-08-13`, is the Owner-approved pass-through
successor. It preserves v1.0/v1.1 traceability while removing duplicated
pre-Codex execution authority from AICC.

## Change control

Changing an approved baseline requires `BASELINE_CHANGE_PROPOSAL` with
`STANDARD_ID`, current/proposed version, reason, impact analysis, migration
plan, test impact, rollback, and Owner approval. Without Owner approval,
`BASELINE_CHANGE = DENIED`.
