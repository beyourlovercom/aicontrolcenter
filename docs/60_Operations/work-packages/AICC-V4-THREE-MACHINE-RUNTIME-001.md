# AICC-V4-THREE-MACHINE-RUNTIME-001

Status: `IMPLEMENTATION COMPLETE / READY FOR PR`

## Goal
Display CN Mac, US Mac and Windows runtime evidence without giving AICC remote execution authority or creating a second project truth source.

## Contract
- `v4/machines.json` is GitHub-backed stable machine identity / display-role configuration.
- Runtime observation is external, ephemeral evidence produced by GPT through Remote Desktop Commander and stored outside the repository.
- AICC consumes the observation read-only through `GET /api/runtime`.
- Old observations become `STALE_OBSERVATION`; an old `ONLINE` report is never displayed as current online state.
- Project association is runtime evidence only and never changes GitHub Roadmap/WP/Task/PR facts.
- AICC does not ping machines, run shell commands, switch branches, start executors, or write runtime observations.

## Exit Gate
V4 + V3 regressions, three-machine real observation smoke, stale observation smoke, read-only API gate, exact-head CI, Draft PR.
