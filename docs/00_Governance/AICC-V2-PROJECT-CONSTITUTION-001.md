# AICC V2 Project Constitution

- Document ID: `AICC-V2-PROJECT-CONSTITUTION-001`
- Version: `1.0`
- Status: `APPROVED_BASELINE`
- Effective: `2026-08-12`

This is the highest project-level engineering authority for AICC V2.

## Precedence

`Project Constitution → Approved Baselines → Living Roadmap → Formal Work Package → Implementation → Tests → Human UAT`

A lower layer may not override a higher layer. A conflict is reported as
`BASELINE_CONFLICT` and execution stops until Owner-approved change control is
complete.

## Governing standards

- `AICC-V2-CODE-ARCHITECTURE-STANDARD-001`
- `AICC-V2-UI-INTERACTION-STANDARD-001`
- `AICC-V2-CANONICAL-EXECUTION-STANDARD-001`

## Constitutional rules

1. Every fact has one canonical owner.
2. Consumers read, project, render, persist evidence, or request decisions;
   they do not redefine or independently block/authorize.
3. AICC V2 uses one canonical Local Control Service.
4. Normal data changes do not require service restart; page load resolves live
   state automatically.
5. OpenCode, OpenSpec, and OmO are forbidden runtime dependencies.
6. A baseline change requires a `BASELINE_CHANGE_PROPOSAL`, version change, and
   explicit Owner approval.

Current conformance is assessed separately from the approved status of this
document and its baselines.
