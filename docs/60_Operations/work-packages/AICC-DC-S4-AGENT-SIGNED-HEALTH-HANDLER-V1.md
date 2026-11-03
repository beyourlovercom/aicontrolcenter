# DC S4 — Agent-side signed-health handler Dev-only (no service deployment)

**Purpose:** prepare the actual *Agent-side* signing/validation contract while leaving all installed Agents, Gateway, OAuth apps, READY devices, and protected private legacy source untouched. Reuse GitHub main's `remote-v2-signed-health.mjs`; do not implement a competing Ed25519 wire schema.

## Dependency / split branch safety
- Canonical main currently `581ff4300d401e2d7baa6d490d01b91fb7b212ef` includes S1 PR #90 verified availability and the V2 signed proof helper.
- **PR #91** S2 fixed-target wire: Owner code UAT PASS, exact head `1a9fb3891368be5027ca98556086264d1c39f47a`, **NOT MERGED**.
- **PR #92** S3 issuer/public key enrollment candidate: Owner code UAT PASS, exact head `23cfcf26a006b8a804c71b39bba195599cb1a727`, **NOT MERGED**.
- This new S4 branch is independently created from main. It imports neither unmerged branch, although its fixed operation `AICC_SIGNED_HEALTH_CHALLENGE_V1` intentionally agrees with the S2 proposal; before any future integration, owner must verify exact version/schema compatibility and order of separately authorized merges.

## Authenticated Agent-side handler — explicit prerequisites
1. A **service-owner-provided** per-device Ed25519 private signing KeyObject, only in approved OS secret key custody. This component **never creates, reads, exports or logs private keys**. The test suite generates ephemeral private keys for localhost mock proof only.
2. `authenticateGateway` is a mandatory injected callback that must cryptographically verify actual Gateway credentials/signature or an independently approved equivalent. A raw HTTP 200, static READY, mere header presence or user-input `authContext` alone **is not authorized Gateway verification**. This code cannot prove the callback is genuine; that requires separate trusted service integration and request provenance auditing.
3. `measureLocalState` must be supplied by a real approved local Agent health monitor and return explicit `ready` or `degraded`. No default ready. If missing/error/unknown => fail-closed, no signed healthy proof.
4. Challenge fixed device ID, fixed `AICC_SIGNED_HEALTH_CHALLENGE_V1` operation, existing protocol `BYL-DC-HEALTH-V1`, bounded nonce/time/size, in-memory anti-replay and bounded attempts/timeout. Auth must PASS before local state measurement; nonce reserved before awaiting readiness to reject concurrent replay. Signed response is produced by existing `signHealthResponse` and verified by existing `verifyHealthResponse`.
5. **Replay limitation:** per-process memory cache has no persistence/replication. Future service release must prove one active instance *or* use authorized shared atomic replay ledger. Restart permits nonce-cache loss; short 10 s challenge window still bounds it. This Dev module is **NOT** deployment-ready.
6. Source CI rejects network/process/filesystem operations in shipping handler; a standalone test hosts a bound `127.0.0.1` ephemeral mock HTTP server with **synthetic generated keys** and tests authorized/unauthorized requests. It does not visit live port 8791.

## Next genuine Owner/service security gates
- Independently legitimated source/release procedure and recoverable R2-A backup for legacy Agent (Issue #85); prior blocked protected Agent file access must not be bypassed.
- Real dedicated agent/issuer public fingerprint custody and witness attestations (future S3 promotion gate), service-owned signer KeyObject provisioned by OS/admin with least privilege.
- A reviewed, authorized Gateway authentication adapter and true local health source for four independent Agent processes; parity with PR #91 request operation; transport fixed targets only.
- Isolated Dev-only four-device signed health UAT incl 007windows offline/restore and PowerShell UTF-8, expiry/replay/forgery/failure categories before *any* production release authorization.
- Explicit exact-head Owner GitHub main-only merge authorization independently required for #91, #92 and this future PR. No silent merge/rollout.

**No production write, secret read, Agent restart, old DC quota retry or OpenAI safety bypass.** `S4_CODE_ONLY=YES`; `ACTUAL_AGENT_SIGNED_HANDLER_DEPLOYED=NO`; `REAL_DEVICE_KEYS=NO`; `REAL_FOUR_DEVICE_SIGNED_UAT=NO`; `R2A_OLD_AGENT_BACKUP=NO`; `R2B/CANARY=STOP`.
