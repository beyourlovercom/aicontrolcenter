# AICC V3-B — Dev-only typed DC adapter contract

**Status:** Isolated Dev mock implementation; **no real automatic DC dispatch**. Work package: AICC V3-B (distinct from Stable R9–R13). Base main: 6cd4101e5e418388a145185022340140e1070aed.

## Contract and boundaries
- Planner produces an intent. AICC policy and independent Owner authority must decide. The adapter never trusts request-body ownerApproved or model claims.
- Module: v3/lib/dc-auto-adapter-dev.mjs; all executions use injected SYNTHETIC_MOCK transport. No OAuth credentials, remote client, device calls, shell, subprocess or generic commands are implemented.
- Two distinct opt-in flags are required in tests: AICC_EXECUTOR_GOVERNANCE_V3_ENABLED=1 and AICC_DC_AUTO_ADAPTER_DEV_MOCK=1. These flags **never** authorize real dispatch.
- Mock state and AICC_V3_HOME must be distinct isolated /tmp/aicc-v3b-* paths. The /tmp sticky-parent top-level directory must be owned by the current process UID and mode 0700; descendant components are checked with lstat and symlinks rejected before work-store access. A malicious process already running as the **same OS user** is outside the Dev mock isolation threat model and must be considered separately before real dispatch. No reads of live ~/.aicc-v3 or protected files.
- Typed operations: TEST_ONLY/REPOSITORY_STATUS; TEST_ONLY/SCOPED_TEST_SUITE (suiteId V3_ADAPTER_TESTS or V3_COMPAT_TESTS); CODE_CHANGE/REVIEWED_PATCH_BUNDLE (exact artifact SHA-256). These are labels to the synthetic simulator, not executable commands.
- Plan binds requestId, projectId, repo identity, exact worktree, branch (not main), HEAD, clean status, Work Package, Task, device ID, executionClass, operation, suite/artifact, timeout and planHash.
- A separate **test-only injected** authority returns SYNTHETIC_TEST_AUTHORITY grant tied to requestId, planHash, device, nonce and expiry; it must be valid and unrevoked. It cannot replace signed production approval.
- READY registration is insufficient. Mock also requires separately injected synthetic signed-health value; no real health claim is made.

## State / audit / recovery
- Persistent file records: requests/<requestId>.json, nonces/<nonce>.json and a per-project exclusive active-lease.json under an isolated mock root. Different request IDs cannot execute concurrently for one project.
- States: DISPATCHING → COMPLETED (validated synthetic result) / STOPPED (failure) / UNCERTAIN_STOP (timeout, expiry, revocation, lost health or crash recovery). Best-effort AbortSignal is sent to synthetic transport, but an unacknowledged operation never counts as success.
- Idempotent request replays read stored terminal receipt; requestId with different planHash is a conflict. Atomic nonce and project-lease creation prevent replay/concurrent requests. AICC isolated Dev server startup scans **all project-keyed mock queues** and converts incomplete executions to UNCERTAIN_STOP, **not replayed**; in-flight lease stays quarantined until recovery. Expiry/revocation are checked again after the synthetic result.
- Public audit metadata: requestId, taskId, workPackageId, project/repo, deviceId, branch/HEAD, operation/class, timeout, synthetic approval source, nonce hash, state, error code, result digest. Never log tokens, private policy, credentials, arbitrary result text or shell commands.
- Read-only HTTP route GET /api/dc-adapter/status exposes OFF versus ISOLATED_DEV_MOCK and hard-coded realDispatch: STOP. There is no HTTP POST dispatch route.

## Required STOP matrix
- Feature OFF / non-isolated path, invalid operation/arguments, Claude or Codex selection, main/dirty/HEAD/worktree/repo drift, missing task/WP or unknown device.
- Missing/forged/expired/revoked synthetic grant, READY-only/unsigned/unavailable device, absent mock transport, duplicate nonce or request-ID conflict.
- Invalid receipt, transport error, timeout, inflight request, crash recovery. Real DC dispatch remains DC_AUTO_DISPATCH_NOT_AUTHORIZED in existing V3 gate.
- External Service OAuth, real signed health and Owner attestations are not implemented here and belong to the separate authorization Canary gate.

## Owner gates and deployment
- DEV mock tests / code and Draft PR only are in scope. Ready for Review and main merge require independent Owner Dev UAT PASS and exact-head authorization.
- Real auto-dispatch requires separate Owner permission, credible identity/authorization source, device and command allowlist, ability to revoke and real canary limits. **No implementation may copy formal OAuth credentials out of ChatGPT**.
- Production V3/adapter enable, Agent/Gateway/OAuth changes, READY device restart, protected backup, real signing and Stable R9–R13 are out of scope.
- Rollback: revert this Draft PR or disable AICC_DC_AUTO_ADAPTER_DEV_MOCK; no production data/state has been changed. Retain separate mock receipt directory only for audit as permitted.

## Validation
- Run npm test at repository root and npm --prefix v3 test. Existing V3 base tests must remain passing. New mock suite covers default OFF, preflight, mock receipt, replay, nonce, private-root and symlink isolation, project lease, in-flight TTL, multi-project startup recovery, timeout and HTTP STOP.
- SECURITY_REVIEW: Codex may review changed Dev source read-only; a sandboxed review is not equivalent to a real-device execution test.
