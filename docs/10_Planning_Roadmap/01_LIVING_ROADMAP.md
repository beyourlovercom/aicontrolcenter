# AI Control Center Living Roadmap

## Current milestone

`M4 — PR Runner Foundation`

## Authority

Current Authority: `fcd41386fafd6ee2083e73cdee71bee68a3a1e09`

Closed Work Packages: `AICC-VISIBLE-SLICE-001`, `AICC-OPENSPEC-READMODEL-001`, `AICC-CONTROL-LOOP-001A`

Current Work Package: `AICC-CODEX-ONLY-MIGRATION-001`

Next Work Package after `AICC_SELF_DEVELOPMENT_READY`: `AICC-V2-PR-RUNNER-001`

AICC_SELF_DEVELOPMENT_READY: `NOT_YET_PASS`

`AICC-V2-PR-RUNNER-001`

## Active V2 Milestones

### M1 — Control Surface Finalization
Work Packages: `AICC-V2-001`, `AICC-V2-002`, `AICC-V2-003`, `AICC-V2-004`

### M2 — Human UAT Control
Work Packages: `AICC-V2-005`, `AICC-V2-005-R1`, `AICC-V2-005-R2`, `AICC-V2-005-R3`, `AICC-V2-005-R4`, `AICC-V2-005-R5`

### M3 — First Usable Version Closure
Work Packages: `AICC-V2-005`, `AICC_SELF_DEVELOPMENT_READY`

### M4 — PR Runner Foundation
Work Packages: `AICC-V2-PR-RUNNER-001`

### M5 — Review + Exact-head CI
Work Packages: none yet

### M6 — Autonomous PR Delivery
Work Packages: none yet

### M7 — WP Automatic Lifecycle
Work Packages: none yet

### M8 — Evidence & Audit
Work Packages: none yet

### M9 — Mobile Owner Console
Work Packages: none yet

### M10 — Multi-project AICC
Work Packages: none yet

## Legacy Historical Milestones

### M1 — Visible Foundation

Work Packages:
`AICC-VISIBLE-SLICE-001`,
`AICC-OPENSPEC-READMODEL-001`

### M2 — Authority And Workspace Control

Work Packages:
`AICC-CONTROL-LOOP-001A`,
`AICC-POST-MERGE-UAT-001`,
`AICC-POST-MERGE-UAT-001-R1`,
`AICC-POST-MERGE-UAT-001-R2`,
`AICC-CODEX-ONLY-MIGRATION-001`,
`AICC-CONTROL-LOOP-001B`

### M3 — Runtime

Formal Work Packages:

`AICC-V2-001` — `PASS`
`AICC-V2-002` — `PASS`
`AICC-V2-003` — `PASS`
`AICC-V2-004` — `PASS`
`AICC-V2-005` — `WAITING_OWNER_HUMAN_UAT`
`AICC-V2-PR-RUNNER-001` — `READY_FOR_OWNER_AUTHORIZATION` / bootstrap self-development Work Package

Future Work Packages:
`AICC-CONTROL-LOOP-001C`,
`AICC-CONTROL-LOOP-001D`,
`AICC-CONTROL-LOOP-001E`,
`AICC-CONTROL-LOOP-001F`

## Delivery sequence

1. AICC-VISIBLE-SLICE-001 — closed installable macOS visual app.
2. AICC-OPENSPEC-READMODEL-001 — closed local OpenSpec read model.
3. AICC-CONTROL-LOOP-001A — closed authority, workspace sync, and next Work Package resolver.
4. AICC-POST-MERGE-UAT-001 — 001A closeout, roadmap authority update, and macOS UAT build.
5. AICC-POST-MERGE-UAT-001-R1 — first Human UAT remediation (Human UAT failed).
6. AICC-POST-MERGE-UAT-001-R2 — Human UAT remediation remains unresolved and blocked by the Codex-only architecture migration; it is not closed and Human UAT remains pending.
7. AICC-CODEX-ONLY-MIGRATION-001 — current Codex-only migration through a new main-bound Human UAT artifact.
8. 001B — OpenSpec Binding (planned, owner authorization not authorized).
9. 001C — Codex Runtime Observer (future placeholder; no formal WP record).
10. 001D — Owner Authorization & Governed Codex Runtime (future placeholder; no formal WP record).
11. AICC_SELF_DEVELOPMENT_READY — `NOT_YET_PASS`; requires Owner Human UAT.
12. AICC-V2-PR-RUNNER-001 — AICC PR Runner Foundation (ready for Owner authorization; bootstrap self-development Work Package).
13. 001F — Autonomous Delivery Loop (future placeholder; no formal WP record).

## Current safety state

The application is authority-first and Codex-only. It uses fixed typed repository and Codex operations, fails closed on unknown authority, requires evidence-bound Owner authorization and explicit confirmation, and never exposes arbitrary shell input.

The build is an unsigned/ad-hoc UAT artifact only. It does not create a Release or Deploy. AICC-V2-005 remains `WAITING_OWNER_HUMAN_UAT`; only the Owner can produce the final Human UAT PASS. `AICC_SELF_DEVELOPMENT_READY` remains `NOT_YET_PASS`. `AICC-V2-PR-RUNNER-001` is ready for Owner authorization as the bootstrap self-development Work Package; no PR Runner code is implemented here.
