# AICC V3-B R6-C-T1 — Real Trust Integration Dev UAT / Security Gate

Date: 2026-11-02 (Asia/Taipei)
Issue: https://github.com/beyourlovercom/aicontrolcenter/issues/115
Parent: #98
Exact verified main baseline: dde24c51f3fe4427d5e622315ff4b6b0629a7d35 (PR #114)
Isolation: feat/aicc-v3b-r6c-t1-trust-preflight-20261102
Target: ONLY us-macmini / remote_process_selftest / {}.

## T1-A service-principal discovery — read-only evidence
- Formal self-hosted DC device listing showed four READY registry entries. That is a registered-device view, not proof of an AICC-specific service principal.
- Repository inspection found official-parity-oauth-runtime-surface.mjs and official-parity-oauth-hook.mjs; the former explicitly states it is source-only and not connected to production runtime, and the latter requires a separately verified Cloudflare Access principal.
- No independent AICC M2M principal issuer, audience, scope, token TTL, refresh/rotation, revocation or audit sink was evidenced by the accessible running 1438 Dev endpoint.
- DO NOT transfer any ChatGPT OAuth credentials into AICC. Real service authorization remains NOT_INDEPENDENTLY_EVIDENCED; creation/enrollment needs a separate Owner/service-manager authorization.

## T1-B signed Agent health — read-only evidence
- On the US Mac host, unprotected 127.0.0.1:8791/healthz returned HTTP 200 with field names ok/service/toolCount. Values were not treated as attested identity.
- Formal DC remote_list_tools exposes generic DC file/process tools; no proven independently signed health/enrollment/receipt tool was exposed by that result.
- Reused canonical scripts/byl-remote-mcp/remote-v2-signed-health.mjs signature verifier, strict nonce and freshness.
- Source-level signed-health adapters exist (remote-v2-health-wire-dev.mjs), but have no independently evidenced installed handler or signed key enrollment record.
- No confirmed enrolled Ed25519 SPKI fingerprint, signer identity, independent enrollment attestation or real signed health challenge/readback was supplied. Signed Agent health = NOT_ATTESTED. Do not probe protected endpoints or infer identity from hostname/READY.

## T1-C fixed operation contract
- v3/lib/dc-r6c-t1-real-trust-contract-dev.mjs accepts ONLY deviceId=us-macmini, operation=remote_process_selftest, arguments={} and returns STOP/transport=NONE.
- Note: existing OAuth tool surface implements self-test via agentCall(deviceId,'start_process',{command:'hostname',timeout_ms:8000}); it is NOT a native read-only Agent method. A real server must independently enforce exact fixed tool/cmd mapping or preferably introduce a dedicated non-shell method, requiring separate review and approval. This work package does not install or deploy either.

## T1-D remote receipt contract
- Verifies canonical Ed25519 fixture receipt signature over exact binding fields: nonce, project/WP/task, repo HEAD, request ID, plan digest, Owner grant digest, service principal hash, revocation epoch, target device and operation, plus TTL/result digest.
- All public roots are caller supplied TEST FIXTURES, never independent trust enrollment; issuer must be DEV_RECEIPT_FIXTURE and audience AICC_R6C_DEV_REVIEW_ONLY.
- Even an integrity-valid fixture returns STOP, actualDeviceReceiptVerified:false, remoteDurableNonceProven:false, serviceDelegationVerified:false, ownerGrantVerified:false, automaticDispatchAllowed:false.
- The module has NO network, OAuth client, signer private key, Agent/Gateway integration, remote nonce consumer, filesystem state, command runner or ALLOW branch.
- The existing P2 signed operator receipt guard uses an in-memory replay map and supports OTHER operations; it is NOT reused as a durable R6-C receipt protocol.

## T1-E isolated Dev UAT
- New unit tests cover wrong device, forbidden shell, command injection, extra flags, signature tamper/outsider/private key, wrong grant/service hash, nonce/project/WP/task/HEAD, issuer/audience/status, TTL and replay binding (revocation epoch), malformed JSON/encoding and signed-health good/degraded/expired/wrong pin.
- Fixture cryptography is not independent verification of live production keys. A positive test cannot be called real Agent UAT.
- Required host: node --test v3/tests/dc-r6c-t1-real-trust-contract-dev.test.mjs; npm --prefix v3 test; npm test.
- Independent Codex read-only security review; GitHub V3/full CI only after Draft PR creation, then separate Owner exact-head approval for merge and any Dev deployment.

## True R6-C remaining hard STOP gates
1. Independent auditable Owner signed authorization, exact scope and revocation with real issuer.
2. Independently provisioned least-privileged AICC backend service principal (NOT ChatGPT OAuth).
3. Proven installed US Mac signed-health handler and out-of-band enrolled public key, fresh live challenge.
4. Real server-enforced single-tool no-shell fallback, with fixed input and Owner-approved service modification.
5. Device-origin signed receipt and durable remote-consumed nonce with idempotent readback, exact authorization/service identity binding, post-crash reconciliation and replay quarantine.
6. Production-grade transaction semantics against same-UID TOCTOU + durable directory entry fsync (current R6-B ledger is synthetic), and separately approved Dev real Canary.

No unauthorized Production, OAuth/Gateway/Agent writes, service restart, new credential, or real DC automatic command. Existing V3 assertDcAutomaticDispatchAllowed remains unconditional STOP. No 1438 Dev runtime install from GitHub source.

## Verdict
T1-A/B read-only fact inventory: COMPLETE TO EXTENT OBSERVABLE, REAL AUTHORITY NOT ATTESTED.
T1-C/D source-only negative-path contract: DEV CANDIDATE.
T1-E host tests / CI / Codex verdict: record after independent check.
T1-F one-call actual automatic Canary: NOT RUN / STOP.

## Verified T1-E Dev-only security evidence
- On authorized isolated US Mac Dev worktree, initial focused tests 15/15 PASS, V3 251/251 PASS, root npm test PASS.
- Independent Codex read-only SECURITY_REVIEW returned PASS_FOR_DEV_CANDIDATE for test-only contract, specifically REAL R6-C NO-GO. Codex noted direct malformed UTF-8 byte test was missing; now added strict invalid raw-byte signed fixture negative test (focused 16/16 PASS).
- Codex sandbox full suite cannot create /tmp fixtures (mkdtemp EPERM) and lacks root @tauri-apps/api; these sandbox restrictions do not substitute for real US Mac host test results.
- Final V3/full CI, exact HEAD, and final Codex readback must be recorded after preparing Draft PR; this file intentionally does NOT imply completed GitHub CI prior to that event.
- The completed Dev contract review is NOT operational service authentication, installed Agent signing, remote receipt/nonce, real Canary, merge approval or deployment authorization.
