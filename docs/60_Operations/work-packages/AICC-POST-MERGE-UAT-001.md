---
schema: aicc-work-package/v1
id: AICC-POST-MERGE-UAT-001
title: 001A Closure, Roadmap Authority Update, and macOS UAT Build
status: AUTHORIZED
authority_sha: 0daa089a7edc8d1852df949636a7f11d19bcecee
openspec_change: aicc-post-merge-uat-001
dependencies:
  - id: AICC-CONTROL-LOOP-001A
    status: CLOSED
previous_run_status: NOT_STARTED
owner_authorization: AUTHORIZED_FOR_IMPLEMENTATION
scope:
  - close AICC-CONTROL-LOOP-001A at the accepted post-merge SHA
  - update Living Roadmap authority and closed package state
  - create the non-authorizing AICC-CONTROL-LOOP-001B planning contract
  - produce an unsigned/ad-hoc macOS UAT build with commit-addressed evidence
acceptance:
  accepted_sha: 0daa089a7edc8d1852df949636a7f11d19bcecee
  criteria:
    - 001A is formally CLOSED and remains unarchived
    - Roadmap authority is the exact accepted SHA and 001B/001C/001D order is preserved
    - workflow_dispatch and main push build paths use npm ci
    - UAT artifacts include .app.zip, .dmg, SHA256SUMS.txt, codesign-details.txt, and explicit full/short SHA evidence
    - No Release, Deploy, push, PR, merge, migration, or runtime control is introduced
    - 001B is PLANNED and NOT_AUTHORIZED with complete OpenSpec planning
---

# AICC-POST-MERGE-UAT-001

This closeout is accepted at `0daa089a7edc8d1852df949636a7f11d19bcecee`. It stops for human UAT after producing evidence; it does not authorize or execute another Work Package.
