# AICC-V2-RUNTIME-OBSERVER-001: Codex Runtime Observer

Work Package ID: `AICC-V2-RUNTIME-OBSERVER-001`
Status: `PLANNED`
Formalization: `FORMAL_READY`
Type: `RUNTIME_OBSERVER_IMPLEMENTATION`

## Authority

The checkpointed AICC V2 Visual Identity baseline at
`24d25bd2b3dbed439d5acdf6aa78827c058f9d65` is the satisfied visual
dependency and implementation starting point.

## Goal

Implement a persistent center-workspace Runtime Monitor / Codex Runtime
surface using real, observable AICC/Codex runtime evidence.

The monitor will present Runtime Summary, elapsed time, last/current activity,
bounded Live Events, real execution metrics, Process Health, Writer Lock state,
deterministic Acceptance Checklist evidence, and retained terminal evidence.

Runtime data must remain entity-bound: Work Package runtime belongs only to its
Work Package, and Pull Request runtime is shown only when directly bound.

Hard rules: `FAKE_RUNTIME_DATA = 0` and `FAKE_AI_PROGRESS_PERCENT = 0`.

## Scope

- Normalize observable Codex JSONL/runtime events through one event normalizer.
- Build one Runtime Observer read model for the UI.
- Render the persistent Runtime Monitor below the WP/PR workflow and above tabs.
- Show truthful active, completed, failed, and absent runtime states.
- Preserve bounded recent events and terminal diagnostics across UI refresh.
- Derive acceptance items and deterministic progress from the formal Work
  Package acceptance contract and canonical evidence.
- Preserve WP/PR entity isolation, process health, Writer Lock truth, and
  startup/terminal health behavior.

## Dependencies

- `AICC-V2-VISUAL-IDENTITY-UNIFICATION-001` is checkpointed at
  `24d25bd2b3dbed439d5acdf6aa78827c058f9d65`.
- Explicit Owner authorization must target this exact Work Package.
- Authorized HEAD must equal the current repository HEAD before execution.
- Repository, branch, worktree, runtime, and Writer Lock safety gates must
  pass; Writer Lock must be `NOT_HELD` before execution.
- Entity Context Foundation and existing Codex Runtime execution must remain
  valid.

## Acceptance Criteria

- Runtime Monitor is a persistent center surface, not a tab replacement.
- Runtime Summary, activity, events, metrics, health, Writer Lock, and
  terminal evidence use only observable runtime data.
- Unknown events are retained as safe technical evidence and are not falsely
  classified.
- Zero and unavailable metrics remain distinct.
- Silence produces monitoring health interpretations only and never auto-kills
  a run.
- Completed runtime does not change Work Package lifecycle completion.
- Acceptance Checklist progress is deterministic and unavailable when no
  canonical contract can be resolved.
- WP, PR, Milestone, rapid selection, and tab switching do not leak runtime
  context.
- Existing Authorization, Runtime startup health, Writer Lock recovery,
  Entity Context, Dual Panel, Roadmap, and Visual Identity behavior regressions
  remain absent.

## Non-goals and execution boundary

Do not implement a terminal emulator, arbitrary shell endpoint, PR Runner,
GitHub/CI/Merge backend, Retry/Resume, webhook control, new authorization or
Writer Lock state machines, self-reload resilience architecture, or fake
runtime data.

This document formalizes the Work Package only. Implementation has not
started. Explicit Owner authorization is required before execution.
