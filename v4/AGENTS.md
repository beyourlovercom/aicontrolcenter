# AICC V4 Agent Contract

This file governs all work under `/v4`.

## Canonical architecture

`GITHUB_SOURCE_OF_TRUTH = 1`
`GPT_ORCHESTRATION_AUTHORITY = 1`
`AICC_EXECUTION_AUTHORITY = 0`
`AICC_DECISION_AUTHORITY = 0`
`AICC_REPOSITORY_AUTHORITY = 0`

The Project Registry stores locators only. It MUST NOT persist branch, SHA, PR, CI,
progress, WP, Task, or other project facts as authority. Those facts are read from
GitHub and carry exact GitHub provenance.

Multiple AICC project views MAY point at the same GitHub repository. Project identity
is the explicit registry `id`, never inferred from repository identity.

No V4 read API may mutate GitHub, switch branches, start executors, or change machine state.
