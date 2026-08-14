# AICC-V2-PR-RUNNER-001: AICC PR Runner Foundation

Status: `CLOSED / HUMAN_UAT_PASS`
Authorization: `OWNER_AUTHORIZED / UAT_COMPLETE`
Bootstrap: `FIRST_SELF_DEVELOPMENT_WORK_PACKAGE`
MILESTONE: `M4 CLOSED`
PR_OWNER: `WORK_PACKAGE`
PR_ENTITY_IDENTITY: `REPOSITORY + PR_NUMBER`
WP_TO_PR_CARDINALITY: `ONE_TO_MANY`
PR_TO_WP_CARDINALITY: `MANY_TO_ONE`

## Goal

After the AICC V2 First Usable Version passes Owner Human UAT, allow Codex to develop the first bounded PR Runner capability for AICC itself.

## Scope

- Inspect the current AICC V2 implementation.
- Implement the PR Runner foundation only after explicit Owner authorization.
- Prepare reviewed local changes for GitHub delivery.
- Establish a bounded PR workflow.
- Preserve exact Work Package, branch, and HEAD evidence.
- Add focused tests.
- Update only files necessary for PR Runner.

## Allowed

- Implement PR Runner foundation within this Work Package after Owner authorization.
- Add focused tests and documentation required by the foundation.
- Prepare, inspect, and report reviewed local changes for later GitHub delivery.

## Forbidden

- OpenCode
- OmO
- OpenSpec
- Tauri
- Production deploy
- Destructive Git operations
- Force push
- Automatic merge
- Secrets changes
- Arbitrary shell endpoint
- Unrelated architecture expansion

The first PR Runner implementation must not automatically merge anything.

## Acceptance Criteria

- Owner authorization is explicit and evidence-bound.
- The implementation is limited to PR Runner foundation scope.
- Local changes remain reviewable before any future delivery action.
- No automatic merge, force push, deploy, or secret mutation is introduced.
- Focused tests cover the bounded workflow and forbidden operations.
- Work Package, branch, and HEAD evidence are preserved and displayed truthfully.

## Dependencies

- `AICC-V2-004` Codex Runtime Control = `PASS`.
- `AICC-V2-005-R1` Work Package Contract Binding Remediation = `PASS`.
- Explicit Owner authorization is required before execution.
- Repository and runtime safety gates must pass.

## Bootstrap Semantics

AICC-V2-PR-RUNNER-001 is the first self-development Work Package. Its first real bounded implementation by Codex, started by AICC after explicit Owner authorization, is the Human UAT evidence used to establish `AICC_SELF_DEVELOPMENT_READY = PASS`.

Therefore this Work Package MUST NOT require `AICC_SELF_DEVELOPMENT_READY` as a prerequisite.

## Risks

- Delivery automation must remain separately authorized and reviewable.
- GitHub, CI, merge, and deploy capabilities are outside this foundation.

## Canonical M4 foundation contract

This Work Package is the canonical PR read model and scoped PR workspace. PR
facts come from the single local external-facts source when available; missing
remote facts remain `UNKNOWN` and are never fabricated.

- `PR_FOUNDATION_SOURCE_OF_TRUTH_COUNT = 1`
- `PR_FAKE_STATE_COUNT = 0`
- `CROSS_WP_PR_LEAKAGE = 0`
- `AICC_WORKTREE_GATE = 0`
- `AICC_WORKTREE_PROVENANCE_GATE = 0`
- `AICC_REASONS_ABOUT_WORKTREE_SAFETY = 0`
- `AICC_PROJECTS_WORKTREE_FACTS = 1`
- `ROADMAP_PR_ENTITY_VISIBLE = 1`
- `PR_ROADMAP_PARENT = WORK_PACKAGE`
- `PR_WORKSPACE_PRESENT = 1`
- `PR_DETAIL_SCOPE = STRICT`
- `PR_DETAIL_SHOWS_FOREIGN_PR_DATA = 0`
- `OWNER_CREATE_DRAFT_PR_AVAILABLE = 1`
- `AUTO_CREATE_PR = 0`
- `PR_CREATION_EXECUTION_OWNER = CODEX`
- `SECOND_GIT_REASONING_AUTHORITY = 0`
- `ONE_CREATE_REQUEST_CREATES_MAX_PR = 1`
- `POLLING_CREATES_PR = 0`
- `PAGE_REFRESH_CREATES_PR = 0`
- `RECONNECT_CREATES_PR = 0`
- `PR_STATE_SOURCE = ACTUAL_PR_FACTS`
- `LOCAL_GIT_IMPLIES_REMOTE_PR_STATE = 0`
- `M4_CI_AUTHORITY_COUNT = 0`
- `M4_REVIEW_AUTHORITY_COUNT = 0`
- `AUTO_PR_DELIVERY = 0`
- `AUTO_PR_MERGE = 0`
- `AUTO_PR_CLOSE = 0`
- `PR_CREATED_IMPLIES_WP_CLOSED = 0`
- `PR_MERGED_IMPLIES_WP_CLOSED = 0`
- `WP_PR_SCOPE_ISOLATION = PASS`
- `ONE_REPOSITORY_MANY_PARALLEL_PRS = PASS`
- `REPOSITORY_GLOBAL_PR_LOCK = 0`
- `PR_STATUS_UPDATE_REQUIRES_SERVICE_RESTART = 0`
- `GLOBAL_TASK_PR_AUTHORITY = 0`

## Owner Human UAT Plan (5 items)

This is a WP-owned plan. It is not a global checklist and does not preselect
any Owner result.

- HUA-PR-01 | PR entity | Confirm a correlated PR is nested below its owning WP | PR appears under exactly that WP and not another WP
- HUA-PR-02 | PR workspace | Select a PR from the Roadmap | Only the selected PR facts, parent WP and correlated evidence are shown
- HUA-PR-03 | PR facts | Inspect PR number, URL, base branch, head branch and head SHA | Values match observed PR facts; unknown values remain unknown
- HUA-PR-04 | Draft PR action | Click 创建 Draft PR once, then refresh/reconnect | AICC starts at most one Codex creation request and does not create automatically
- HUA-PR-05 | PR isolation | Select another WP after a PR is observed | The first WP's PR is absent unless formally correlated to the selected WP

`PR_RUNNER_UAT_PLAN_IS_WP_SPECIFIC = 1`
`GLOBAL_GENERIC_UAT_CHECKLIST_USED = 0`

## Final remediation evidence

The final PR Workspace + Global PR Roadmap Projection remediation completed with machine validation PASS.

```text
M4_FINAL_PR_WORKSPACE_ROADMAP_REMEDIATION = PASS
PR_WORKSPACE_HAS_SOURCE_BRANCH = YES
PR_WORKSPACE_HAS_DELIVERY_BRANCH = YES
SOURCE_AND_DELIVERY_BRANCH_SEPARATED = PASS
RECONNECT_PRESERVES_DELIVERY_BRANCH = PASS
GLOBAL_PR_NAV_VISIBLE = YES
GLOBAL_PR_WORKSPACE_VISIBLE = YES
TOTAL_REPOSITORY_PRS_PROJECTED = 8
MAPPED_PRS = 8
UNMAPPED_PRS = 0
PR_8_GLOBAL_VISIBLE = YES
PR_8_WP_VISIBLE = YES
PR_8_OWNER = AICC-V2-PR-RUNNER-001
PR_8_IDENTITY = beyourlovercom/aicontrolcenter#8
WP_ONE_TO_MANY_PR_RENDERING = PASS
GLOBAL_PR_HISTORY_VISIBLE = PASS
FUTURE_PR_AUTO_PROJECTION = PASS
GLOBAL_PR_DUPLICATE_ROWS_AFTER_RECONNECT = 0
WP_PR_DUPLICATE_ROWS_AFTER_RECONNECT = 0
HISTORICAL_MERGED_PRS_PRESERVED = PASS
HISTORICAL_CLOSED_PRS_PRESERVED = PASS
FAILED_CANARY_PRS_PRESERVED = PASS
EXACTLY_ONCE_REGRESSION = PASS
FOREIGN_WP_PR_LEAKAGE = 0
PR_IDENTITY_MODEL = REPOSITORY_PLUS_PR_NUMBER
CODEX_REMAINS_GIT_PR_REASONING_OWNER = PASS
AICC_SECOND_GIT_REASONING_ENGINE = NO
TEST = PASS
BUILD = PASS
TYPESCRIPT = PASS
GIT_DIFF_CHECK = PASS
```

## Final real PR Canary / Owner UAT

Owner completed the final real Canary PR UAT and explicitly reported all checks PASS.
The Canary validated a newly created real GitHub PR through the global PR workspace,
correct Work Package projection, repository-plus-PR-number identity, source/delivery
branch separation, reconnect idempotency, no cross-WP leakage, branch advance without
identity drift, and preservation of the closed PR in history.

```text
M4_FINAL_REAL_PR_CANARY_UAT = PASS
GLOBAL_PR_VISIBLE = YES
WP_PR_VISIBLE = YES
REPOSITORY_IDENTITY = PASS
SOURCE_AND_DELIVERY_BRANCH_SEPARATED = PASS
SOURCE_BRANCH_ADVANCE_PRESERVES_PR_IDENTITY = PASS
PR_HEAD_REFRESH = PASS
GLOBAL_PR_DUPLICATE_ROWS_AFTER_RECONNECT = 0
WP_PR_DUPLICATE_ROWS_AFTER_RECONNECT = 0
FOREIGN_WP_PR_LEAKAGE = 0
CLOSED_PR_HISTORY_PRESERVED = PASS
M4_OWNER_UAT = PASS
M4_STATUS = CLOSED
```

## Closure

`IMPLEMENTATION = PASS`
`MACHINE_VALIDATION = PASS`
`OWNER_HUMAN_UAT = PASS`
`M4_PR_RUNNER_FOUNDATION = APPROVED_BASELINE`
`WORK_PACKAGE_STATUS = CLOSED`
`MILESTONE_STATUS = CLOSED`
`NEXT_MAINLINE = M4.1 — GPT ↔ AICC ↔ Codex Closed Loop`

M4 does not implement Review, exact-head CI authority, autonomous delivery,
approval, merge, or automatic closure. Those remain subsequent Roadmap scope.
