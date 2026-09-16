# Work Package: AICC-V5-PROVIDER-ROUTING-V1-001

Status: `IMPLEMENTATION_COMPLETE — PENDING_OWNER_UAT`

Branch: `feat/aicc-v5-provider-routing-v1`

Base authority: `AI-EXECUTOR-GOVERNANCE-V2.md` (ACTIVE, 2026-09-15)

## Scope

Restore the smallest trustworthy remote-Claude execution path in AICC V5 by:

1. Adding GPT-supplied provider routing intent to the Next-Step protocol.
2. Validating provider metadata in the browser bridge parser and receipt ledger.
3. Implementing a typed Remote Runner service / HTTP transport for `CLAUDE_CODE` execution.
4. Routing `CODE_CHANGE` decisions to the Remote Runner and `TEST_ONLY` decisions to the frozen Codex path.
5. Adding remote runner readiness projection to the server executor status endpoint.

## Files Modified / Created

| File | Change |
|------|--------|
| `v3/lib/provider-routing.mjs` | NEW — type constants and `validateProviderDecision` |
| `v3/lib/remote-runner-service.mjs` | NEW — `createRemoteRunnerService`, path validation, DRY_RUN, worktree lease |
| `v3/lib/remote-runner-client.mjs` | NEW — `RemoteRunnerClient` HTTP client |
| `scripts/aicc-remote-runner.mjs` | NEW — standalone HTTP server bound to AICC_RUNNER_HOST |
| `v3/lib/next-step-runtime.mjs` | MODIFIED — adds `AICC_PROVIDER` + `AICC_PROVIDER_ROUTING_REASON` to prompt; validates in `recordNextStepReceipt` |
| `v3/lib/bridge-runtime.mjs` | MODIFIED — routes CLAUDE_CODE to remote runner in `submitBridgeRequest` |
| `v3/server.mjs` | MODIFIED — adds remote runner readiness to `/api/executor` |
| `v3/browser-bridge/core.mjs` | MODIFIED — `parseNextStepDecision` extracts provider fields; `requestBody` propagates them |
| `v3/browser-bridge/content.js` | MODIFIED — `completeNextStepProtocol` requires `AICC_PROVIDER` for EXECUTE |
| `v3/browser-bridge/background.js` | MODIFIED — passes `executionProvider` from decision through `enqueueAction` |
| `v3/tests/provider-routing.test.mjs` | NEW — routing validation unit tests |
| `v3/tests/remote-runner-service.test.mjs` | NEW — service unit tests (path escape, worktree, lease, DRY_RUN) |
| `v3/tests/remote-runner-api.test.mjs` | NEW — HTTP server tests (peer IP allowlist, submit/get, rejection) |
| `v3/tests/next-step-provider-routing.test.mjs` | NEW — next-step prompt fields + receipt validation tests |

## Invariants

1. **GPT decides provider** — AICC transports the decision, never infers it from prose.
2. **Fail closed** — missing or invalid `provider`/`executionClass`/`providerRoutingReason` for `EXECUTION_QUEUED` throws `NEXT_STEP_RECEIPT_PROVIDER_MISSING` before any executor launch.
3. **Remote Runner binds to explicit host** — `AICC_RUNNER_HOST` is required; startup aborts if missing.
4. **Path escape rejected** — `remoteRepositoryRoot` must be under `AICC_RUNNER_ALLOWED_ROOT` after realpath normalization; path escape throws `REMOTE_RUNNER_PATH_ESCAPE`.
5. **Exact Git identity required** — Remote Runner verifies origin repository identity, non-detached branch, and exact expected HEAD before execution.
6. **Governance env vars always injected** — `AICC_WORK_PACKAGE_ID`, `AICC_PROVIDER_ROUTING_DECISION=CLAUDE_CODE`, `AICC_EXECUTION_CLASS`, `AICC_PROVIDER_ROUTING_REASON` are always set before model launch; escalation evidence is allowlisted.
7. **CLAUDE_BIN is fixed** — Remote Runner always calls `/opt/homebrew/bin/claude`; the binary is not configurable.
8. **Canonical lease** — Claude leases are keyed by `repositoryIdentity#branch`; persisted execution state survives runner restart and active records recover as `UNCERTAIN` without replay.
9. **Cross-provider exclusion** — Claude submission rejects an active local Codex lease; local Codex submission checks Remote Runner active leases before start.
10. **Result closure** — a completed Remote Claude execution is validated, persisted as a provider result, materialized into canonical Bridge Delivery, and delivered through the existing claim/receipt path.
11. **DRY_RUN canary** — `dryRun: true` passes `AICC_CLAUDE_GOVERNANCE_DRY_RUN=1` to the governed Claude entrypoint and uses a canary instruction.

## Cross-Provider Lease Closure

Cross-provider isolation is implemented at both execution boundaries. Remote Claude submission first checks the local Codex lease and fails closed with `BRIDGE_WORKTREE_LEASE_CONFLICT`. Local `/api/runs` submission queries Remote Runner active leases and fails closed with `EXECUTOR_REMOTE_CLAUDE_LEASE_CONFLICT` for the same canonical repository identity + branch.

Remote Runner also persists execution metadata. If the runner restarts while an execution was active, that execution becomes terminal `UNCERTAIN` and is never replayed automatically.

## CLAUDE_CODE Result Delivery Closure

Remote Claude execution now participates in the full Bridge delivery cycle. A validated `COMPLETED` record with exact result content/hash is persisted as `aicc.v3.bridge-provider-result.v1`, materialized into canonical Bridge Delivery, claimed by the browser bridge, and closed through the existing receipt protocol.

`FAILED`, `UNCERTAIN`, and invalid completed-result records project to terminal browser ledger states (`RUN_FAILED` / `RUN_UNCERTAIN`) instead of remaining in `WAITING_RESULT` indefinitely.

## UAT Contract

### Canary DRY_RUN (zero model quota)

Pre-conditions:
- Remote runner started: `AICC_RUNNER_HOST=127.0.0.1 AICC_RUNNER_PORT=8787 AICC_RUNNER_ALLOWED_ROOT=/path/to/allowed node scripts/aicc-remote-runner.mjs`
- `AICC_RUNNER_HOST=127.0.0.1` set in server env

Steps:
1. Submit bridge request with `executionProvider: {executionClass:'CODE_CHANGE', provider:'CLAUDE_CODE', providerRoutingReason:'WP-001 DRY_RUN canary'}` and `dryRun: true`
2. Observe `REMOTE_CLAUDE_EXECUTION_BOUND` in bridge events
3. Poll `GET /v1/executions/:id` on remote runner
4. Observe state transitions QUEUED → RUNNING → COMPLETED
5. Confirm governance env vars in claude process env (via wrapper audit log at `~/.aicc-remote/CLAUDE_MODEL_DISPATCH_AUDIT.jsonl`)

Pass criteria:
- `AICC_PROVIDER_ROUTING_DECISION=CLAUDE_CODE` in dispatch audit
- `AICC_CLAUDE_GOVERNANCE_DRY_RUN=1` set
- No model quota consumed (dry run acknowledged by wrapper)
- `TEST_ONLY` decision submits via Codex path (existing behavior unchanged)

### Human UAT PASS

Human UAT PASS is NOT claimed by this WP. Owner must verify the canary evidence independently.
