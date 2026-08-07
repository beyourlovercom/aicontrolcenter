---
schema: aicc-work-package/v1
id: AICC-POST-MERGE-UAT-001-R1
title: Human UAT Remediation for Sync, Roadmap Evidence, and WP Authorization Parsing
status: AUTHORIZED
authority_sha: 0050ca945d107a0275223fac8de560f3d19f01ef
openspec_change: aicc-post-merge-uat-001-r1
dependencies:
  - id: AICC-POST-MERGE-UAT-001
    status: AUTHORIZED
previous_run_status: HUMAN_UAT_FAIL
owner_authorization: AUTHORIZED_FOR_IMPLEMENTATION
scope:
  - replace the Tauri-incompatible sync confirmation with explicit Confirm and Cancel UI and visible result states
  - derive the roadmap UI from Living Roadmap and formal Work Package evidence
  - separate Work Package schema validity from execution authorization for PLANNED / NOT_AUTHORIZED records
acceptance:
  previous_uat_artifact_sha: 0050ca945d107a0275223fac8de560f3d19f01ef
  criteria:
    - dirty workspace blocks sync
    - clean remote-ahead workspace allows guarded sync
    - cancel performs no mutation
    - confirm preserves fetch, revalidate, switch main, and ff-only merge sequence
    - roadmap displays formal milestone, progress, lifecycle states, current and next Work Packages
    - AICC-CONTROL-LOOP-001B parses and displays as PLANNED / NOT_AUTHORIZED
    - valid unauthorized Work Packages parse but resolve with WORK_PACKAGE_NOT_AUTHORIZED
    - all remediation tests and exact-head CI pass
    - a new SHA-bound macOS artifact is produced
    - Human UAT retest remains pending
---

# AICC-POST-MERGE-UAT-001-R1

This remediation is authorized only because Human UAT failed against artifact SHA `0050ca945d107a0275223fac8de560f3d19f01ef`. It does not close or change the authorization of `AICC-POST-MERGE-UAT-001`, and it does not authorize implementation of 001B.

OpenSpec Archive, Deploy, Release, 001B implementation, 001C/001D work, and automatic Human UAT PASS are excluded. Exit state is `WAITING_HUMAN_UAT_RETEST`.
