## Purpose

Provides a fail-closed authority boundary so the application can safely inspect its governed repository and present the next authorized Work Package without self-authorizing execution.

## ADDED Requirements

### Requirement: Repository identity is canonical and structured

The system SHALL accept only the exact canonical repository path in production, validate its canonical root and Git metadata, and return structured identity fields without exposing credentials.

#### Scenario: Canonical repository is valid
- **WHEN** the fixed canonical path exists, canonicalizes exactly, and contains a valid Git repository with `origin`
- **THEN** the system returns repository identity, branch, HEAD, main SHA, cleanliness, and safe `owner/repository` remote display

#### Scenario: Path escapes canonical root
- **WHEN** an empty, relative, parent, prefixed, symlink-escaping, or different repository path is provided
- **THEN** the system returns `REPOSITORY_INVALID` and performs no Git mutation

### Requirement: Remote authority is an exact read-only check

The system SHALL determine authority only from a fresh `git ls-remote origin refs/heads/main` response and SHALL fail closed for unavailable, malformed, invalid, or mismatched responses.

#### Scenario: Remote SHA matches
- **WHEN** the command returns exactly one valid SHA for `refs/heads/main` matching the required authority
- **THEN** the result is `VERIFIED` with a checked timestamp

#### Scenario: Remote is unavailable or malformed
- **WHEN** the command fails or returns an invalid ref response
- **THEN** the result is `REMOTE_UNAVAILABLE` or `REMOTE_INVALID_RESPONSE`, never `VERIFIED`

### Requirement: Workspace sync is explicitly guarded

The system SHALL evaluate sync without mutation, and SHALL execute only the fixed fetch, switch, and fast-forward merge sequence after immediate revalidation and explicit Owner confirmation.

#### Scenario: Dirty or guarded workspace
- **WHEN** the worktree is dirty or any execution guard is active
- **THEN** evaluation returns a specific blocker and sync does not execute

#### Scenario: Isolated fast-forward sync
- **WHEN** all guards pass and the Owner confirms the revalidated plan
- **THEN** the system executes only the allowlisted sequence and returns structured success or the first failure without recovery

### Requirement: Work Package resolution is strict and non-authorizing

The system SHALL parse only known YAML front matter fields, require all mandatory fields, require closed dependencies and complete named OpenSpec planning, and SHALL return `START_ALLOWED` only when every gate matches the current authority.

#### Scenario: One valid authorized Work Package
- **WHEN** one Work Package is authorized, dependencies are closed, authority and local main match, its named Change is complete, and all guards are clear
- **THEN** the resolver returns that Work Package with `START_ALLOWED`

#### Scenario: Multiple or invalid candidates
- **WHEN** multiple authorized candidates exist or any schema, dependency, authority, planning, or guard condition fails
- **THEN** the resolver returns explicit blockers and never silently selects or starts a Work Package
