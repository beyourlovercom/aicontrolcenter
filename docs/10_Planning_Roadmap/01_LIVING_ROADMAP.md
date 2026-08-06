# AI Control Center Living Roadmap

## Current milestone

`M2 — Authority And Workspace Control`

## Authority

Current Authority: `dc6d20ec9fb9d33683ad43148d10a5cb5c667552`

Closed Work Packages: `AICC-VISIBLE-SLICE-001`, `AICC-OPENSPEC-READMODEL-001`

Current Work Package: `AICC-CONTROL-LOOP-001A`

Next Work Packages: `001B OpenSpec Binding`, `001C OpenCode Runtime Observer`, `001D Governed Runtime Control`

## Delivery sequence

1. AICC-VISIBLE-SLICE-001 — closed installable macOS visual app.
2. AICC-OPENSPEC-READMODEL-001 — closed local OpenSpec read model.
3. AICC-CONTROL-LOOP-001A — authority, workspace sync, and next Work Package resolver.
4. 001B — OpenSpec Binding.
5. 001C — OpenCode Runtime Observer.
6. 001D — Governed Runtime Control.

## Current safety state

The application is authority-first. It uses fixed typed repository commands, fails closed on unknown authority, requires explicit Owner confirmation for workspace sync, and never exposes arbitrary shell or product-runtime Push, PR, Merge, migration, deployment, or release actions.
