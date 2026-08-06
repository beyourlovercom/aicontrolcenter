---
schema: aicc-work-package/v1
id: AICC-VISIBLE-SLICE-001
title: First Readable Self-Control App
status: CLOSED
authority_sha: dc6d20ec9fb9d33683ad43148d10a5cb5c667552
openspec_change: aicc-visible-slice-001
dependencies: []
previous_run_status: CLOSED
owner_authorization: AUTHORIZED_FOR_IMPLEMENTATION
scope:
  - Tauri and Svelte visual application
  - read-only three-column interface
acceptance:
  accepted_sha: 9c5002316e183cf004777c2b9ab43fe68b0cdbbc
  criteria:
    - Frontend production build passes
    - macOS application workflow exists
---

# AICC-VISIBLE-SLICE-001

## First Readable Self-Control App

Status: `CLOSED`

Authority SHA: `dc6d20ec9fb9d33683ad43148d10a5cb5c667552`

## Scope

- Tauri 2 macOS application.
- Svelte visual interface.
- Fixed three-column layout.
- Collapsible and independently scrollable Roadmap tree.
- Overview, OpenSpec, Agents, and Validation tabs.
- Authority Health, Execution Stack, and Evidence panels.
- Read-only safety state.
- GitHub Actions macOS `.app` and `.dmg` build.

## Explicit exclusions

- No repository mutation.
- No arbitrary shell.
- No `git fetch`.
- No OpenSpec action execution.
- No Oh My OpenCode Slim agent execution.
- No OpenCode session.
- No push, PR creation, merge, migration, or deployment from the application.

## Acceptance

1. Frontend production build passes.
2. Tauri macOS build passes.
3. `.app` workflow artifact exists.
4. `.dmg` workflow artifact exists.
5. Application opens to the approved visual baseline.
