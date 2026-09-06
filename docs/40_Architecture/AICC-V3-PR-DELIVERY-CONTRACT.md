# AICC V3 PR Delivery Contract

Contract-Version: 1
Status: `FROZEN / V3.7`

## Purpose

Define the smallest trustworthy GitHub PR delivery layer for AICC V3. AICC transports repository, pull-request, and exact-head CI facts and may create a Draft PR only from an explicit Owner action. It never decides merge readiness and never merges.

## Authority chain

`ProjectContext -> origin reconciliation -> GitHub repository -> exact remote head -> PR facts -> exact-head check runs`

- `ProjectContext` remains authoritative for local repository path, branch, HEAD, and dirty state.
- GitHub is authoritative for remote repository, branch SHA, PR state, and check-run facts.
- No browser field may choose or substitute the PR head branch or head SHA.

## Frozen boundaries

`AICC_DECISION_AUTHORITY = 0`
`AUTO_MERGE = 0`
`PR_CREATE_MODE = DRAFT_ONLY`
`PR_HEAD_SOURCE = PROJECT_CONTEXT_ONLY`
`PR_REMOTE_HEAD_MATCH_REQUIRED = 1`

V3.7 exposes no merge, ready-for-review, close, reopen, edit, approve, release, tag, deploy, force-push, or branch-rewrite action.

## GitHub runtime capability

The CN Mac V3 runtime uses the authenticated GitHub CLI available at `/opt/homebrew/bin/gh`.
The service must perform an explicit GitHub preflight before PR facts or creation are considered available.
Credentials and token values are never returned by an AICC API, persisted by AICC, or rendered in the UI.

Required preflight facts:

- `gh` executable is available;
- authenticated GitHub host is `github.com`;
- remote repository can be read;
- GitHub `nameWithOwner` exactly matches `ProjectContext.repository.identity`;
- GitHub default branch is returned as a remote fact.

## Repository and remote-head reconciliation

The configured `origin` remote must normalize to the same GitHub `owner/repo` identity as `ProjectContext.repository.identity`.

Before Draft PR creation, all of these must be true:

- current `ProjectContext.repository.dirty = false`;
- active branch is non-empty and is not the GitHub default branch;
- `refs/heads/<ProjectContext.branch>` exists on `origin`;
- exact remote branch SHA equals `ProjectContext.repository.head`;
- requested base ref exists remotely and differs from the active head branch.

AICC never pushes automatically in V3.7. A missing or stale remote branch fails closed.

## Existing PR lookup

Every read re-queries GitHub; there is no second authoritative PR cache.

Lookup scope is the exact GitHub repository plus the exact active head branch. Returned PR facts may include:

- PR number and URL;
- `state` and `isDraft` exactly as GitHub reports them;
- exact `headRefName`, `headRefOid`, `baseRefName`;
- title;
- created/updated timestamps when available.

AICC does not translate GitHub PR state into engineering PASS/FAIL or merge readiness.

## Draft PR creation

The only V3.7 PR mutation is explicit Draft PR creation.

Input:

- explicit non-empty `title`;
- explicit `baseRef` selected from server-provided GitHub facts;
- `body` as an explicit string (empty is allowed).

The server supplies the exact head branch from `ProjectContext`; the browser cannot submit a different head.
The server forces Draft mode. There is no `draft=false` input.

Before creation the server re-loads `ProjectContext`, re-runs remote-head reconciliation, and checks for an existing open PR for the exact head/base pair. An existing PR is returned as a conflict and is never duplicated or mutated.

Equivalent mutation shape:

`gh pr create --draft --repo <exact repo> --head <ProjectContext.branch> --base <explicit baseRef> --title <title> --body <body>`

## CI fact model

Exact-head CI facts are read from GitHub check runs for the exact `ProjectContext.repository.head` commit.

Each check is transported without semantic rewriting:

- check name / id;
- `head_sha`;
- GitHub `status`;
- GitHub `conclusion` when present;
- details URL when present.

Only checks whose `head_sha` exactly equals the current ProjectContext HEAD belong to the V3.7 exact-head projection.
AICC must not expose a derived `mergeReady`, `approved`, `PASS`, or `safeToMerge` field.

## Minimal API contract

`GET /api/pr-delivery` -> GitHub readiness, exact repository facts, default branch, local/remote head reconciliation, existing open PRs for the exact head branch, and exact-head check runs.

`POST /api/prs/draft` -> create exactly one Draft PR from current ProjectContext head using explicit `title`, `body`, and `baseRef` after all reconciliation checks pass.

There is no generic PR mutation endpoint in V3.7.

## Fail-closed errors

`GITHUB_NOT_READY`
`GITHUB_AUTH_UNAVAILABLE`
`GITHUB_REPOSITORY_MISMATCH`
`GITHUB_ORIGIN_MISMATCH`
`PR_LOCAL_WORKTREE_DIRTY`
`PR_HEAD_IS_DEFAULT_BRANCH`
`PR_REMOTE_HEAD_NOT_FOUND`
`PR_REMOTE_HEAD_MISMATCH`
`PR_BASE_NOT_FOUND`
`PR_BASE_EQUALS_HEAD`
`PR_ALREADY_EXISTS`
`PR_INPUT_INVALID`
`PR_CREATE_FAILED`
`CI_FACTS_UNAVAILABLE`

These are transport/integrity errors only; none is an engineering PASS/FAIL judgment.

## UI boundary

The minimal V3.7 UI may display repository/default branch, local HEAD, remote HEAD, exact-head check rows, and existing PR facts.
It may expose one explicit `Create Draft PR` form only when server facts show the transport prerequisites.
It must not render merge, ready, close, edit, approve, release, or deploy controls.

## Acceptance gate

Implementation must prove repository identity matching, remote-head exactness, dirty-worktree refusal, exact-head CI facts, exact-head existing PR lookup, Draft-only creation, duplicate refusal, no credential exposure, and absence of merge/close/edit endpoints before Owner UAT.
