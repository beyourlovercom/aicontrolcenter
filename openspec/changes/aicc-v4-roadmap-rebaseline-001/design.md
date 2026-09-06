## Context

The sealed V3 roadmap and final handoff are authoritative production evidence. The older `01_LIVING_ROADMAP.md` is retained for historical compatibility but may not claim current execution authority after V3 closure.

## Decisions

- Keep V3 evidence immutable and create a separate V4 canonical roadmap.
- Keep legacy V2/M4 history readable while clearly marking it historical/superseded.
- Treat effort values as planning ranges, not execution authorization or SLA promises.
- Keep every V4.1+ phase behind a separate named Work Package and Owner Gate.
- Preserve `AICC_DECISION_AUTHORITY = 0` and Codex semantic execution authority.

## Verification

Validate OpenSpec structure, run roadmap documentation regressions, run repository tests relevant to documentation compatibility, scan for portable paths/secrets, run `git diff --check`, and prove no changed path exists under `v3/`, `src/`, or `src-tauri/`.
