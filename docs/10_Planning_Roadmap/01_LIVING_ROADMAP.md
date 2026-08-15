# AI Control Center Living Roadmap

## Current milestone

`M2 — Authority And Workspace Control`

## Authority

Current Authority: `fcd41386fafd6ee2083e73cdee71bee68a3a1e09`

Closed Work Packages: `AICC-VISIBLE-SLICE-001`, `AICC-OPENSPEC-READMODEL-001`, `AICC-CONTROL-LOOP-001A`

Current Work Package: `AICC-CODEX-ONLY-MIGRATION-001`

Next Work Packages: `001B OpenSpec Binding`, `001C Codex Runtime Observer`, `001D Owner Authorization & Governed Codex Runtime`, `001E Codex PR Runner`, `001F Autonomous Delivery Loop`

## Milestones

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
11. 001E — Codex PR Runner (future placeholder; no formal WP record).
12. 001F — Autonomous Delivery Loop (future placeholder; no formal WP record).

## Current safety state

The application is authority-first and Codex-only. It uses fixed typed repository and Codex operations, fails closed on unknown authority, requires evidence-bound Owner authorization and explicit confirmation, and never exposes arbitrary shell input.

The build is an unsigned/ad-hoc UAT artifact only. It does not create a Release or Deploy. R2 remains unresolved and Human UAT remains pending. 001B remains `PLANNED` / `NOT_AUTHORIZED`; 001C through 001F are future placeholders and receive no fabricated status, authorization, or formal Work Package path.

<!-- GPT_GITHUB_WRITE_TEST -->

## M11.5 Roadmap Registration

### M11.5 AICC Self Development Real Run

Status: `PLANNED`

Work Package: `AICC-M11.5-REAL-RUN-001`

Description:

验证 AICC 是否可以根据 Living Roadmap 自动驱动自身开发。
