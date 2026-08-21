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

## Cycle C001 — ACTIVE

| # | Time | Logical concern | Model | Effort | Think | Session | Result | Min | Turns | Input | Cache write | Cache read | Output | Think tok | API-eq | Quota |
|---|---|---|---|---|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---|
| 1 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 2 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 3 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 4 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| 5 |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

### Cycle C001 summary

- `EXECUTIONS_COMPLETED`: 0 / 5
- `MODEL_DISTRIBUTION`: pending
- `SUBSTANTIVE_FAILURES`: 0
- `FIRST_PASS_LOGICAL_CLOSURES`: 0
- `REMEDIATION_ATTEMPTS`: 0
- `TOTAL_ELAPSED`: pending
- `TOTAL_INPUT_TOKENS`: pending
- `TOTAL_CACHE_WRITE_TOKENS`: pending
- `TOTAL_CACHE_READ_TOKENS`: pending
- `TOTAL_OUTPUT_TOKENS`: pending
- `TOTAL_THINKING_TOKENS`: pending
- `TOTAL_API_EQUIVALENT`: pending
- `QUOTA_LIMIT_TRIGGERED_IN_CYCLE`: NO
- `CYCLE_CONCLUSION`: pending

## Daily review log

For each day, append one review after reconciling completed executions from the raw buffer.

### 2026-08-21

- `EXECUTIONS_REVIEWED`: 0 new experiment executions
- `ACTIVE_CYCLE`: C001
- `QUOTA_LIMIT_EVENT_TODAY`: N/A — experiment has not started executing yet
- `MODEL_EFFICIENCY_SIGNAL`: insufficient data
- `FIRST_PASS_RELIABILITY_SIGNAL`: insufficient data
- `GPT_RECOMMENDATION_FOR_NEXT_DAY`: begin C001 under temporary promo routing

## 2026-09-01 final routing review template

Compare Haiku 4.5 / Sonnet 4.6 / Sonnet 5 using: successful logical closures per five-run cycle, first-pass closure rate, substantive failures, remediation attempts, elapsed time, turns, cache/input/output/thinking tokens, actual quota-limit frequency, and API-equivalent usage when available.

Final decision must distinguish **price-equivalent efficiency** from **Claude session/quota efficiency**. Promotion pricing alone must not decide the permanent route.

- `POST_PROMO_TIER_1`: pending
- `POST_PROMO_TIER_2`: pending
- `POST_PROMO_TIER_3`: pending
- `DEFAULT_THINKING_POLICY`: pending
- `OWNER_DECISION`: pending
