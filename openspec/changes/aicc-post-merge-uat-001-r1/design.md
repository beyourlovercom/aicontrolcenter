## Context

The prior artifact was SHA-bound to `0050ca945d107a0275223fac8de560f3d19f01ef`. R1 is an authorized remediation dependent on the original closeout, not a new Work Package authorization path.

## Decisions

- Use an explicit Svelte confirmation surface instead of `window.confirm`, with a discriminated sync state and visible status messages.
- Preserve the Rust fixed Git allowlist and its fetch, revalidation, switch, and fast-forward-only merge sequence.
- Parse the repository Living Roadmap and formal Work Package front matter as read-only evidence for the UI.
- Treat schema validity and execution authorization as separate parser/resolver decisions. `PLANNED` plus `NOT_AUTHORIZED` is valid evidence and produces `WORK_PACKAGE_NOT_AUTHORIZED` when resolution considers execution.
- Keep `AICC-POST-MERGE-UAT-001` `AUTHORIZED` / current and 001B `PLANNED` / `NOT_AUTHORIZED`.

## Exit Gate

Local tests, typecheck, build, strict OpenSpec validation, exact-head CI, and a new SHA-bound macOS artifact must pass. Human UAT retest remains pending.
