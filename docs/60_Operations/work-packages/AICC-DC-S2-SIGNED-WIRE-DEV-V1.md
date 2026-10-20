# AICC DC S2 — Signed Health Wire Dev-only V1

**SCOPE:** Provide a real, independently testable wire-level Dev-only adapter for the existing S1 status and Ed25519 signature verification modules already in GitHub main. Does NOT install or deploy real Agent/Gateway/OAuth; does NOT grant an operator private legacy Agent source access.

## Reused canonical main
- PR #90 merged into GitHub main commit `581ff4300d401e2d7baa6d490d01b91fb7b212ef` after exact-head authorization, Owner Dev-only UAT and CI 3/3.
- `remote-v2-verified-availability.mjs`, `remote-v2-live-health.mjs`, `remote-v2-signed-health.mjs` remain the single implementations of signing and state transitions.
- Latest real S2 preflight: `007windows remote_list_tools -> PARITY_AGENT_UNREACHABLE`, but the currently running `remote_list_devices` still labels it `READY`. USA local Agent ordinary `/healthz` returned 200; protected `/v1/healthz` and `/v1/signed-health` returned 401 without authorization. **None** of these verifies actual signed health endpoints are installed.

## This PR: fixed-target Dev wire adapter
1. `createSignedHealthWireDev` accepts an explicit registered-device table, externally approved Ed25519 public keys and SPKI SHA256 pins, an owner-managed fixed-target `send()`, and a host clock. It checks public-key type, pinned fingerprint equality, unique per-device public keys, and rejects keys for unregistered devices before any transport.
2. No network requests, dynamic URL, Agent private source, raw tokens, shell, file writes, service registration or automatic probes in the shipping code. Its only outbound request argument is `{deviceId,operation:AICC_SIGNED_HEALTH_CHALLENGE_V1,challenge}`; it leaves networking/authentication to a separate independently approved service owner. Calls start only on explicit `refresh()`.
3. The existing cryptographic verifier checks nonce freshness, device ID, pinned Ed25519 signature, signed degraded response, and rejects unsigned/large/invalid responses. 4-device fixtures are synthetic; **matching a caller-provided pin is not independent enrollment evidence**.
4. Dedicated CI includes a **real local HTTP request/response UAT** bound to `127.0.0.1`, ephemeral port and generated test-only Ed25519 keys. It never queries the real 8791 Agent or ChatGPT protected data, and never installs a daemon.
5. Source CI denies privileged IO or actual network access in shipping module. CI may open loopback server only from a standalone isolated test.

## Separate Owner/service-manager gates before genuine four-device signed health
- Service owner must independently authorize installed Agent proof handler, issue device-bound trusted Ed25519 key enrollment records and pin them outside GitHub/private chat.
- Register fixed allowlisted signed-health operation through existing formally authorized Agent/Gateway transport; do not use a generic `start_process` to bypass protected legacy source denial, or treat hostname selftest/200 HTTP as signed health.
- Dev-only real four-device UAT must show `reachable / degraded / unreachable / unknown / stale` accurately, including 007windows and Windows PowerShell UTF-8. Any production deployment, Agent replacement/READY restart and R2-B recovery/Canary require separate authorization and actual R2-A legacy backup readiness.
- Never reroute safety-blocked calls to Primary/old DC. Old commercial Desktop Commander provider quota exhaustion is separate and not fixed by this code.

**Explicit result limitation:** `LOCAL_LOOPBACK_SIGNED_WIRE=TEST_ONLY`; `REAL_INSTALLED_SIGNED_AGENT_ENDPOINT=UNVERIFIED`; `SIGNED_OWNER_KEY_ENROLLMENT=NOT_DONE`; `PROD_GATEWAY_STATIC_READY=UNCHANGED`; `AGENT_PRIVATE_BACKUP=NO`; `R2B/CANARY=STOP`. 
