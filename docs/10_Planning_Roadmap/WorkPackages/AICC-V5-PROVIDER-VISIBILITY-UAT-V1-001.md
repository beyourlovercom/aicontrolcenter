# AICC-V5-PROVIDER-VISIBILITY-UAT-V1-001

## Work Package: Provider Visibility — Right Panel UAT

**Branch:** fix/aicc-v5-provider-visibility-uat-v1  
**Status:** IMPLEMENTATION COMPLETE — LOCAL CI EQUIVALENT PASS

---

## Problem Statement

The Owner-facing right execution panel hard-coded "Codex" as if it were the only executor.
A human scanning the panel could not tell which provider was actually selected/running, and
had to interpret Codex-only diagnostics even when a different provider was routed.

---

## Changes

### `src/lib/providerPresentation.ts` (new)
Pure helper with zero Svelte dependency.

- `resolveProviderDecision(decision)` — reads `provider` and `providerRoutingReason` from
  a `NextStepProjection.state.decision` record.
- Returns a typed `ProviderDecision | null`. Returns `null` if provider is absent or not a
  recognized value (`CLAUDE_CODE` | `CODEX`). Never infers provider from readiness alone.

### `src/lib/providerPresentation.test.ts` (new)
Focused Node contract test covering null/unknown input, both known providers, trimmed routing reason,
blank/non-string routing reason, and the no-inference invariant. The test is wired into the existing root `npm test` chain; no new test dependency is introduced.

### `src/App.svelte`
- Imports `resolveProviderDecision`.
- Adds reactive `$: activeProviderDecision` derived from `activeNextStep?.state.decision`.
- Right panel: inserts a green-tinted **provider-card** block above the fact-stack showing:
  - **当前执行器** — `Claude Code` or `Codex` when a structured decision exists; `尚未路由` otherwise.
  - **路由原因** — shown only when `providerRoutingReason` is present in the decision.
- Keeps readiness truth separate from selection:
  - Existing executor facts remain explicitly labeled **Codex 就绪 / Codex 诊断** because that source is the Codex runtime.
  - The prominent provider card is the only selected-provider presentation and never derives selection from readiness.
  - Adds **当前状态** from the exact Next-Step projection so Owner can read routing progress without interpreting diagnostics.
- No routing semantics, Bridge protocol, executor logic, or persistence changed.

### `src/lib/nextStep.ts`
- `EXECUTION_QUEUED` status label: `"Codex 已进入 managed execution"` → `"执行器已进入 managed execution"`.

### `src/app.css`
- Added `.provider-card`, `.provider-card-row`, `.provider-label`, `.provider-value` —
  green-tinted card in PingFang/Starbucks visual language matching existing palette.

---

## UAT Acceptance Criteria

| # | Scenario | Expected |
|---|----------|----------|
| 1 | No Next-Step submitted yet | 当前执行器 row shows `尚未路由` |
| 2 | Next-Step state.decision has `provider: "CLAUDE_CODE"` | Row shows `Claude Code` |
| 3 | Next-Step state.decision has `provider: "CODEX"` | Row shows `Codex` |
| 4 | Decision has `providerRoutingReason: "OWNER_PREFERENCE"` | 路由原因 row shows `OWNER_PREFERENCE` |
| 5 | Decision has no `providerRoutingReason` | 路由原因 row not rendered |
| 6 | Executor readiness row no longer says "Codex" | Row reads `Remote Claude 就绪` |
| 7 | Multi-room switch | Provider card refreshes per-room with no cross-room bleed |

---

## Non-Goals

- No change to routing logic, Bridge protocol, or backend APIs.
- No change to PR #36 multi-room polling behavior (`aicc-v55-refresh-facts` event, per-room
  `roomExecutorFacts` / `factsRefreshInFlight` isolation).

---

## Validation

- Provider presentation contract: PASS.
- TypeScript: PASS.
- Root test chain: PASS.
- Production build: PASS.
- OpenSpec strict validation: 7/7 PASS.
- V3 full tests: 148/148 PASS.
- Secret / absolute-path / legacy-boundary scans: PASS.
- `git diff --check`: PASS.
- `src-tauri` tree unchanged from base; no Rust implementation changed in this WP.

## Human UAT

Owner only needs to verify the prominent right-panel card after one Next-Step action: **当前执行器**, **路由原因**, and **当前状态**.
