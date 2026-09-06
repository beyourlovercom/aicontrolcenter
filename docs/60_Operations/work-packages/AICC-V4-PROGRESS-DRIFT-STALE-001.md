# AICC V4.4 — Progress + Drift / Stale Detection

Status: IMPLEMENTATION COMPLETE / PR GATE
Source of Truth: `GitHub`

## Scope
- project roadmap progress is shown only from an explicit `Progress:` percentage or verifiable Markdown checklist counts on GitHub main
- heading-level progress uses only checklist/explicit progress evidence inside that GitHub heading subtree
- missing progress evidence renders unavailable rather than inferred
- lightweight freshness checks compare the loaded exact ref with the current GitHub default-branch head
- `FRESH` means exact ref match; `STALE` means GitHub advanced; `DRIFT` means repository identity mismatch
- AICC reports drift/staleness and never overrides GitHub

## Boundaries
No Owner-gate inference, GitHub mutation, branch switching, executor start, deploy/release, or machine control.
