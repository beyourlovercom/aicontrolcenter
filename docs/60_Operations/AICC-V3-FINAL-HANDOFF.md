# AICC V3.0–V3.9 Final Handoff

Status: `V3.9 CLOSED / OWNER ACCEPTED — PR #12 MERGE GATE PENDING`
Repository: `beyourlovercom/aicontrolcenter`
Canonical worktree: `~/AI/007/worktrees/aicc-v3-clean`
Canonical branch: `rebuild/aicc-v3-clean`
V3.9 starting HEAD: `c0da25f3dae457c130e365b2a81109646454243f`

## Scope and architecture

V3.0 froze V2 and established isolated governance. V3.1 established one V3 server. V3.2 made the typed ProjectContext the authority for repository, branch, HEAD, and dirty state. V3.3 established the read-only canonical roadmap. V3.4 added the durable Work Package and Task store. V3.5 added one exact Task-bound Codex Run and executor lease. V3.6 added immutable Canonical Result persistence. V3.7 added Draft-only GitHub delivery and exact-head CI facts. V3.8 added the explicit GPT Browser Bridge: request → Task → Run → Canonical Result → Delivery → same-conversation receipt. V3.8 is closed/accepted for its implemented scope; V3.9 is also closed/accepted after deterministic hardening and explicit Owner final acceptance.

The authority chain remains `Owner action → explicit Bridge origin → ProjectContext → Task → Run → Canonical Result → Delivery → Bridge receipt`. AICC transports and displays identity/state; it does not infer requirements, rewrite Result content, or decide semantic PASS/FAIL.

## Canonical operation

The exact workflow is: verify the clean canonical worktree and `rebuild/aicc-v3-clean`; verify the expected starting HEAD and remote authority; edit only the authorized V3 scope; run targeted tests first; run the complete `v3` Node test suite; review the diff; commit the reviewed head; push only to `origin rebuild/aicc-v3-clean`; require exact-head CI and separate Owner gates. PR #11 is untouched. PR #12 remains `Draft` until the Owner separately authorizes merge. No merge, release, or deployment is part of this handoff.

The V3 runtime is pinned to the CN MacBook Pro device ID `3107d5f0-6f29-479c-8453-77bf53c172cf`; hostname inference is not valid. The local service is the single V3 Node server on `127.0.0.1:1420`, launchd label `com.aicc.v3.local-service`, with state rooted at `~/.aicc-v3` and project facts loaded from `~/.aicc-v3/project.json`. The Browser Bridge is `AICC V3 ChatGPT Bridge` version `3.8.12`, extension ID `ckidplkogedlpnocdodjhgjelpdflpki`, loaded unpacked in Chrome Profile 12 from `~/AI/007/worktrees/aicc-v3-clean/v3/browser-bridge`. The exact profile/extension identity is authoritative; do not fall back to frontmost/latest Chrome. The Owner Gate is required before any real ChatGPT send, any pairing, any merge, and any deployment/cutover.

## Guarantees and recovery

- Every request has an explicit `conversationId`, Bridge-owned `originTurnId`, persisted UUID `requestId`, exact Task binding, exact instruction hash, Run, Result, and Delivery.
- Different explicit requests cannot cross-bind Tasks, Runs, Results, deliveries, conversations, or receipts; there are no latest/active fallbacks.
- A terminal `DELIVERED` receipt remains `DELIVERED` across AICC restart and cannot be claimed or replayed. A claimed request without a trustworthy terminal receipt becomes `DELIVERY_UNCERTAIN` and is never automatically resent.
- `ABORTED_BEFORE_SEND` is the only safe pre-send recovery and is bounded to two retries. Conversation mismatch, receipt mismatch, missing identity, invalid binding, uncertain delivery, lease conflicts, and unavailable runtime fail closed.
- Result content is delivered byte-for-byte from the Canonical Result. AICC does not trim, wrap, summarize, translate, or add status labels.

## V3.8 UAT evidence

The exact evidence to retain and review is request `c12c9a36-5d48-4887-9696-abb8ae328f9d`, Run `d67d5703-aa8b-4950-be40-1001701ebcf3`, and Canonical Result/delivery marker `AICC_V3_8_12_E2E_PASS`. This evidence is transport and UAT evidence only; it does not authorize merge or deployment.

## V3.9 closure and next gate

The Owner explicitly accepted V3.9 on 2026-09-06 after exact-head CI success, deterministic restart/isolation regressions, and the human same-conversation UAT on the pinned CN Mac/Profile 12 setup. AICC V3.0–V3.9 development is therefore closed. PR #12 remains Draft / Open; merge, release, deployment, or readiness changes remain separate Owner-authorized gates.
