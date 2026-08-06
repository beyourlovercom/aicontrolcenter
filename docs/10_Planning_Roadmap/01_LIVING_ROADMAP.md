# AI Control Center Living Roadmap

## Current milestone

`M2 — Authority And Workspace Control`

## Authority

Current Authority: `0daa089a7edc8d1852df949636a7f11d19bcecee`

Closed Work Packages: `AICC-VISIBLE-SLICE-001`, `AICC-OPENSPEC-READMODEL-001`, `AICC-CONTROL-LOOP-001A`

Current Work Package: `AICC-POST-MERGE-UAT-001`

Next Work Packages: `001B OpenSpec Binding`, `001C OpenCode Runtime Observer`, `001D Governed Runtime Control`

## Delivery sequence

1. AICC-VISIBLE-SLICE-001 — closed installable macOS visual app.
2. AICC-OPENSPEC-READMODEL-001 — closed local OpenSpec read model.
3. AICC-CONTROL-LOOP-001A — closed authority, workspace sync, and next Work Package resolver.
4. AICC-POST-MERGE-UAT-001 — 001A closeout, roadmap authority update, and macOS UAT build.
5. 001B — OpenSpec Binding (planned, owner authorization not authorized).
6. 001C — OpenCode Runtime Observer.
7. 001D — Governed Runtime Control.

## Current safety state

The application is authority-first. It uses fixed typed repository commands, fails closed on unknown authority, requires explicit Owner confirmation for workspace sync, and never exposes arbitrary shell or product-runtime Push, PR, Merge, migration, deployment, or release actions.

The closeout build is an unsigned/ad-hoc UAT artifact only. It does not create a Release, Deploy, or any product-runtime mutation. 001B, 001C, and 001D remain ordered future Work Packages; no later package is authorized by this roadmap.
