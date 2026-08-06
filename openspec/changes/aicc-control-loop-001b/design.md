## Context

001A already parses strict Work Package front matter and checks that named OpenSpec planning files exist. 001B would make that relationship explicit and typed, but it is not authorized by this plan.

## Goals / Non-Goals

**Goals:**

- Parse complete named OpenSpec artifacts at a read-only boundary.
- Report deterministic completeness, dependency, authority, and ambiguity blockers.
- Preserve the distinction between evidence and Owner authorization.

**Non-Goals:**

- OpenSpec Apply, Sync, or Archive.
- OpenCode start or runtime control.
- Self-authorization, automatic selection, repository mutation, or product runtime changes.

## Decisions

- Treat Work Package front matter as the identity input and OpenSpec files as evidence only.
- Require exact named artifact paths and reject missing, duplicate, malformed, or path-escaping references.
- Return typed states such as complete, incomplete, invalid, ambiguous, authority-mismatched, and not-authorized.
- Require a separate Owner Gate before any future implementation or execution.

## Security Boundaries

The future adapter must operate under a canonical repository root, use read-only filesystem access, reject traversal and absolute paths, avoid credentials, and never invoke a shell, OpenSpec CLI action, OpenCode, or agent.

## Rollback

If implementation is later authorized and causes regressions, revert the binding adapter and its tests as one reviewed change. Do not archive or mutate planning artifacts to hide a failure.
