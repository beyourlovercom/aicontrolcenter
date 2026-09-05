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

Commit and push the V3.8.1 durable Bridge persistence/API checkpoint and require exact-head V3 CI PASS. Then implement the privileged browser Bridge client and explicit same-conversation delivery verification. No real ChatGPT send side effect is authorized before that browser integration passes focused tests and reaches an explicit Owner UAT gate.

## Frozen V3.8 contract

- Authority: `docs/40_Architecture/AICC-V3-GPT-BRIDGE-CONTRACT.md`.
- One explicit Owner action binds one persisted `requestId` to exact `conversationId`, Bridge-owned `originTurnId`, existing Task, exact instruction, Run, and Canonical Result.
- No active-tab/latest-conversation/latest-Task fallback exists.
- Result delivery content is exactly `Canonical Result.content`; AICC/Bridge may not prefix, trim, summarize, translate, wrap, or infer PASS/FAIL.
- Automatic post-claim send retry count is zero. An ambiguous send becomes terminal `DELIVERY_UNCERTAIN` rather than being auto-replayed.
- Safe pre-send retry is bounded to two attempts only after explicit `ABORTED_BEFORE_SEND`.
- Bridge mutation/read APIs require a loopback-only local Bridge credential held by extension/background transport, not page DOM.

## V3.8.0 contract evidence

- Historical V2 roadmap evidence preserved the same-conversation exactly-once goal but no reusable Bridge implementation was present in the current repository.
- V3 therefore freezes a new clean protocol rather than importing V2 runtime/state.
- ChatGPT internal message/turn IDs are not assumed; `originTurnId` is explicitly Bridge-owned unless a provider ID can later be proven.
- Same-conversation return fails closed on identity mismatch and never uses browser focus or latest activity.

## V3.8.1 implementation evidence

- Added project-scoped durable Bridge Request / state / append-only events / immutable Delivery / terminal receipt storage.
- Request creation binds a persisted `requestId` to one exact Task/WP and one fixed Run ID before network retry can create another Run.
- Added authenticated `POST /api/bridge/requests`, exact `GET /api/bridge/requests/:requestId`, exact claim, and exact receipt endpoints.
- Local Bridge credential is generated/stored outside Git with owner-only `0600` permissions; all four APIs require loopback + credential and do not return it.
- Canonical Result content is copied byte-for-byte into one immutable Delivery; no trim, wrapper, summary, translation, or semantic status is added.
- Safe pre-send retries are bounded to two after the initial claim; after a possible send side effect there is zero automatic retry.
- Restart reconciliation converts an unreceipted `CLAIMED` delivery to `DELIVERY_UNCERTAIN` and forbids automatic resend.
- Focused fake-Browser-Bridge coverage plus the complete Node 22 V3 suite reached `48/48 PASS`.
- Real CN Mac `~/.aicc-v3` remained free of Bridge requests/credentials during implementation; no real Codex Run or ChatGPT send was started.
