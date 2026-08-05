## Context

The current Tauri library has no commands and the Svelte application uses embedded demonstration data. The repository contract fixes one canonical runtime path and permits only typed Git operations; see `proposal.md` and the repository-control-loop spec for observable behavior.

## Goals / Non-Goals

**Goals:**

- Keep all process execution in Rust behind fixed command functions and fixed argument arrays.
- Separate pure evaluation from Owner-triggered mutation and revalidate immediately before sync.
- Make parser and resolver inputs dependency-injectable for isolated temporary repository tests.
- Preserve the existing three-column visual system while replacing false PASS states.

**Non-Goals:**

- OpenCode or OmO Slim runtime control, OpenSpec Apply/Sync, product Push/PR/Merge, multi-project selection, or persistent writer locks.

## Decisions

- Use `std::process::Command` directly rather than a shell or command runner; this makes arbitrary shell input structurally unavailable.
- Centralize a bounded Git runner with an explicit operation enum, timeout, output cap, and redaction. The alternative of invoking a generic executable was rejected because it weakens the allowlist.
- Validate the canonical path before every production operation and use injected roots for tests. The alternative of trusting frontend paths was rejected due to traversal and symlink escape risk.
- Represent authority, evaluation, and resolver blockers as serde enums and records. Unknown parser fields and missing required fields produce schema blockers rather than inferred status.
- Call Tauri commands through `invoke` only from a typed frontend adapter; browser development uses a deterministic unavailable state rather than a fake verified state.

## Risks / Trade-offs

- [Risk] Git operations may block on network or credentials. → Mitigation: bounded timeout, capped output, and redacted structured errors.
- [Risk] Sync can race with external changes. → Mitigation: re-read identity, authority, guards, and clean state immediately before the fixed sequence.
- [Risk] Existing markdown contracts may contain legacy prose statuses. → Mitigation: formal resolver fields come only from strict front matter.

## Migration Plan

Update governance documents first, then add the Rust boundary and UI adapter. No migration or canonical sync is run during development; isolated temporary repositories cover successful sync tests.
