## Purpose

Define the bounded remediation required after failed Human UAT for the merged-main artifact.

## ADDED Requirements

### Requirement: Sync confirmation is explicit and observable

The UI SHALL provide visible Confirm and Cancel controls before invoking `sync_workspace`. Cancel SHALL perform no mutation and visibly report cancellation. Confirm SHALL show loading and then visible success or failure while preserving the backend fixed allowlisted sequence.

#### Scenario: Cancel leaves the repository unchanged

- **WHEN** the user opens the sync confirmation and selects Cancel
- **THEN** the UI reports cancellation and does not invoke `sync_workspace`

### Requirement: Roadmap is formal evidence-driven

The UI SHALL derive roadmap milestone, progress, lifecycle states, current Work Package, and next Work Packages from the Living Roadmap and formal Work Package evidence rather than `src/lib/data.ts`. `AICC-CONTROL-LOOP-001B` SHALL be visible as `PLANNED` / `NOT_AUTHORIZED` without implying authorization.

#### Scenario: Planned binding is visible but not executable

- **WHEN** the repository contains the formal Living Roadmap and 001B Work Package evidence
- **THEN** the UI displays the current package, next packages, and 001B as `PLANNED` / `NOT_AUTHORIZED` without an authorization inference

### Requirement: Validity is separate from execution authorization

The parser SHALL accept valid Work Package records with `PLANNED` and `NOT_AUTHORIZED`. The resolver SHALL preserve the parsed record and block execution with `WORK_PACKAGE_NOT_AUTHORIZED`, not `WORK_PACKAGE_SCHEMA_INVALID`.

#### Scenario: Valid unauthorized package is blocked after parsing

- **WHEN** a Work Package has valid front matter with `status: PLANNED` and `owner_authorization: NOT_AUTHORIZED`
- **THEN** parsing succeeds and resolution returns `WORK_PACKAGE_NOT_AUTHORIZED` without `WORK_PACKAGE_SCHEMA_INVALID`

## Test Matrix

| Case | Evidence |
| --- | --- |
| Dirty sync | Evaluation blocks a dirty workspace |
| Remote-ahead sync | Clean workspace is allowed and safe sequence is recorded |
| Cancel | No `sync_workspace` invocation or mutation |
| Confirm states | Loading, success, and failure are visible and tested |
| Formal roadmap | Living Roadmap and Work Package evidence drive displayed state |
| Unauthorized package | 001B parses and resolves as not authorized |

## Explicit Exclusions

No OpenSpec Archive, Deploy, Release, 001B implementation, authorization mutation, unrelated product refactor, or Human UAT PASS is part of this change.
