# AICC-V3-PR-DELIVERY-001

Status: `ACTIVE / OWNER_AUTHORIZED`

## Objective

Add the smallest trustworthy PR Delivery layer for AICC V3 so GitHub PR facts, Draft PR creation, and exact-head CI status are bound to the current ProjectContext without granting AICC merge authority.

## Authority

- ProjectContext remains repository / branch / HEAD authority.
- GitHub is authoritative for remote PR and workflow facts.
- AICC may transport and display PR facts; it does not decide merge readiness.
- Draft PR creation must target the exact active branch and declared base branch.

## In scope

- repository/branch/head GitHub reconciliation;
- existing PR lookup for the exact head branch;
- Draft PR creation only after explicit action;
- exact-head workflow/CI status display;
- durable PR identity binding where needed;
- focused tests, minimal UI, exact-head CI, Owner UAT.

## Out of scope

- automatic merge;
- production deploy/tag/release;
- force-push or branch rewrite;
- auto-close or mutate historical PR #11;
- GPT Bridge / auto return (V3.8).

## Hard boundaries

`AICC_DECISION_AUTHORITY = 0`
`AICC_RESULT_REWRITE = 0`
`AUTO_MERGE = 0`
`PR_CREATE_MODE = DRAFT_ONLY`

## Next exact gate

Freeze the PR Delivery contract and GitHub fact model before implementing any PR API or UI. Do not create, close, merge, or edit a PR in this gate.
