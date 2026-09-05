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

Commit and push the V3.8.2 privileged Browser Bridge checkpoint and require exact-head V3 CI PASS. Then deploy that exact head to CN Mac, load and explicitly pair the unpacked extension, and enter one controlled Human Owner UAT. The real send side effect remains Owner-triggered only: nothing may submit to ChatGPT until the Owner clicks `✦ AICC` and then confirms the exact Task/instruction in the Bridge dialog.

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
## V3.8.2 browser integration evidence

- Added a Manifest V3 Chrome extension with privileged background transport and a credential-free ChatGPT content adapter.
- Extension host access is limited to `https://chatgpt.com/*` and `http://127.0.0.1:1420/*`; no `activeTab`, `<all_urls>`, wildcard CORS, latest-conversation, or latest-Task fallback exists.
- `chrome.storage.local` is restricted to `TRUSTED_CONTEXTS`; the ChatGPT content script never reads the Bridge credential or extension ledger.
- Assistant turns receive an explicit `✦ AICC` action. The Owner must choose an existing Task and review the exact instruction before a Bridge Request is submitted. Page render alone never executes.
- Background persistence writes `requestId/originTurnId` before first network submission and writes `sendAttempted=true` before touching the ChatGPT delivery adapter.
- Same-conversation delivery verifies explicit `conversationId`, Canonical Result SHA-256, exact composer content, and send control before clicking Send.
- Receipt transport loss retries only the immutable receipt; a focused regression proves the ChatGPT send adapter is called exactly once.
- Exact duplicate `ABORTED_BEFORE_SEND` and terminal `UNCERTAIN` receipts are idempotent; conflicting receipts remain fail-closed.
- Added clipboard-only macOS pairing helper; it never prints the Bridge token.
- Fake-browser integration plus the complete Node 22 V3 suite reached `55/55 PASS`; Chrome 152 smoke produced no manifest/extension-load error.
- No real Bridge credential, Bridge Request, Codex Run, or ChatGPT send was created during V3.8.2 implementation/testing.
