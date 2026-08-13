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
Work Packages: `AICC-V2-UI-WORKFLOW-001`, `AICC-V2-DUAL-PANEL-001`, `AICC-V2-VISUAL-IDENTITY-UNIFICATION-001`, `AICC-V2-RUNTIME-OBSERVER-001`

### M2 — Human UAT Control
Work Packages: `AICC-V2-HUMAN-UAT-001`

### M3 — First Usable Version Closure
Work Packages: `AICC-V2-SELF-DEVELOPMENT-UAT-001`

### M3.4 — Fast Execution Path
Work Packages: `AICC-V2-FAST-EXECUTION-PATH-001`

### M3.5 — GPT Bridge Contract
Work Packages: `AICC-V2-GPT-BRIDGE-001` — `CLOSED`; 001A and 001B complete,
Human UAT PASS, First Usable Version hard gates 5/5 PASS.

### M3.75 — Autopilot Until Human UAT
Work Packages: `AICC-V2-AUTOPILOT-UNTIL-UAT-001`

### M3.9 — Local Service Autostart
Work Packages: `AICC-V2-LOCAL-SERVICE-AUTOSTART-001`

### M4 — PR Runner Foundation
Work Packages: `AICC-V2-PR-RUNNER-001`

### M5 — Review + Exact-head CI
Work Packages: `AICC-V2-REVIEW-CI-001`

### M6 — Autonomous PR Delivery
Work Packages: `AICC-V2-AUTO-DELIVERY-001`

### M7 — WP Automatic Lifecycle
Work Packages: `AICC-V2-WP-LIFECYCLE-001`

### M8 — Evidence & Audit
Work Packages: `AICC-V2-EVIDENCE-001`

### M9 — Mobile Owner Console
Work Packages: `AICC-V2-MOBILE-OWNER-001`

### M10 — Multi-project AICC
Work Packages: `AICC-V2-PROJECT-REGISTRY-001`

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
9. AICC-V2-VISUAL-IDENTITY-UNIFICATION-001 — Visual Identity Unification (ready for Owner authorization; visual remediation only).
11. AICC-V2-SELF-RELOAD-RESILIENCE-001 — Self-Reload Resilience (future; no implementation started).
12. 001D — Owner Authorization & Governed Codex Runtime (future placeholder; no formal WP record).
13. AICC_SELF_DEVELOPMENT_READY — `NOT_YET_PASS`; requires Owner Human UAT.
14. AICC-V2-PR-RUNNER-001 — AICC PR Runner Foundation (ready for Owner authorization; bootstrap self-development Work Package).
15. 001F — Autonomous Delivery Loop (future placeholder; no formal WP record).
16. AICC-V2-GPT-BRIDGE-001 — closed GPT Bridge 001A/001B and First Usable
    Version hard gates 5/5; remaining Composer fallback ambiguity is a
    non-blocking P1 backlog finding.

## Current safety state

The application is authority-first and Codex-only. It uses fixed typed repository and Codex operations, fails closed on unknown authority, requires evidence-bound Owner authorization and explicit confirmation, and never exposes arbitrary shell input.

## V2 baseline closure

`AICC-V2-UI-WORKFLOW-001` — `OWNER_UI_UAT = PASS`; `STATUS = COMPLETE`.

`AICC_ENTITY_CONTEXT_FOUNDATION` — `STATUS = APPROVED_BASELINE`; frozen authority HEAD: `9ebde86f019b831d41158fe38e3be7078bd02e53`.

The historical bootstrap formalization label remains only as a documented legacy compatibility note. The Entity Context Foundation is not reopened by the Dual Panel Work Package.

The build is an unsigned/ad-hoc UAT artifact only. It does not create a Release or Deploy. AICC-V2-005 remains `WAITING_OWNER_HUMAN_UAT`; only the Owner can produce the final Human UAT PASS. `AICC_SELF_DEVELOPMENT_READY` remains `NOT_YET_PASS`. `AICC-V2-PR-RUNNER-001` is ready for Owner authorization as the bootstrap self-development Work Package; no PR Runner code is implemented here.
