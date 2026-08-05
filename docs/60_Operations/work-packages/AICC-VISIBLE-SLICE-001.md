# AICC-VISIBLE-SLICE-001

## First Readable Self-Control App

Status: `IMPLEMENTED_FOR_BUILD_VALIDATION`

Authority SHA: `20d1c9d1608795afebddfe1c2da0127237214735`

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
