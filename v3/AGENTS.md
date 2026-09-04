# AICC V3 Agent Contract

This file governs all work under `/v3` and overrides legacy V2 implementation assumptions.

## Hard boundaries

`STATE_ROOT = ~/.aicc-v3`
`CANONICAL_PORT = 1420`
`ONE_SERVER = REQUIRED`
`ONE_ACTIVE_PROJECT_CONTEXT = REQUIRED`
`IMPLICIT_REPOSITORY_DISCOVERY = FORBIDDEN`
`LEGACY_V2_IMPORT = FORBIDDEN`
`LEGACY_V2_STATE_READ = FORBIDDEN`
`LEGACY_SERVICE_FALLBACK = FORBIDDEN`

Project facts must come from `~/.aicc-v3/project.json` and the exact repository it names.
Missing/invalid config must fail closed.

## Delivery

One implementation executor per worktree.
Commit and push exact reviewed code before downstream review.
PR creation and merge require explicit Owner authorization.
Human UAT PASS may only be claimed from explicit Owner confirmation.
Production cutover to port 1420 is a separate gate.

## V3.5 executor boundaries

`ONE_ACTIVE_EXECUTOR_LEASE_PER_PROJECT = REQUIRED`
`EXECUTOR_CWD_FROM_PROJECT_CONTEXT = REQUIRED`
`CODEX_SANDBOX = workspace-write`
`CODEX_MULTI_AGENT = DISABLED`
`CODEX_DANGEROUS_BYPASS = FORBIDDEN`
`EXECUTOR_EVENT_REWRITE = FORBIDDEN`
`EXECUTOR_SEMANTIC_RESULT_INFERENCE = FORBIDDEN`

Codex execution contract authority: `docs/40_Architecture/AICC-V3-CODEX-RUN-CONTRACT.md`.
