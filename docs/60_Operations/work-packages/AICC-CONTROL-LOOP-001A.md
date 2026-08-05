---
schema: aicc-work-package/v1
id: AICC-CONTROL-LOOP-001A
title: GitHub Authority, Workspace Sync, and Next Work Package Resolver
status: AUTHORIZED
authority_sha: dc6d20ec9fb9d33683ad43148d10a5cb5c667552
openspec_change: aicc-control-loop-001a
dependencies:
  - id: AICC-VISIBLE-SLICE-001
    status: CLOSED
  - id: AICC-OPENSPEC-READMODEL-001
    status: CLOSED
previous_run_status: CLOSED
owner_authorization: AUTHORIZED_FOR_IMPLEMENTATION
scope:
  - repository identity and canonical path validation
  - read-only remote authority check
  - guarded Owner-triggered workspace sync
  - machine-readable Work Package parsing and resolver
  - corresponding read and control UI
acceptance:
  criteria:
    - Fixed typed Tauri commands are registered
    - Git process execution uses an allowlist and no shell
    - Unknown authority and malformed contracts fail closed
    - Workspace sync requires revalidation and explicit confirmation
    - Canonical dirty repository displays blocked sync state
    - Frontend tests, Rust tests, typecheck, build, and CI pass
---

# AICC-CONTROL-LOOP-001A

This contract is machine-readable only through the YAML front matter. Formal status is never inferred from the prose below.
