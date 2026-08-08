---
schema: aicc-work-package/v1
id: AICC-POST-MERGE-UAT-001-R2
title: Human UAT Remediation R2 — Roadmap, Sync, Resolver, and Owner UI
status: BLOCKED
authority_sha: 7f72b0a32013c1fd0ee410199e41eb1b3f9bc935
openspec_change: aicc-post-merge-uat-001-r2
dependencies:
  - id: AICC-POST-MERGE-UAT-001-R1
    status: HUMAN_UAT_FAIL
previous_run_status: HUMAN_UAT_FAIL
owner_authorization: AUTHORIZED_FOR_IMPLEMENTATION
scope:
  - evidence-derived project, milestone, and Work Package roadmap hierarchy
  - actionable Chinese-first workspace sync state presentation
  - self-explanatory next Work Package execution decision presentation
  - Chinese-first Owner-facing control panel copy with raw engineering evidence preserved
acceptance:
  criteria:
    - Roadmap progress is derived from formal Work Package evidence
    - Sync state is UP_TO_DATE, SYNC_REQUIRED, or BLOCKED with reason and next step
    - Resolver is presented as 下一工作包执行判定 and preserves raw blocker codes
    - 001B remains PLANNED and NOT_AUTHORIZED
    - No runtime, arbitrary shell, OpenSpec Sync, Archive, Deploy, Release, or Human UAT PASS is introduced
    - Frontend, Rust, OpenSpec, type, build, and repository gates pass
---

# AICC-POST-MERGE-UAT-001-R2

This remediation stops at `PASS_AICC_POST_MERGE_UAT_001_R2_READY_FOR_AUTONOMOUS_FINAL_REVIEW`.
