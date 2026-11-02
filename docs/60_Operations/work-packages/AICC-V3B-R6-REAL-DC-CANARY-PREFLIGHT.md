# AICC V3-B — R6 real DC Canary readiness (read-only, STOP)

**Date:** 2026-11-02 (Asia/Taipei)
**Scope:** Independent V3-B adapter branch, not Stable R9–R13.
**Baseline:** GitHub main merge commit `8fee8eb8adbec7940727a5983fe7765c7755fa93` (PR #111 merged).
**State:** **Dev preflight ONLY**; no real automatic dispatch, signed trust, credential wiring, Production activation, or main merge authority supplied by this document.

## Evidence collected via formal BYL DC OAuth (supervised)

- Four registered devices returned READY: us-macmini, china-mac, windows, 007windows. READY is registration status, **not** a signed, fresh attestation of trusted agent identity.
- US Mac mini process self-test returned hostname as-Mac-mini.local, proving only the *supervised ChatGPT connector* can invoke its fixed read-only self-test.
- GitHub origin/main readback: `8fee8eb8adbec7940727a5983fe7765c7755fa93`.
- 1438 isolated AICC Dev: GET /api/health automaticDcDispatch STOP; GET /api/dc-adapter/status ISOLATED_DEV_MOCK, realDispatch STOP, realDispatcherImplemented false, ownerAuthorization NOT_AVAILABLE, productionEnabled false.
- The registered ChatGPT tool and its OAuth session are **not transferable** credentials for a background AICC Node process. Neither the self-test nor READY proves that independent service-side OAuth, scoped approval or signed health exists.

## Implementation: R6-A evidence inventory only

- New pure module `v3/lib/dc-canary-readiness-v3.mjs`, and read-only route `GET /api/dc-adapter/canary-readiness` lists six required evidence classes and explicitly returns STOP.
- This is a **source capability inventory**, **not** a runtime probe, trusted verification service or assertion that external services lack these capabilities.
- No URL, token, OAuth grant, signing key, privileged policy content, command executor or writable dispatch endpoint has been introduced.
- No input, environment variable, `ownerApproved`, synthetic flag or spoofed signed-health claim can turn the result into ALLOW.
- Existing `assertDcAutomaticDispatchAllowed()` remains unconditional STOP. `POST /api/dc-adapter/dispatch` is still 404; V3 `POST /api/runs` still 403.

## R6-B prerequisites before considering a **real** automatic Canary

| Gate | Required verifiable proof | Current finding |
|---|---|---|
| Independent scoped Owner attestation | Non-model authority issues independently verifiable, revocable, short-lived grant bound to project/WP/task/repo/worktree/HEAD/device/tool/nonce | Not wired into AICC |
| Service-side delegated identity | AICC runtime independently authorized for precisely scoped DC tool by authorized service broker; no copying ChatGPT tokens or bypassing OAuth | Not evidenced in AICC |
| Fresh signed device health | Signed device identity and fresh timestamp/nonce checked against trusted verifier; registration READY and hostname are insufficient | Not evidenced in V3-B |
| Typed tool map and remote policy | Explicit operation-to-tool allowlist with server-side enforcement; no arbitrary shell or cross-device fallback | Synthetic map only |
| Remote idempotency and receipts | Durable remote request nonce/status/readback, receipt signer, uncertainty quarantine, revocation and crash recovery, live rollback | Mock state only |
| Separate exact-scope Owner Canary authorization | Explicitly named device, operation, project, HEAD, maximum calls, TTL, zero-Production effects; evidence bundle approved | Not provided |

**R6-B STOP** until all above are demonstrably true and separately approved. Presence of a hypothetical real flag is never sufficient.

## Minimum future Canary scope proposal (NOT permission)

A first genuinely automatic test should be considered only after the independent authorization model exists. Suggested lowest-risk scope: isolated Dev AICC Work Package, one exact GitHub HEAD, one device `us-macmini`, one typed **read-only** operation `remote_process_selftest`, one unique nonce, at most one dispatch, short TTL and bounded timeout; audited receipt and replay refusal. This recommendation does **not** approve, schedule or run that automatic call. There must be an independent owner grant and a service-side OAuth capability first.

Other hosts, WRITE/CODE_CHANGE, production, main mutation, protected backup, OAuth/Agent/Gateway configuration, READY restart and Stable R9–R13 all remain outside this phase.

## R6-A verification and rollback

Run `node --test v3/tests/dc-canary-readiness-v3.test.mjs`, `npm --prefix v3 test` and root `npm test`; all negative cases must stay STOP. Audit readback is the deterministic read-only API in a temporary isolated server, not a live device auto call.

Rollback: revert R6-A branch or remove the read-only endpoint/module; keep PR #111 implementation and original 1420/1436/1437/1438/8797 and Agent/OAuth untouched. **No production rollback necessary because nothing is deployed.**

## Stage and Owner gates

- R6-A: supervised capability readback + immutable STOP inventory + Dev test/CI → Draft PR. Can complete autonomously.
- R6-B: independently verified service delegation, signed agent health and operator grant design → blocked until legitimate proof available from Stable/service owners.
- R6-C: first real-device automatic read-only Canary → explicit independent Owner approval with exact device/tool/HEAD/count/TTL, **not implied by PR #111 merge or generic continuation**.
- R6-D: GitHub main integration and Production V3 → each requires separate exact-head approval; R6-D Prod not in scope here.
