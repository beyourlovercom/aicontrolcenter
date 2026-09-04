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

## Frozen V3.7 contract

- Authority: `docs/40_Architecture/AICC-V3-PR-DELIVERY-CONTRACT.md`.
- ProjectContext exclusively supplies local repository path, branch, HEAD, and dirty state.
- GitHub supplies remote repository, remote branch SHA, PR facts, default branch, and exact-head check-run facts.
- Draft PR creation requires clean worktree, exact pushed remote HEAD, explicit base/title/body, and no existing open PR for the exact head/base pair.
- AICC never auto-pushes, never creates a non-Draft PR, and exposes no merge/close/edit/ready/release/deploy action.

## Next exact gate

Implement the frozen GitHub fact reader plus `GET /api/pr-delivery` and `POST /api/prs/draft` with focused tests. Do not add UI until exact-head CI passes for the runtime/API checkpoint.
