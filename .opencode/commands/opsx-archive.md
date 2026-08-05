---
description: "Archive a completed Change only with explicit Owner Closure Authorization"
---

OPEN_SPEC_SYNC = PERMANENT_DENY

Archive a completed OpenSpec Change only after explicit Owner Closure Authorization.

## Safety Contract

- The Owner must explicitly authorize closure for the named Change.
- Archiving never modifies or synchronizes main specifications.
- Archiving never performs specification synchronization.
- This command does not authorize implementation, merge, push, or deployment.

## Required Checks

1. Resolve the named Change under `openspec/changes/<change-id>/`.
2. Run `openspec status --change "<change-id>" --json` and require complete planning artifacts.
3. Confirm all implementation tasks are complete and record any validation evidence.
4. Obtain explicit Owner Closure Authorization for this exact Change.
5. Move the Change to `openspec/changes/archive/<archive-directory>/` without changing its contents.
6. Report the archive path and confirm that main specifications were not modified.

If Owner Closure Authorization is absent, stop without changing files.
