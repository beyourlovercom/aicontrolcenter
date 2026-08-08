# Codex-Only Migration And Human UAT Delivery

## Why

AI Control Center still presents obsolete OpenCode and OmO Slim architecture and has no persisted, evidence-bound Owner authorization or observable Codex delivery state.

## What Changes

- Replace active OpenCode and OmO Slim roadmap, documentation, runtime, and Owner UI assumptions with Codex CLI using the configured `sol` profile.
- Add persisted Owner authorization bound to Work Package ID, Authority SHA, branch, worktree, scope, capabilities, prohibitions, and timestamp.
- Add a typed Codex runtime state machine, observer, and bounded START, PAUSE, RESUME, STOP AFTER CURRENT STEP, and RETRY controls.
- Preserve fail-closed Authority, Resolver, Writer Lock, OpenSpec, independent review, exact-head CI, squash merge, and Human UAT gates.

## Impact

The migration changes formal governance and the local desktop control plane. It does not authorize 001B, create formal records for 001C through 001F, deploy, release, mutate secrets, or mark Human UAT PASS.
