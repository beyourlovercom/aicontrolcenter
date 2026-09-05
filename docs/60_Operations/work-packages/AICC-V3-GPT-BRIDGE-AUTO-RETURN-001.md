# AICC-V3-GPT-BRIDGE-AUTO-RETURN-001

Status: `ACTIVE / OWNER_AUTHORIZED`

## Objective

Implement the smallest trustworthy GPT Bridge / Auto Return loop so an Owner-authorized GPT turn can be correlated to an AICC Task/Run, receive the immutable Canonical Result, and return that exact result to the same originating conversation without granting AICC semantic decision authority.

## Authority

- GPT owns requirement interpretation, decomposition, review, and Owner communication.
- AICC transports identities, commands, events, receipts, and immutable Result references only.
- Codex remains executor/semantic-result authority for the implementation Run.
- The originating conversation identity must be explicit and durable; it must never be inferred from browser focus, latest activity, or UI state.

## In scope

- explicit conversation/turn binding contract;
- Task/Run/Result correlation;
- outbound canonical Result delivery envelope;
- delivery receipt and idempotency model;
- reload/restart-safe pending delivery state;
- bounded retry/fail-closed behavior;
- focused tests, minimal UI/diagnostics only if needed, exact-head CI, Owner UAT.

## Out of scope

- rewriting, summarizing, translating, or semantically judging Result content;
- automatic merge, release, deploy, or PR mutation;
- implicit conversation discovery;
- multi-agent fan-out;
- V3.9 final hardening/handoff.

## Hard boundaries

`AICC_TRANSPORT_ONLY = 1`
`AICC_DISPLAY_ONLY = 1`
`AICC_DECISION_AUTHORITY = 0`
`AICC_RESULT_REWRITE = 0`
`PRE_CODEX_SEMANTIC_GATE_COUNT = 0`
`AICC_PASS_FAIL_BLOCKED_AUTHORITY = CODEX`

## Next exact gate

Freeze the V3.8 bridge contract before code: conversation identity, turn identity, Task/Run/Result binding, delivery envelope, receipt, idempotency, retry limits, restart reconciliation, and fail-closed error codes. No bridge implementation until this contract is committed and exact-head CI passes.
