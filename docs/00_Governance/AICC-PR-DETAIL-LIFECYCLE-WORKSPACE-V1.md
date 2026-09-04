# AICC PR Detail / Lifecycle Workspace V1

`AICC_DECISION_AUTHORITY = 0`

## Scope

This contract governs only the center PR Detail / Lifecycle Workspace. The
Owner-UAT-approved left PR Navigation, PR Snapshot refresh model, PR-to-WP
mapping, PR Root Workspace selection, Bridge, and right Inspector remain frozen.

The center owns PR identity, detailed lifecycle, current action, factual PR
overview, Evidence, Diff, Review, CI, Merge, and the existing 运行 / UAT
surfaces.

The existing center tabs remain exactly:

`运行 | UAT | 概览 | 证据 | Diff | Review | CI | Merge`

## Identity and state

The header presents PR number/title, factual PR state, repository, Parent WP,
and URL as separate readable fields. `PR State` remains factual:

`DRAFT | OPEN | MERGED | CLOSED`

Owner lifecycle remains separate:

`IN_PROGRESS | BLOCKED | COMPLETE`

For example, an open PR may be `PR State = OPEN` and `Lifecycle Status =
IN_PROGRESS`. A remote PR identity binding is a fact under identity evidence,
not a Current Action.

## Lifecycle gates

The canonical gates are preserved and are not replaced by percentage progress:

1. `DELIVERY_READY / 交付准备`
2. `COMMIT`
3. `PUSH`
4. `DRAFT_PR`
5. `EXACT_HEAD_CI`
6. `READY_TO_MERGE`
7. `MERGE_AND_VERIFY`

Each gate may display only evidence-grounded `COMPLETE`, `CURRENT`, `BLOCKED`,
`PENDING`, `NOT_APPLICABLE`, or `UNPROVEN`, presented as `已完成`, `当前`,
`阻塞`, `待执行`, `不适用`, or `未证明`.

`NO EVIDENCE != NOT_APPLICABLE`. `NOT_APPLICABLE` requires an explicit
canonical/factual declaration. Missing, stale, unavailable, or unbound
evidence is `UNPROVEN` unless an explicit fact establishes another state.

`BLOCKED` requires explicit blocker evidence. `UNMAPPED`, `UNPROVEN`, or
missing evidence alone never becomes `BLOCKED`.

For an existing real PR, local binding gaps do not erase historical
prerequisite evidence or turn those gates into `NOT_APPLICABLE`. The workspace
uses available GitHub, local, and canonical evidence without reconstructing
history heuristically.

## Current Action

Current Action describes an actual current or next lifecycle action when that
action is factually established, such as `等待 Exact-head CI`, `等待 Review`,
`准备 Merge`, or `Merge 被阻塞`. The identity statement `当前 PR 已绑定真实
远端身份` belongs under factual identity evidence. If no action is established,
the workspace displays `当前操作 = 未证明`.

## Factual overview

The overview preserves available factual rows for PR identity, title, source,
Parent WP, PR State, repository, source branch, delivery branch, PR HEAD,
latest commit, mergeability, and merge result. Technical values such as
`NOT_BOUND` and `NOT_RUN` may remain in evidence/debug surfaces, while normal
UI presents their meaning as `未绑定` and `未运行`.

Merged behavior is factual: `PR State = MERGED`, `Lifecycle Status = COMPLETE`,
and `Merge / Verify = 已完成`. Parent WP mapping is not required for merged
completion.

## Judgment-free projection

AICC remains a factual/read-model projection layer. It does not generate
governance PASS/FAIL conclusions. Detailed gate states come only from canonical
facts, evidence, or existing execution result semantics.
