## Purpose

Defines a future read-only binding between a Work Package and its OpenSpec planning evidence without granting execution authority.

## ADDED Requirements

### Requirement: Binding is typed and read-only

The system SHALL parse a strict Work Package contract and expose typed references to proposal, design, tasks, and capability specifications without modifying any file.

#### Scenario: Complete artifacts are read

- **WHEN** all named planning artifacts exist under the canonical change root
- **THEN** the binding returns typed read-only evidence and performs no write

### Requirement: Binding fails closed

The system SHALL return explicit blockers for missing or malformed artifacts, unknown fields, path traversal, duplicate capability paths, dependency failures, authority mismatch, ambiguity, and `NOT_AUTHORIZED` owner state.

#### Scenario: Invalid evidence is blocked

- **WHEN** a named artifact is missing or malformed
- **THEN** the binding returns a specific blocker and does not infer completeness

### Requirement: Binding never authorizes execution

The system SHALL NOT execute OpenSpec Apply, Sync, or Archive; start OpenCode; self-authorize; silently select among candidates; or invoke arbitrary shell commands.

#### Scenario: Complete planned change

- **WHEN** all named artifacts are present and valid but the Work Package is `PLANNED` / `NOT_AUTHORIZED`
- **THEN** the binding returns complete evidence plus a not-authorized blocker and no execution action

#### Scenario: Missing capability specification

- **WHEN** a named capability directory lacks `spec.md`
- **THEN** the binding returns an incomplete-planning blocker and performs no mutation

#### Scenario: Unsafe artifact path

- **WHEN** an artifact reference is absolute, traverses its root, or resolves outside the canonical change directory
- **THEN** the binding returns a path-security blocker and reads no outside file

#### Scenario: Multiple candidates

- **WHEN** more than one candidate could be selected
- **THEN** the binding reports ambiguity and never selects or starts one

## Test Matrix

| Case | Expected result |
| --- | --- |
| Complete named artifacts | Typed complete evidence, still not authorized |
| Missing proposal/design/tasks/spec | Specific incomplete blocker |
| Unknown front-matter field | Schema blocker |
| Dependency not closed | Dependency blocker |
| Authority mismatch | Authority blocker |
| Absolute/traversal path | Security blocker, no outside read |
| Duplicate capability | Ambiguity blocker |
| Planned/not authorized | No execution action |
| Apply/Sync/Archive/OpenCode request | Explicitly denied |

## Security Boundaries

Canonical root validation, read-only filesystem access, no credential access, no shell execution, and explicit Owner authorization are mandatory.

## Rollback

Any future implementation can be reverted as a bounded adapter/test change; planning evidence must not be archived or rewritten as a rollback mechanism.

## Explicit Exclusions

No implementation, authorization, OpenSpec action, OpenCode start, agent execution, repository mutation, Release, Deploy, push, PR, merge, migration, or production action is part of this change.
