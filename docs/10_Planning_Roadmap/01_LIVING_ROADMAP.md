# AI Control Center Living Roadmap

## Current milestone

`M2 — Authority And Workspace Control`

## Authority

Current Authority: `7f72b0a32013c1fd0ee410199e41eb1b3f9bc935`

Closed Work Packages: `AICC-VISIBLE-SLICE-001`, `AICC-OPENSPEC-READMODEL-001`, `AICC-CONTROL-LOOP-001A`

Current Work Package: `AICC-POST-MERGE-UAT-001-R2`

Next Work Packages: `001B OpenSpec Binding`, `001C OpenCode Runtime Observer`, `001D Governed Runtime Control`

## Delivery sequence

1. AICC-VISIBLE-SLICE-001 — closed installable macOS visual app.
2. AICC-OPENSPEC-READMODEL-001 — closed local OpenSpec read model.
3. AICC-CONTROL-LOOP-001A — closed authority, workspace sync, and next Work Package resolver.
4. AICC-POST-MERGE-UAT-001 — 001A closeout, roadmap authority update, and macOS UAT build.
5. AICC-POST-MERGE-UAT-001-R1 — first Human UAT remediation (Human UAT failed).
6. AICC-POST-MERGE-UAT-001-R2 — current Human UAT remediation (not closed; Human UAT pending).
7. 001B — OpenSpec Binding (planned, owner authorization not authorized).
8. 001C — OpenCode Runtime Observer.
9. 001D — Governed Runtime Control.

## Current safety state

The application is authority-first. It uses fixed typed repository commands, fails closed on unknown authority, requires explicit Owner confirmation for workspace sync, and never exposes arbitrary shell or product-runtime Push, PR, Merge, migration, deployment, or release actions.

The closeout build is an unsigned/ad-hoc UAT artifact only. It does not create a Release, Deploy, or any product-runtime mutation. R2 remains current and pending Human UAT; it does not close the Post-UAT package. 001B, 001C, and 001D remain ordered future Work Packages; no later package is authorized by this roadmap.
