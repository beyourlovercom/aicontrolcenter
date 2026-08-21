# AICC Executor Usage Log

> Obsidian-friendly human audit log for Claude execution efficiency and quota behavior.

## Experiment

- `EXPERIMENT_ID`: `AICC_CLAUDE_PROMO_ROUTING_2026-08-21_2026-08-31`
- `STATUS`: `ACTIVE`
- `START_DATE`: `2026-08-21`
- `PROMO_WINDOW_END`: `2026-08-31`
- `FINAL_ROUTING_REVIEW_DATE`: `2026-09-01`
- `EXECUTIONS_PER_CYCLE`: `5`
- `PRIMARY_SCOPE`: `CLAUDE_CODE`
- `MODEL_ASSIGNMENT_AUTHORITY`: `GPT_PLUS_WEB`
- `ANALYSIS_AUTHORITY`: `GPT`
- `IMPLEMENTATION_EXECUTOR`: `CLAUDE`

Purpose: measure real AICC workload efficiency, first-pass reliability, remediation rate, token usage, and actual Claude quota/session-limit events before choosing the post-2026-09-01 routing baseline.

## Temporary routing baseline

- **Tier 1 — Haiku 4.5**: audit, grep/search, classification, simple fixtures, mechanical/repetitive low-complexity work.
- **Tier 2A — Sonnet 4.6**: narrow/localized ordinary implementation with a clear plan and low integration/remediation risk.
- **Tier 2B Promo — Sonnet 5**: medium-complexity or multi-file work, contract-sensitive work, borderline Tier-2 work, elevated rework risk.
- **Tier 3 — Sonnet 5**: complex architecture implementation, difficult remediation, cross-module migration, hard-to-localize failure.
- Thinking defaults to **DISABLED**. GPT may authorize **ENABLED** for one named execution only.

## Measurement rules

Record actual telemetry only. If a value is unavailable, write `N/A`; never estimate missing token counts.

For every Claude execution record:

- timestamp and logical concern
- model / effort / requested thinking / actual thinking when observable
- fresh vs resumed session
- exact base SHA and result/checkpoint SHA
- outcome and substantive-failure count for that logical concern
- elapsed time and turns when observable
- input tokens, cache creation/write tokens, cache read tokens, output tokens, thinking tokens when exposed
- API-equivalent usage/cost when exposed
- actual quota/session-limit event: `YES` or `NO`
- blocker / retry / scope notes

Five consecutive Claude executions form one cycle. After execution 5, record the cycle summary. A daily review may flush a partial cycle without closing it.

`QUOTA_LIMIT_TRIGGERED_IN_CYCLE = YES` only when an actual quota/session-limit event occurs. HTTP 429/session quota is quota evidence but does not count as a substantive implementation failure.

Raw per-execution telemetry buffer on the US Mac:
`/Users/a/.aicc-remote/CLAUDE_USAGE_CYCLE_BUFFER.jsonl`

The governed human-readable record is this Markdown file. Raw buffer data is non-authoritative runtime evidence.

## Pre-experiment baseline — not counted in Cycle C001

Known historical telemetry before this experiment started:

| Sample | Model | Effort | Thinking | Elapsed | Turns | Cache read | Output | API-eq | Quota limit |
|---|---|---|---|---:|---:|---:|---:|---:|---|
| Batch3A R1 | Sonnet 4.6 | low | enabled/observed | 10.84 min | 68 | ~5.52M | ~36.7K | ~$2.85 | NO |
| Batch3A R2 | Sonnet 4.6 | low | enabled/observed | 5.58 min | 13 | ~0.386M | ~14.2K | ~$0.78 | YES — session limit/429 occurred in this R2 sequence |

These samples are context only. They are incomplete telemetry and must not be mixed into the five-run promotion cycles.

## Cycle C001 — COMPLETE

| # | Time (UTC) | Logical concern | Model | Effort | Think | Session | GPT review | Min | Turns | Input | Cache write | Cache read | Output | Think tok | API-eq | Quota |
|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 2026-08-21 15:18 | Batch3A R2 no-placeholder scope | Sonnet 5 | low | requested OFF / observed ON | fresh | FAIL — test coverage | 4.50 | 57 | 110 | 111079 | 4939221 | 25561 | 5291 | $2.5340 | NO |
| 2 | 2026-08-21 15:25 | Batch3A R2 test coverage | Haiku 4.5 | omit | OFF | fresh | FAIL — test authority | 3.04 | 62 | 308 | 74138 | 3768520 | 12341 | 0 | $0.5886 | NO |
| 3 | 2026-08-21 19:48 | Batch3A R2 Owner-approved test authority | Haiku 4.5 | low | OFF | fresh | PASS — Batch3A closed | 1.12 | 24 | 119 | 25759 | 716538 | 4461 | 0 | $0.1470 | NO |
| 4 | 2026-08-21 20:00 | Batch3B1 runtime/result scope | Sonnet 5 | low | OFF | fresh | FAIL — storage identity collision | 4.86 | 28 | 56 | 37778 | 2465120 | 10824 | 0 | $2.7378 | NO |
| 5 | 2026-08-21 20:08 | Batch3B1 scoped runtime storage | Sonnet 5 | low requested | OFF | fresh | FAIL — raw-ID ambiguity | 8.17 | 110 | 208 | 165869 | 10852331 | 41659 | 0 | $4.8780 | NO |

### Cycle C001 summary

- `EXECUTIONS_COMPLETED`: 5 / 5
- `MODEL_DISTRIBUTION`: Sonnet 5 = 3; Haiku 4.5 = 2; Sonnet 4.6 = 0
- `SUBSTANTIVE_FAILURES_IN_CYCLE`: 4
- `FIRST_PASS_LOGICAL_CLOSURES`: 0
- `REMEDIATION_ATTEMPTS`: 3
- `TOTAL_ELAPSED`: 21.68 min
- `TOTAL_INPUT_TOKENS`: 801
- `TOTAL_CACHE_WRITE_TOKENS`: 414623
- `TOTAL_CACHE_READ_TOKENS`: 22741730
- `TOTAL_OUTPUT_TOKENS`: 94846
- `TOTAL_THINKING_TOKENS`: 5291
- `TOTAL_API_EQUIVALENT`: $10.8853
- `QUOTA_LIMIT_TRIGGERED_IN_CYCLE`: NO
- `CYCLE_CONCLUSION`: No 5-hour quota event occurred. Sonnet 5 remained reliable for complex implementation but the broadest remediation (execution 5) produced 110 turns and 10.85M cache reads; tighter GPT decomposition is required. Haiku was efficient for narrow mechanical test remediation. Thinking-disable launcher was corrected after execution 1.

## Cycle C002 — ACTIVE

| # | Time (UTC) | Logical concern | Model | Effort | Think | Session | GPT review | Min | Turns | Input | Cache write | Cache read | Output | Think tok | API-eq | Quota |
|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 | 2026-08-21 20:12 | Batch3B1 raw runtime ID fail-closed | Sonnet 5 | low | OFF | fresh | PASS — Batch3B1 closed | 2.94 | 40 | 80 | 117791 | 3380883 | 17839 | 0 | $1.3274 | NO |
| 2 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### Cycle C002 summary

- `EXECUTIONS_COMPLETED`: 1 / 5
- `QUOTA_LIMIT_TRIGGERED_IN_CYCLE`: NO
- `CYCLE_CONCLUSION`: active

## Daily review log

For each day, append one review after reconciling completed executions from the raw buffer.

### 2026-08-21

- `EXECUTIONS_REVIEWED`: C001 complete (5) + C002 execution 1
- `ACTIVE_CYCLE`: C002
- `QUOTA_LIMIT_EVENT_TODAY`: NO across recorded experiment executions
- `MODEL_EFFICIENCY_SIGNAL`: Haiku is materially cheaper on narrow mechanical remediation; Sonnet 5 needs tighter GPT-scoped concerns to avoid high-turn/cache-read runs
- `FIRST_PASS_RELIABILITY_SIGNAL`: insufficient for permanent model routing; C001 had multiple remediation rounds
- `GPT_RECOMMENDATION_FOR_NEXT_DAY`: keep Sonnet 5 for contract-sensitive cross-module work, thinking OFF, subagents denied; continue splitting by independently reviewable logical concern

## 2026-09-01 final routing review template

Compare Haiku 4.5 / Sonnet 4.6 / Sonnet 5 using: successful logical closures per five-run cycle, first-pass closure rate, substantive failures, remediation attempts, elapsed time, turns, cache/input/output/thinking tokens, actual quota-limit frequency, and API-equivalent usage when available.

Final decision must distinguish **price-equivalent efficiency** from **Claude session/quota efficiency**. Promotion pricing alone must not decide the permanent route.

- `POST_PROMO_TIER_1`: pending
- `POST_PROMO_TIER_2`: pending
- `POST_PROMO_TIER_3`: pending
- `DEFAULT_THINKING_POLICY`: pending
- `OWNER_DECISION`: pending
