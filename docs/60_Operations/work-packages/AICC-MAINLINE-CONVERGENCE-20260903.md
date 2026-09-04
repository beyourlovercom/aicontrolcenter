# AICC-MAINLINE-CONVERGENCE-20260903 — Mainline Canonical Convergence

Work Package ID: `AICC-MAINLINE-CONVERGENCE-20260903`
Project: `AICC V2`
Status: `ACTIVE / OWNER_AUTHORIZED`
Authorized: `2026-09-03`
Authorization evidence: Owner explicitly approved the proposed mainline convergence with “好，推进”.
Branch: `converge/aicc-mainline-20260903`
Worktree: `<AICC_WORKTREES>/aicc-mainline-convergence-20260903` (Owner-selected local machine)

## Goal

Reconcile the newer AICC development line, the historical GitHub `main` line,
Owner-approved local governance, formal Work Package records, Roadmap projection,
and GitHub PR/CI evidence without adding new product behavior.

## In Scope

1. Preserve the China-Mac dirty governance work without reset/stash/clean.
2. Rebase is forbidden; converge history by an explicit feature-branch merge.
3. Preserve the newer M8 Roadmap authority while retaining M11/M11.5 as historical evidence.
4. Freeze the Owner-approved GPT + Desktop Commander local-first Constitution v1.3 update.
5. Repair the missing formal file for `AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1`.
6. Record observed implementation/test evidence without inventing Human UAT or round closure.
7. Regenerate/validate Roadmap read-model evidence where supported by repository tooling.
8. Push this convergence branch and create/update one Draft PR against `main`.
9. Inspect exact-head GitHub CI/check evidence; do not infer PASS when no run exists.
10. Repair only CI-blocking historical fixtures/assertions whose mismatch is proven against the current canonical contract, and minimally fix any real regression exposed by convergence validation.

## Explicitly Out of Scope

- New AICC product features.
- Changing `AICC_DECISION_AUTHORITY = 0` or pass-through runtime semantics.
- Broad repository stale-test cleanup unrelated to establishing a truthful exact-head CI baseline; that remains M8.6 backlog.
- Closing M8.3 merely from commit-message PASS tags.
- Human Owner UAT.
- PR merge, production deployment, tag, or release.
- Reset, rebase, force-push, clean, or destructive worktree normalization.

## Reconciled Inputs

- GitHub `main` snapshot before convergence: `33a0abc37cd607c12d7972fce455723ac6d5a378`.
- Newer pushed development baseline: `b1edcd3988355de1feade0fe1dc4abf71c5b4323`.
- Historical merge base: `f1da9dc3fcbd6c17caf8a5db0fafb42513dbc32e`.
- Owner-approved local governance v1.3 was preserved from the original dirty worktree into this isolated convergence worktree.

## Acceptance Criteria

- `origin/main` is an ancestor of the convergence head.
- `origin/dev/aicc-external-project-loading-v1` is an ancestor of the convergence head.
- Original China-Mac dirty worktree remains intact.
- Constitution/Registry/AGENTS v1.3 alignment passes `git diff --check` and authority-marker checks.
- Current Roadmap remains M8; M11/M11.5 cannot regain current authority through merge history.
- `AICC_GLOBAL_CANONICAL_LIFECYCLE_PROJECTION_V1` has a formal WP file.
- Any stale test encountered is classified with exact production-history evidence rather than silently weakened.
- Draft PR exists with exact convergence head and current CI/check evidence recorded.

## Current Evidence

- Governance preservation commit: `2df6fcc`.
- Historical-main convergence merge: `26113a2`.
- Merge ancestry: `MAIN_IS_ANCESTOR = YES`, `DEV_IS_ANCESTOR = YES`.
- Targeted M8.3 checks observed on the clean US-Mac development baseline:
  - `globalStateReadModel.test.ts` = PASS.
  - `runtimeResultFeedbackControlLoopProjection.test.ts` = PASS.
  - `uiLifecycleConsumerProjection.test.ts` = PASS.
- Convergence validation exposed and minimally repaired real contract regressions in control-loop unbind fail-closed ordering, project-scoped execution-result lookup ordering, and WP → PR Layer-2 correlation.
- CI-blocking historical tests/fixtures were reconciled only where current production/governance evidence proved the old assertion stale; removed Probe, old result-authority, old unscoped context, and obsolete UI-structure contracts were not restored.
- Current local evidence on the convergence worktree:
  - absolute-local-path CI scan = PASS (Project Registry retains one explicit runtime-path exception);
  - `npx tsc --noEmit` = PASS;
  - `npm run build` = PASS;
  - `npm run posttest` = PASS;
  - `npm test` reaches `runtimeSupervisor.integration.test.ts` with every preceding pretest/main-test case PASS;
  - China Mac Node `26.7.0` + `node-pty@1.1.0` cannot spawn even `/bin/echo` (`posix_spawnp failed`), while repository GitHub CI is pinned to Node 22. Therefore the supervisor integration result is reserved for exact-head GitHub Node-22 CI rather than being misclassified as a product regression.
- GitHub CI Run #64 on Node `22.23.2` passed OpenSpec, secret scan, absolute-path scan, and Typecheck, then exposed a platform-specific stale fixture in `localServiceRecovery.test.ts`: the test hard-coded a macOS repository path, while `sameCanonicalPath()` correctly fails closed for nonexistent paths on Ubuntu. The fixture now uses the real test repository `process.cwd()`; production canonical-path logic is unchanged.
- GitHub CI Run #65 passed through `localServiceRecovery.test.ts` and exposed the next CI-only fixture coupling: `taskWpRoadmapBindingNormalization.test.ts` called `controlService.readFormalWorkPackageRegistry()`, which intentionally targets the Owner-selected local repository path. The contract test now parses the already-loaded checkout Roadmap directly; local-service repository configuration is unchanged.
- GitHub CI Run #66 proved the remaining hidden coupling inside `parseExecutionV1()`: ownership normalization still obtained its formal-WP registry through the local-service filesystem. `parseExecutionV1()` now accepts an optional explicit formal registry for deterministic contract tests while production callers retain the existing default local-service registry behavior. Targeted Bridge/parser/control-loop tests, Typecheck, and full pretest pass locally.
- GitHub CI Run #67 passed full pretest and entered the main test chain, then failed because `phase3PurePassThrough.test.ts` read repository source files from a hard-coded China-Mac path. That guard now resolves the current checkout through `process.cwd()`; the same platform-neutral correction was applied to `authorityConvergenceGuard.test.ts`. Local `npm test` now reaches only the known China-Mac Node 26 `runtimeSupervisor.integration.test.ts` PTY failure, with every preceding case PASS.
- GitHub CI Run #68 passed the source-path guard but correctly rejected the tracked China-Mac Project Registry under the detached Ubuntu PR checkout. `phase3PurePassThrough.test.ts` now creates a temporary branched git repository plus isolated Project Registry for authority validation; production Project Registry path/branch/remote fail-closed rules are unchanged. The full local test chain still passes through Phase 3 and reaches only the known Node 26 PTY supervisor failure.
- GitHub CI Run #69 passed Project Registry validation but exposed a second local-runtime fixture dependency: `resolveCodexModel()` had no CI model catalog and threw `MODEL_UNAVAILABLE` before provider delivery. The Phase 3 contract now supplies an isolated temporary `CODEX_HOME` model catalog while hiding local Codex binaries, proving pass-through delivery reaches the runtime/provider boundary deterministically without requiring a developer machine Codex installation. Production model discovery is unchanged.

## Next Exact Gate

Commit and push the reconciled exact head to existing Draft PR #11, then use
GitHub Node-22 CI as the authority for the full suite including the PTY supervisor
integration. Remediate only exact-head failures with evidence. Stop before merge
or Owner UAT even after CI PASS.

Generated/updated: `2026-09-03T02:20:45-0700`
