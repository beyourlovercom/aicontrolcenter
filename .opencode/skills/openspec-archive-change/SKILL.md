---
name: openspec-archive-change
description: Archive a completed Change only after explicit Owner Closure Authorization.
allowed-tools: Bash(openspec:*)
license: MIT
compatibility: Requires openspec CLI.
metadata:
  author: openspec
  version: "1.0"
  generatedBy: "1.7.0"
---

OPEN_SPEC_SYNC = PERMANENT_DENY

Archive is a guarded closure operation. It must never synchronize delta specs or modify main specifications.

## Contract

- Use only `openspec/changes/<change-id>/` as the active Change root.
- Archive only to `openspec/changes/archive/<archive-directory>/`.
- Require explicit Owner Closure Authorization for the exact Change.
- Require complete planning artifacts and completed implementation tasks.
- Preserve `.openspec.yaml` and all Change contents while moving the directory.
- Do not perform specification synchronization.
- Do not execute this operation without the Owner authorization.

## Read-only preparation

1. Run `openspec status --change "<change-id>" --json`.
2. Verify Proposal, Specs, Design, and Tasks are complete.
3. Verify `tasks.md` has no incomplete tasks.
4. Present the intended archive directory and the fact that no main spec will change.
5. Ask for explicit Owner Closure Authorization.

## Authorized move

After authorization, create `openspec/changes/archive/` if needed and move the exact Change directory beneath it. Use a date-prefixed archive directory when the Change name has no date prefix. Report the result and do not perform any synchronization.
