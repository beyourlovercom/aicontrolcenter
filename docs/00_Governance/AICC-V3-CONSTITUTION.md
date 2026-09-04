# AICC V3 Constitution

Status: `ACTIVE / CLEAN_REBUILD`

## Core authority

`ONE_SERVER = TRUE`
`ONE_ACTIVE_PROJECT_CONTEXT = TRUE`
`ONE_REPOSITORY_AUTHORITY = TRUE`
`ONE_RUNTIME_STATE_STORE = TRUE`
`ONE_WEB_ENTRYPOINT = aicc.b`

`AICC_DECISION_AUTHORITY = 0`
`AICC_RESULT_REWRITE = 0`
`AICC_TRANSPORT_ONLY = 1`

All project-scoped APIs must derive from the same typed `ProjectContext`.
No API, UI component, background process, or fallback may discover its own repository.

## Forbidden behavior

`LEGACY_V2_STATE_IMPORT = FORBIDDEN`
`IMPLICIT_REPOSITORY_DISCOVERY = FORBIDDEN`
`UI_CURRENT_STATE_INFERENCE = FORBIDDEN`
`FALLBACK_TO_LEGACY_SERVICE = FORBIDDEN`
`MULTIPLE_CANONICAL_PORTS = FORBIDDEN`
`HIDDEN_DEFAULT_PROJECT = FORBIDDEN`
## State and service boundary

Canonical state root: `~/.aicc-v3/`.
Canonical project config: `~/.aicc-v3/project.json`.
Canonical production port: `1420`.
Temporary development ports are allowed only before cutover and are never authority.

If project config is missing, invalid, or points at an unavailable repository, V3 must fail closed.
It must never fall back to the V2 repo, current process cwd, browser cache, or another project.

## Development boundary

V3 source lives under `/v3` until the clean rebuild replaces the legacy root implementation.
No V3 module may import from legacy V2 application modules.
Tests must enforce this boundary.

Human UAT is Owner authority only. Automated checks, screenshots, or DOM inspection are pre-UAT evidence, never Human UAT PASS.
PR merge, production cutover, tag, and release remain separate gates.