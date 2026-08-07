---
schema: aicc-work-package/v1
id: AICC-CONTROL-LOOP-001B
title: OpenSpec Binding
status: PLANNED
authority_sha: 0daa089a7edc8d1852df949636a7f11d19bcecee
openspec_change: aicc-control-loop-001b
dependencies:
  - id: AICC-CONTROL-LOOP-001A
    status: CLOSED
  - id: AICC-POST-MERGE-UAT-001
    status: CLOSED
previous_run_status: CLOSED
owner_authorization: NOT_AUTHORIZED
scope:
  - read-only binding of complete OpenSpec plans to Work Package records
  - explicit planning and validation evidence for future Owner authorization
  - no OpenSpec or OpenCode execution
acceptance:
  criteria:
    - Planning artifacts define typed, read-only OpenSpec binding behavior
    - Dependency, authority, and owner-gate checks fail closed
    - Test matrix covers valid, incomplete, malformed, ambiguous, and unauthorized cases
    - Apply, Sync, Archive, OpenCode start, and self-authorization are explicitly prohibited
    - Implementation remains blocked until a separate Owner authorization changes this contract
---

# AICC-CONTROL-LOOP-001B

OpenSpec Binding is a future Work Package. Its formal state is `PLANNED` and its owner authorization is `NOT_AUTHORIZED`; this document cannot authorize itself.
