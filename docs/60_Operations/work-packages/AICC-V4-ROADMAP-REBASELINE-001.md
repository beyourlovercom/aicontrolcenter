---
schema: aicc-work-package/v1
id: AICC-V4-ROADMAP-REBASELINE-001
title: V4 Roadmap Rebaseline
status: AUTHORIZED
authority_sha: 45d3862ef0e9ec0df98939363982a8a0346ea723
openspec_change: aicc-v4-roadmap-rebaseline-001
dependencies: []
previous_run_status: PLANNED
owner_authorization: AUTHORIZED_FOR_IMPLEMENTATION
authorization_scope:
  - roadmap and governance documentation only
  - V4 effort budget and ordered delivery sequence
  - reconcile stale legacy current-state declarations
allowed_capabilities:
  - REPOSITORY_SCOPED_DOCUMENTATION_EDIT
  - DOCUMENTATION_VALIDATION
forbidden_capabilities:
  - RUNTIME_SOURCE_CHANGE
  - OPENSPEC_APPLY
  - OPENSPEC_SYNC
  - OPENSPEC_ARCHIVE
  - SELF_AUTHORIZATION
  - AUTOMATIC_NEXT_WP_EXECUTION
  - PR_MERGE
  - RELEASE
  - DEPLOY
acceptance:
  criteria:
    - V3 production baseline remains sealed and unchanged
    - one canonical V4.0 through V4.8 sequence is documented
    - implementation and CI/UAT/closure effort ranges are explicit and totaled
    - legacy M4.1 declarations no longer claim current development authority
    - AICC-CONTROL-LOOP-001B remains PLANNED and NOT_AUTHORIZED
    - no runtime source under v3, src, or src-tauri changes
---

# AICC-V4-ROADMAP-REBASELINE-001

The Owner instruction to continue development and quantify the roadmap/work effort authorizes this bounded V4.0 documentation rebaseline only. It does not authorize V4.1 implementation.

## Exit gate

Stop after reviewed documentation changes, roadmap regression checks, branch commit/push and Draft PR preparation. `AICC-CONTROL-LOOP-001B` requires a separate explicit Owner authorization before implementation.
