# AICC V3-B — R6-B1 signed evidence boundary (Dev fixture only)

**Status:** Source-only design and executable cryptographic negative tests. Not a trusted authorizer, not a DC identity provider, not an Agent attestation service, not a runtime deployment.

**Base:** PR #112 merged GitHub main at `df25458d92811a384d332d1832dff574e72f85b3` (2026-11-02).

## What is implemented

Pure module `v3/lib/dc-signed-evidence-sandbox-v3.mjs`: independently verify two synthetically generated Ed25519 evidence envelopes against *cryptographically distinct test-fixture public keys*. The module is not imported by the AICC server, exposes no HTTP route, knows no OAuth credentials and performs no network/device action. Never promote its result into `assertDcAutomaticDispatchAllowed()`.

The Owner-scope and device-health evidence envelopes are domain separated (`AICC_V3B_R6B_DEV_SIGNED_EVIDENCE_V1`), exact-key structured, and require an Ed25519 signature over literal encoded claim bytes. The evaluator rejects changed/duplicate-key JSON, wrong issuer/audience/schema/role/key, same-key/different-ID substitution, private-key trust-root inputs, invalid signature, expired/future-issued/overlong (greater than 60 seconds) proof and role-key reuse. Both claims must bind to the same nonce, project ID, Work Package, Task, `beyourlovercom/aicontrolcenter`, exact 40-character HEAD, `us-macmini` and `remote_process_selftest`. Owner proof must request exactly one call, Dev-only, Production false. Health proof must be explicitly `SYNTHETIC_TEST_HEALTH` and verified.

**Every successful cryptographic evaluation still returns `decision:STOP` and `automaticDispatchAllowed:false`.** It explicitly says `CALLER_INJECTED_DEV_TEST_KEYS`, `serviceDelegation:NOT_VERIFIED`, `remoteReplayGuard:NOT_IMPLEMENTED`, `trustedRuntimeAuthority:NOT_ESTABLISHED`, `realCanaryExecuted:false` and `productionEnabled:false`. The clock is also injected test time; this result is intentionally never a real authorization verdict.

## Proof vs actual authority

| Component | R6-B1 demonstrated in Dev | Still required for real authorization |
|---|---|---|
| Independent operator/Owner | Two-role cryptographic scope fixture and invalid-case tests | External Owner-side authority, issued outside model/request, with persisted approval/denial and revocation |
| Device identity/health | Synthetic signed health integrity fixture | Device-origin attestation with trusted signer registry, anti-replay challenge, freshness and host binding independent of READY |
| Service OAuth | No implementation and no credential reads | Service-owner-approved, short-lived, least-privileged OAuth delegation specifically for AICC backend; never export ChatGPT token |
| Live tool mapping | Only the read-only operation is pinned in a test envelope | Independently enforced DC server-side tool allowlist and parameter validation |
| Remote result | No operation sent and no receipt forged | Remote durable nonce and status readback, signer identity, crash/timeout quarantine and revocation propagation |
| Owner real Canary | No real dispatch | Separate Owner exact-device/tool/HEAD/nonce/max-count/TTL approval and witnessed UAT |
| Production V3 | Not considered | Independent backup, rollback and Production approval; Stable R9–R13 remains separate |

## Untrusted inputs and security caveats

1. The Dev test constructs two distinct Ed25519 keypairs **inside the test process**. These are not legitimate Owner or device keys and must never be treated as trusted anchors. No private keys are added to Git. The verifier accepts only public Ed25519 KeyObjects, compares canonical SPKI SHA-256 fingerprints across roles, and rejects private keys. Caller-injected public keys are not acceptable production roots.
2. A signed payload proves integrity and possession of the matching fixture key only. It does not establish that the signing person is the Owner, that the machine is healthy, that OAuth is delegated, or that an execution has occurred.
3. Stateless proof parsing does **not** implement persistent nonce consumption/replay prevention. All successful fixture checks remain STOP; an actual remote execution path must have a durable remote nonce ledger and acknowledgement semantics.
4. No AICC server route, feature flag, browser input, header, `ownerApproved` or environment claim can convert synthetic evidence into real authority. Existing real-dispatch guard still rejects unconditionally.
5. Tests run in isolated US Mac development worktree using formal self-hosted BYL DC **supervised** tool invocation. Do not copy those tool credentials into runtime or change Agent/Gateway/OAuth, READY devices or any running services.

## Validation & next gate

- `node --test v3/tests/dc-signed-evidence-sandbox-v3.test.mjs` tests integrity pass with guaranteed dispatch STOP plus signature tamper, invalid issuer/key/role, wrong exact binding, expiry, forged approval and noncanonical signed data.
- `npm --prefix v3 test` must preserve all existing tests (R6-B1 adds nine).
- `npm test` root, Codex read-only SECURITY_REVIEW, GitHub V3 CI and full CI.
- Only a Draft PR is authorized in this phase. Ready for Review/main integration requires Owner exact-head approval; real read-only automatic Canary requires the *separate* concrete trusted-chain evidence and approval, not generic 'continue'.

**Rollback:** discard this new Dev branch. No production or live AICC process changed.
