# AICC-V2-REVIEW-EXACT-HEAD-CI-001

Milestone: M5 — Review + Exact-head CI  
Status: ACTIVE / OWNER_AUTHORIZED  
Current phase: Phase 6 — Owner Human UAT

## Contract

`AICC_DECISION_AUTHORITY = 0` — Review providers and CI systems produce their own results; AICC transports, binds, persists, and displays evidence.

Canonical exact-head identity: `(repository, pr_number, head_sha)`.
`CURRENT_PR_HEAD_SOURCE = CANONICAL_PR_FACT`; the PR read model's external `headSha` is the source of current head identity.

Review evidence fields: `review_id`, `repository`, `pr_number`, `head_sha`, `reviewer`, `review_provider`, `review_status`, `review_summary`, `reviewed_at`.

CI evidence fields: `ci_run_id`, `repository`, `pr_number`, `head_sha`, `provider`, `workflow`, `status`, `conclusion`, `started_at`, `completed_at`, `url`.

If `CURRENT_PR_HEAD_SHA != EVIDENCE_HEAD_SHA`, evidence is `STALE_FOR_CURRENT_HEAD`. It remains historical and does not count as current PASS.

## Phase Plan

Phase 1 — Exact-head Evidence Model [COMPLETE]
Phase 2 — Review Integration [COMPLETE]
Phase 3 — CI Integration [COMPLETE]
Phase 4 — Stale Evidence Invalidation [COMPLETE]
Phase 5 — PR Workspace Projection [COMPLETE]
Phase 6 — Owner Human UAT [CURRENT]
