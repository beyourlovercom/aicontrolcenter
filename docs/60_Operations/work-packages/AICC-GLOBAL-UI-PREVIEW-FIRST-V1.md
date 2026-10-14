# Work Package: AICC-GLOBAL-UI-PREVIEW-FIRST-V1

Status: `IMPLEMENTATION / DRAFT PR / OWNER MERGE GATE`
Owner authorization: 2026-10-14 — "批准建立 AICC 全局交互预览规则 V1".
Repository authority: `beyourlovercom/aicontrolcenter`.
Base main SHA: `b7302620a054c7264f23606aef340533f108ae5a`.

## Goal

Create a canonical cross-project, preview-first UX governance rule for GPT → AICC tasks. Provide the rule automatically in V4's Copy GPT Context, not by mutating existing Bridge message payloads or post-processing agent Results.

## Included

- Global canonical policy under `docs/00_Governance/`.
- Root `AGENTS.md` and V4 `AGENTS.md` inheritance.
- V4 read-only GitHub-pinned policy loader, with exact HEAD SHA, bounded content and explicit fail-closed errors.
- V4 GPT Context copy includes full actionable preview instruction and provenance for every registered project.
- Regression tests for the policy, API, compatibility, exclusion cases, and permissions.
- Draft PR + CI, with separate merge/deploy/Owner Visual UAT gates.

## Explicit non-goals

- No AICC or website Production deployment.
- No repository main merge or auto-Ready-for-Review.
- No device restart, browser restart, credentials or network changes.
- No Project Registry schema changes or project-specific duplicate rule copies.
- No AICC classification, automatic task launch, authorization, Visual PASS, PR merge, data writes, or Browser Bridge Result rewrite.
- No claim that external ChatGPT sessions inherit rules without receiving AICC GPT Context.

## Acceptance criteria

- [ ] Canonical source and inheritance tests pass.
- [ ] GPT Context contains a verified global rule for any registered project.
- [ ] Missing or invalid canonical GitHub policy yields a clear context error.
- [ ] Existing dashboard APIs remain read-only; copy helper still uses existing transport.
- [ ] GPT—not AICC—classifies changes; preview is interactive and Owner-accepted before material UI implementation unless Owner explicitly waives.
- [ ] Visual PASS and functional/merge/deploy approvals are different gates.
- [ ] Exact-head CI verified and review evidence included in Draft PR.
- [ ] Separate Owner authorization before main merge and AICC Production update.

## Owner acceptance

The User-facing cue should be **“交互渲染预览，先让我 PASS”**. It means render a real operable prototype in the conversation when supported, using clearly labeled mock data as needed, before implementing the material UI design. AICC Copy GPT Context inherits the canonical GitHub rule; direct standalone conversations still need their own explicit instructions or connected AICC context.
