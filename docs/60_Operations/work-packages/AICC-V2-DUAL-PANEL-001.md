# AICC-V2-DUAL-PANEL-001: WP / PR Dual Panel

Work Package ID: `AICC-V2-DUAL-PANEL-001`
Status: `READY_FOR_OWNER_AUTHORIZATION`
Formalization: `FORMAL_READY`
Type: `DUAL_PANEL_UI_AND_READ_MODEL_INTEGRATION`

## Authority

UI / Product Authority: `AICC Roadmap + WP/PR Dual Panel & Workflow Status System v1.0`

Frozen Architecture Authority: `AICC Entity Context Foundation`
Frozen Architecture HEAD: `9ebde86f019b831d41158fe38e3be7078bd02e53`

The following remain frozen and must not be redesigned:

- `AiccProjectSnapshot`
- `SelectedEntity`
- `ResolvedEntityContext`
- Entity Context Resolver
- WP Lifecycle Resolver
- Authorization Resolver
- Action Eligibility Resolver
- Entity View Dispatch

## Goal

Implement two distinct control surfaces on the shared AICC three-column shell:

1. Work Package Panel
2. Pull Request Panel

Selection remains entity-driven:

- Milestone → Milestone Overview
- Work Package → WP Center Panel and WP Right Evidence Panel
- Pull Request → PR Center Panel and PR Right Evidence Panel

## Work Package Panel Scope

The selected Work Package view must preserve:

- Entity Header
- Owner Action Zone
- persistent Action Feedback Bar
- WP 9-stage Workflow
- WP status Tabs: `概览`, `流程`, `工作包`, `运行`, `验证`, `UAT`, `证据`
- current stage detail
- Work Package detail

The WP right evidence panel remains read-only and must show truthful, context-matched:

- Repository
- Owner Authorization
- Codex Runtime
- Writer Lock
- Validation
- Human UAT
- Related PRs
- formal evidence summary

All values must come from the resolved selected Work Package entity context.

## Pull Request Panel Scope

The selected Pull Request view must contain:

- `[PR]` Entity Header
- parent Work Package
- PR status
- PR Action Zone
- PR 7-stage Workflow
- PR tabs: `概览`, `流程`, `Diff`, `Review`, `CI`, `Merge`, `证据`
- PR detail

The PR right evidence panel is read-only and may show, when available:

- GitHub PR identity and URL
- Parent WP
- Source Branch and Target Branch
- PR HEAD
- Commit evidence
- Review evidence
- Exact-head CI
- Files changed
- Mergeability
- Merge result
- Main verification

The PR workflow stages are:

1. `DELIVERY_READY`
2. `COMMIT`
3. `PUSH`
4. `DRAFT_PR`
5. `EXACT_HEAD_CI`
6. `READY_TO_MERGE`
7. `MERGE_AND_VERIFY`

## Local PR UAT Fixture Boundary

A real production PR must not be fabricated. A local-development-only fixture may be added by the implementation Work Package solely for visual UAT and must be clearly labeled:

- `DEMO`
- `LOCAL FIXTURE`

The fixture must never be treated as GitHub evidence, persisted to the production Roadmap source, used by mutation endpoints, or written into Git history as a real PR. It must not push, merge, or change GitHub state.

## Entity Context and Status Boundaries

Pull Requests must use the existing pipeline:

`SelectedEntity(type = pull_request) → resolveEntityContext() → PR Header / Workflow / Tabs / Actions / Right Panel`

No second PR-specific selection authority is allowed.

PR and WP state machines remain independent. `PR MERGED` does not imply `WP COMPLETE`.

All mutation actions remain in the center Action Zone. The right panel remains read-only. Unavailable actions must be shown truthfully as unavailable or `NOT_IMPLEMENTED`.

## Allowed

- inspect the frozen AICC V2 Entity Context Foundation
- implement the WP / PR Dual Panel UI and read-model integration after explicit Owner authorization
- add focused unit, integration, responsive, and real-browser tests
- add an isolated local-only PR visual UAT fixture within this Work Package scope
- update only files necessary for Dual Panel implementation and its focused evidence

## Forbidden

- OpenSpec
- OpenCode
- OmO
- Tauri
- PR Runner backend
- automatic commit
- automatic push
- real Draft PR creation
- automatic merge
- production deployment
- fabricated production PR evidence
- arbitrary shell endpoints
- destructive Git operations
- force push
- secrets changes
- unrelated architecture expansion
- redesigning the approved AICC Shell or reopening Entity Context Foundation

## Acceptance Criteria

- WP Panel and WP Right Evidence Panel remain functional.
- PR Panel and PR Right Evidence Panel are driven by `ResolvedEntityContext`.
- WP / PR selection switching has zero cross-entity context leakage.
- PR 7-stage Workflow passes without regressing the WP 9-stage Workflow.
- WP and PR tabs remain independent and functional.
- Local PR fixture isolation is explicit and production PR evidence remains absent.
- `PR MERGED` and `WP COMPLETE` remain independent states.
- Desktop and mobile WP / PR views remain usable.
- Matching authorization and runtime evidence remain isolated by entity context.
- The implementation does not add PR delivery automation.

## Dependencies

- `AICC-V2-UI-WORKFLOW-001` Owner UI UAT = `PASS`; Status = `COMPLETE`.
- AICC Entity Context Foundation = `APPROVED_BASELINE` at HEAD `9ebde86f019b831d41158fe38e3be7078bd02e53`.
- Explicit Owner authorization is required before execution.
- Repository, worktree, authorization, and runtime safety gates must pass.

## Owner Authorization Boundary

This document formalizes the Work Package only. It does not authorize execution. Codex start remains blocked until the Owner creates a valid authorization for this Work Package and all independent safety gates pass.

