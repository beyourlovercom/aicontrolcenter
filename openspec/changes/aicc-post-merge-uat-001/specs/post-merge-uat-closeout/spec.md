## Purpose

Provides formal closeout evidence and a reproducible macOS UAT package without authorizing later execution.

## ADDED Requirements

### Requirement: 001A closeout is exact and unarchived

The repository SHALL record AICC-CONTROL-LOOP-001A as `CLOSED` at authority SHA `0daa089a7edc8d1852df949636a7f11d19bcecee`, and SHALL retain its OpenSpec change directory unarchived.

#### Scenario: Accepted closeout is recorded

- **WHEN** the closeout documents are validated
- **THEN** 001A is `CLOSED` at the exact accepted SHA and its OpenSpec directory remains present

### Requirement: Roadmap preserves future order

The Living Roadmap SHALL use the accepted SHA as current authority, list 001A and the closeout as closed, and preserve 001B OpenSpec Binding before 001C OpenCode Runtime Observer and 001D Governed Runtime Control.

#### Scenario: Future package order remains explicit

- **WHEN** the roadmap is read after closeout
- **THEN** 001B precedes 001C and 001D, and no future package is authorized

### Requirement: UAT workflow is reproducible and non-publishing

The macOS workflow SHALL run on `main` pushes or `workflow_dispatch`, use `npm ci`, assert checkout identity against `GITHUB_SHA`, and emit names containing both full and short commit SHA values.

#### Scenario: UAT artifacts are produced

- **WHEN** the workflow completes successfully
- **THEN** it uploads an app zip, DMG, SHA256SUMS.txt, codesign-details.txt, and explicit commit SHA evidence

#### Scenario: Publishing is unavailable

- **WHEN** the workflow is inspected
- **THEN** it contains no Release, Deploy, push, PR, merge, migration, or production action

### Requirement: Future planning is non-authorizing

001B planning SHALL state `PLANNED` and `NOT_AUTHORIZED` and explicitly prohibit Apply, Sync, Archive, OpenCode start, and self-authorization.

#### Scenario: Planned binding remains blocked

- **WHEN** the resolver encounters 001B after closeout
- **THEN** it reports the package as planned and not authorized without starting or applying it

## Test Matrix

| Case | Evidence |
| --- | --- |
| Exact accepted SHA | Work Package and roadmap values match the required 40-character SHA |
| 001A remains readable | `openspec/changes/aicc-control-loop-001a` remains present and validates |
| 001B is non-authorizing | Front matter and explicit exclusions use `PLANNED` / `NOT_AUTHORIZED` |
| Manual/main triggers | Workflow `on` contains `workflow_dispatch` and `push.branches: [main]` |
| Artifact identity | Full/short SHA capture, filename prefix, checksum, and evidence file are present |
| CI hygiene | Strict OpenSpec, secret, and absolute-path checks are defined |

## Explicit Exclusions

This change does not implement 001B, modify product runtime Rust/TypeScript/Svelte, authorize any future Work Package, run OpenSpec Apply/Sync/Archive, start OpenCode, or create Release/Deploy/push/PR/merge/migration behavior.
