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

## Global UI Preview First V1

The top-level `AGENTS.md` and `docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md` apply to all V4 project contexts. For each Copy GPT Context request, read the canonical policy from `beyourlovercom/aicontrolcenter` GitHub main at a verified exact SHA and include its bounded GPT instruction, identity and provenance. Missing/invalid policy must fail closed, not silently omit the preview requirement.

Only GPT classifies UI work; AICC neither assigns `OWNER_VISUAL_PASS` nor authorizes execution. Browser Bridge delivery content remains immutable.

No V4 read API may mutate GitHub, switch branches, start executors, or change machine state.
