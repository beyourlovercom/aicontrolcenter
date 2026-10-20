# Work Package — AICC Global Fast Iteration V1

Work-Package-ID: `AICC-GLOBAL-FAST-ITERATION-V1-001`
Authority-Base: `581ff4300d401e2d7baa6d490d01b91fb7b212ef`
Status: `DRAFT_POLICY_REVIEW`
Owner-Approval: `2026-10-20 — Draft PR preparation only; no merge or runtime update`
Repository: `beyourlovercom/aicontrolcenter`

## Problem to solve

Small Dev-only WordPress display tasks (e.g. an Order discount-code column) were repeatedly subject to lengthy project-level development/verification estimates although a CI-checked disposable ZIP and a fast manual Dev Owner UAT gave clear feedback. Owner requires an account-wide *governed* faster iteration loop where fixes are quickly revised, infeasible attempts stopped, and PASS moves to clean canonical integration.

## Phase 1 — governance definition (this Draft PR)

- [x] Write one canonical policy in `docs/00_Governance`.
- [x] Reference it conditionally in AICC root `AGENTS.md`, keeping executor and UI preview hierarchy.
- [x] Add independent low-cost policy-contract verification script and CI.
- [ ] Review new policy against Executor Governance V2 and Global UI Preview First V1.
- [ ] Verify exact-head CI with no blockers; record PR evidence.
- [ ] Obtain a **separate** Owner exact-head GitHub main merge approval.

No AICC runtime service, existing user prompt, Bridge request/result, host device or external project is changed by Phase 1.

## Phase 2 — AICC runtime inheritance (separate work package and Owner gate)

- [ ] Integrate canonical policy fetch at exact GitHub main SHA with V4 `v4/lib/gpt-context.mjs` and `v4/lib/ui-preview-policy.mjs` mechanism, preserving existing fail-closed UI policy.
- [ ] Integrate at verified exact main SHA with existing V5/V3 Next-Step policy path (`v3/lib/ui-preview-policy-runtime.mjs`), before Next-Step intent/request finalization.
- [ ] Include new policy ID, source path, main SHA, file SHA/hash and bounded GPT instruction, and reject new context construction when required policy is absent/invalid.
- [ ] Test context formatting and failure paths in `v4/tests/gpt-context.test.mjs` and `v3/tests/ui-preview-policy-runtime.test.mjs` plus Next-Step safety tests.
- [ ] Independently review exact deployed V5 worktree/runtime before any live service rollout. No device/browser restart merely to apply a governance document.

## Phase 3 — project inheritance (separate owner-scoped rollout)

- [ ] Add canonical references (not forked policy copies) to relevant business repos' `AGENTS.md` as independently approved.
- [ ] Confirm Project-specific Dev/Local flows and functional/native-first gates are preserved.
- [ ] Owner handles ChatGPT custom instruction setting if desired; GitHub cannot mutate standalone ChatGPT configuration.
- [ ] Validate downstream projects actually receive the policy before claiming it is globally live.

## Acceptance and stopping rules

No change to provider routing or execution permission. Fast iteration is a risk-classified feedback loop, **not** a replacement for UI prototype gates, functional UAT, exact-head merge, signed release or Production/write authorization.

Evidence states may be reported as SOURCE_READY, FOCUSED_CHECKS_PASS, DEV_UAT_PENDING, OWNER_PASS and MERGE_GATE_PENDING only when actually supported.

**Phase 1 closure is Draft PR review + verified checks + Owner merge gate, not deployed activation.**
