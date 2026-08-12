# AICC V2 UI / Interaction Standard

- Document ID: `AICC-V2-UI-INTERACTION-STANDARD-001`
- Version: `1.0`
- Status: `APPROVED_BASELINE`

## Shell and language

The primary shell is Roadmap/Navigation on the left, selected entity and Owner
actions in the center, and Status & Evidence on the right. Feature Work
Packages must not redesign this shell independently. Roadmap hierarchy is
`Milestone → Work Package → PR`.

Owner-facing UI is Chinese-first. SHA, HEAD, Run ID, paths, reason codes, and
internal states remain available as secondary evidence.

## Interaction rules

Button enabled state is advisory UX only. Every consequential action performs a
fresh live canonical decision on click. Normal operation must not require
manual refresh, repeated identical authorization, terminal use, or service
restart. Failures visibly include state, reason, impact, and next action.

Runtime COMPLETED, Validation PASS, Human UAT PASS, Bridge CONSUMED, and WP
CLOSED remain separate domains. Human UAT rounds contain at most seven items;
only the current round is expanded by default.

The approved AICC V2 visual system—spacing, cards, badges, actions, evidence
typography, and Chinese-first labels—is shared across features.
