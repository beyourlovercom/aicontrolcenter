# AICC V3 GPT Bridge / Auto Return Contract

Contract-Version: 1
Status: `FROZEN / V3.8`

## Purpose

Define the smallest trustworthy GPT ↔ AICC bridge that binds one explicit Owner-authorized GPT action to one existing Task, one Run, one immutable Canonical Result, and one return attempt to the same originating conversation.

The bridge is transport only. It does not interpret requirements, rewrite Result content, infer PASS/FAIL, choose a project, choose a Task, or guess which ChatGPT conversation should receive a Result.

## Authority chain

`Explicit Owner action -> Browser Bridge origin binding -> ProjectContext -> Task -> Run -> Canonical Result -> Delivery envelope -> Browser Bridge receipt`

GPT remains requirement/review/Owner-communication authority.
Codex remains executor/semantic-result authority for the implementation Run.
AICC remains identity, transport, persistence, and display authority only.

## Frozen semantic boundaries

`AICC_TRANSPORT_ONLY = 1`
`AICC_DISPLAY_ONLY = 1`
`AICC_DECISION_AUTHORITY = 0`
`AICC_RESULT_REWRITE = 0`
`PRE_CODEX_SEMANTIC_GATE_COUNT = 0`
`AICC_PASS_FAIL_BLOCKED_AUTHORITY = CODEX`

## Browser Bridge boundary

V3.8 uses an explicit browser-side Bridge client for ChatGPT web. AICC itself never discovers browser focus, active tab, latest conversation, latest message, or DOM state.

The Bridge client has two parts conceptually:

- a content-side adapter attached to an explicit ChatGPT conversation and exact Owner-triggered Assistant action;
- a privileged extension/background transport that talks to loopback AICC and holds the local Bridge credential.

The content-side adapter must never receive or expose the Bridge credential in page DOM, Assistant content, console-visible page variables, or query parameters.

AICC must not enable broad unauthenticated cross-origin mutation access merely to make ChatGPT pages call localhost.

## Explicit origin identity

Every Bridge request must carry these immutable origin facts:

- `provider = chatgpt-web`;
- non-empty opaque `conversationId`;
- non-empty opaque `originTurnId`;
- non-empty UUID `requestId` generated and persisted by the Bridge before the first network submission;
- exact existing `taskId`;
- exact instruction string.

`conversationId` must come from an explicit stable conversation identity available to the Bridge. If none is available, fail `BRIDGE_CONVERSATION_ID_UNAVAILABLE`.

`originTurnId` is a Bridge-owned opaque action identity. V3.8 does not pretend it is a private ChatGPT internal turn/message ID when such an ID cannot be proven. It is created once for the explicit Owner action and persisted across rerender/refresh/reconnect.

The following are forbidden origin fallbacks:

- active tab;
- frontmost window;
- page title;
- latest ChatGPT conversation;
- latest Assistant message;
- latest AICC Task;
- latest AICC Run.

One explicit Owner action may create at most one Bridge `requestId` in V3.8.
No automatic run is triggered merely because a ChatGPT page renders or rerenders.

## Request idempotency and Task binding

`POST /api/bridge/requests` accepts only explicit `requestId`, origin identity, `taskId`, and exact `instruction`.

AICC re-loads current `ProjectContext` and Work Store for every request.
The Task must exist in the current project; no implicit Task creation or selection occurs.

AICC computes the instruction SHA-256 itself.
Re-submitting the same `requestId` with identical immutable binding returns the existing request/Run correlation.
Reusing a `requestId` with any different conversation, origin turn, Task, or instruction hash fails `BRIDGE_REQUEST_CONFLICT`.

Request submission may be retried up to 3 transport attempts by the Bridge, always with the same persisted `requestId`.

## Durable storage

Bridge state is project-scoped under the same deterministic project key used by Work/Run/Result storage:

```text
projects/<project-key>/bridge/requests/<request-id>/request.v1.json
projects/<project-key>/bridge/requests/<request-id>/state.v1.json
projects/<project-key>/bridge/requests/<request-id>/events.jsonl
projects/<project-key>/bridge/requests/<request-id>/delivery.v1.json
projects/<project-key>/bridge/requests/<request-id>/receipt.v1.json
```

`request.v1.json` is immutable after successful creation and stores origin identity, Task/WP binding, instruction SHA-256, exact Run ID, project/repository/worktree binding, and creation time.

`state.v1.json` is an atomically replaced transport projection only.
`events.jsonl` is append-only and never semantically rewritten.
`delivery.v1.json` is create-once from one immutable Canonical Result.
`receipt.v1.json` is create-once for a terminal delivery receipt.

No browser localStorage/sessionStorage copy is AICC authority.
The browser extension may persist its own request/claim ledger solely to survive browser reload/restart and prevent duplicate sends.

## Run and Result correlation

A Bridge request starts execution only through the already-frozen V3.5 Run path.
The created Run must bind to the request's exact Task/WP and current ProjectContext.

A delivery may be created only from the immutable V3.6 Canonical Result bound to that exact Run.
No `latest Result` lookup exists.

The delivery envelope stores:

- `schema = aicc.v3.bridge-delivery.v1`;
- deterministic `deliveryId` bound to the exact `requestId` and `resultId`;
- exact `requestId`, `conversationId`, `originTurnId`, `taskId`, `workPackageId`, `runId`, and `resultId`;
- exact `contentSha256` copied from the Canonical Result;
- exact `content = Result.content` with no trimming, wrapping, Markdown transformation, summary, translation, prefix, suffix, or PASS/FAIL label;
- `createdAt` UTC timestamp.

AICC must validate the Result again before delivery materialization.
A corrupted or mismatched Run/Result/request chain fails closed.

## Delivery state model

Allowed Bridge delivery states are transport facts only:

`WAITING_RESULT | READY | CLAIMED | DELIVERED | DELIVERY_UNCERTAIN`

`WAITING_RESULT` means no eligible Canonical Result exists yet.
`READY` means one immutable delivery envelope exists and has not been claimed.
`CLAIMED` means one exact Bridge instance has obtained a one-time delivery claim.
`DELIVERED` means the Bridge returned a valid receipt proving it intentionally submitted the exact content to the originating conversation.
`DELIVERY_UNCERTAIN` means a send side effect may have occurred but a trustworthy terminal receipt cannot be proven.

None of these states imply engineering PASS/FAIL/BLOCKED.

## Claim and exactly-once boundary

The Bridge must explicitly claim a READY delivery before attempting any ChatGPT send side effect.
AICC issues an opaque `claimId` bound to one `deliveryId`, one `bridgeInstanceId`, and one claim timestamp.

Before touching the ChatGPT composer, the extension persists a local write-ahead ledger entry for that `deliveryId/claimId`.

V3.8 guarantees **at-most-one automatic send attempt after a claim**, not magical distributed exactly-once semantics against an external web UI.

If the Bridge can explicitly prove no send side effect occurred, it may report `ABORTED_BEFORE_SEND`. AICC may then return the delivery to READY for at most 2 safe pre-send retries.

After a send attempt begins, automatic retry count is exactly 0.
If the browser/extension crashes or disconnects after a send may have happened but before a valid receipt is stored, reconciliation must mark `DELIVERY_UNCERTAIN` and must not auto-send again.

This fail-closed rule is what prevents duplicate Result messages across rerender, refresh, reconnect, browser restart, and AICC restart.
Manual Owner recovery from `DELIVERY_UNCERTAIN` is deferred to V3.9 hardening; V3.8 never silently retries an ambiguous send.

## Same-conversation return

Before submitting content, the Bridge must resolve and verify the destination conversation identity equals the immutable request `conversationId`.
If the currently visible conversation differs, the Bridge may navigate to the explicitly bound conversation, then must verify again before sending.

Failure to prove exact destination identity returns `BRIDGE_CONVERSATION_MISMATCH`; it must never fall back to the active or latest conversation.

The exact ChatGPT message content submitted by V3.8 is `delivery.content` only.
The Bridge must not prepend transport labels, Result IDs, Markdown fences, or commentary to the Canonical Result text.
Transport metadata remains in AICC/Bridge state rather than being injected into Result content.

## Receipt contract

After a send attempt, the Bridge posts one explicit receipt for the exact `deliveryId/claimId`.
Allowed receipt outcomes are:

- `DELIVERED` — exact content was intentionally submitted to the exact originating conversation;
- `ABORTED_BEFORE_SEND` — Bridge explicitly proves no ChatGPT send side effect occurred;
- `UNCERTAIN` — the Bridge cannot prove whether the external send committed.

A `DELIVERED` receipt must include the exact destination `conversationId` and `contentSha256`; both must match the immutable delivery envelope.
A provider message ID may be recorded when the Bridge can prove one, but it is optional and never fabricated.

A terminal `DELIVERED` or `UNCERTAIN` receipt is immutable.
A second conflicting receipt fails closed.

## Restart reconciliation

AICC restart re-loads request, Run, Result, delivery, state, and receipt from disk; it does not rediscover a conversation from browser state.

A terminal DELIVERED receipt remains terminal across restart.
A READY delivery remains READY.
A CLAIMED delivery without a trustworthy terminal receipt may not silently return to READY after timeout; it becomes `DELIVERY_UNCERTAIN` unless an explicit `ABORTED_BEFORE_SEND` receipt already proves no side effect occurred.

## Local Bridge authentication

Every Bridge mutation/read endpoint requires a local Bridge credential independent from ChatGPT credentials.
The credential is generated by AICC, stored under `~/.aicc-v3/bridge/` with owner-only permissions, and paired to the extension/background transport by explicit Owner action.

The credential must never be included in Git, ProjectContext, Result content, browser page DOM, query strings, logs, or public API responses.

AICC remains bound to loopback and must not expose Bridge mutation endpoints over a public network interface.
Broad wildcard CORS for bridge mutations is forbidden.

The ChatGPT content page does not directly hold the AICC Bridge credential; privileged extension/background transport attaches it.

## Minimal V3.8 API contract

`POST /api/bridge/requests` -> idempotently bind one explicit origin/Task/instruction and start or return the exact correlated Run.

`GET /api/bridge/requests/:requestId` -> read exact request/Run/Result/delivery transport correlation.

`POST /api/bridge/requests/:requestId/claim` -> claim the one immutable Result delivery envelope for one Bridge instance.

`POST /api/bridge/requests/:requestId/receipt` -> persist one explicit delivery outcome for the exact claim.

There is no `latest request`, `latest conversation`, global pending-result discovery, result edit, result rewrite, semantic status, merge, release, or deploy endpoint.

## Fail-closed errors

`BRIDGE_AUTH_REQUIRED`
`BRIDGE_REQUEST_INVALID`
`BRIDGE_CONVERSATION_ID_UNAVAILABLE`
`BRIDGE_ORIGIN_TURN_ID_REQUIRED`
`BRIDGE_REQUEST_CONFLICT`
`BRIDGE_PROJECT_MISMATCH`
`BRIDGE_TASK_NOT_FOUND`
`BRIDGE_RUN_BINDING_FAILED`
`BRIDGE_RESULT_NOT_READY`
`BRIDGE_DELIVERY_NOT_FOUND`
`BRIDGE_DELIVERY_ALREADY_CLAIMED`
`BRIDGE_DELIVERY_ALREADY_DELIVERED`
`BRIDGE_DELIVERY_UNCERTAIN`
`BRIDGE_CONVERSATION_MISMATCH`
`BRIDGE_RECEIPT_MISMATCH`
`BRIDGE_RETRY_EXHAUSTED`

## V3.8 exclusions

No automatic project/Task selection, browser-focus inference, multi-agent fan-out, Result rewriting, semantic PASS/FAIL, automatic PR mutation, merge, release, deploy, or ambiguous post-send retry is introduced in V3.8.

## Acceptance gate for implementation

Implementation must prove explicit origin binding, request idempotency, exact Task→Run→Result correlation, credential isolation, immutable delivery content, same-conversation verification, at-most-one automatic post-claim send, safe bounded pre-send retry, restart-safe delivery state, and fail-closed `DELIVERY_UNCERTAIN` behavior before Human Owner UAT.
