# AICC-DC-TERMINAL-PARITY-V1-001 — Terminal Compatibility (isolated)

Status: `OWNER AUTHORIZED / ISOLATED IMPLEMENTATION`
Owner scope: "授权，推进" in the dedicated DC Terminal Parity thread (2026-10-15), following the 2026-10-15 Handoff and same-machine test matrix.
Authority: `origin/main@844bcdecb0c3360ef6f67c662b461001fa2840a6`
Branch: `feature/aicc-dc-terminal-compat-v1-20261015`
Canonical evidence: https://github.com/beyourlovercom/aicontrolcenter/issues/67#issuecomment-6189265572

## Responsibility / provider route
- GPT: work-package scope, review, exact-SHA gates and STOP.
- **Owner 2026-10-15 explicit override:** `CODEX_GOVERNED` only for this narrowly bounded four-file terminal-argument adapter and deterministic regression tests. GPT routing reason: Owner explicitly declined renewed Claude authentication and instructed `只需要 codex`; the scoped task is a pure argument transformation with no service/runtime/authorization changes. This is a documented narrower provider exception under `AI-EXECUTOR-GOVERNANCE-V2`; it is not a general policy override. `AICC_EXECUTION_CLASS=IMPLEMENTATION`, fixed branch/authority/allowlist and independent review are still mandatory.
- Deterministic/offline tests and exact-head review do not substitute for production Owner UAT.
- One writer, isolated worktree; never modify or clean an existing dirty checkout.

## Verified observations (do not exaggerate)
- Official Desktop Commander and self-hosted OAuth both execute basic zsh/PowerShell commands, REPL interaction, stdout/stderr, exit codes and verbose timing.
- Self-hosted delegated `start_process` without `timeout_ms` produced a missing-number validation error; with `timeout_ms:3000` it succeeded.
- Public historical Agent code passes `input.arguments || {}` directly to its downstream `callTool`. Current `main` A4 candidate delegates approved calls, but **the GitHub historical files are not verified as the bytes of every current running Agent**.
- Tail-page extra blank line, cancellation signal, and initial REPL-exit message remain observed but upstream-unresolved.

## Authorized implementation scope (exact whitelist)
1. `scripts/byl-remote-mcp/official-parity-terminal-compat.mjs` — pure no-I/O normalization for *already authorized* `start_process` only, injecting a bounded `timeout_ms:3000` **only if absent**, preserving explicit values; fail closed for invalid or unexpected inputs.
2. `scripts/byl-remote-mcp/official-parity-terminal-compat.test.mjs` — synthetic tests for safe default, no privilege broadening, other tool pass-through, nonmutation, explicit timeout preservation and bad input denial.
3. `scripts/byl-remote-mcp/official-parity-oauth-runtime-surface.mjs` — integrate the helper **only after** existing Cloudflare principal's `authorizeRemoteCall` and audit have succeeded. Preserve internal Bearer semantics, all four legacy tool names, direct Core-5 permission gates and the original agent transport.
4. `scripts/byl-remote-mcp/official-parity-oauth-runtime-surface.test.mjs` — SDK/mocked transport contract tests: authorized omitted timeout receives 3000; explicit 8000 remains 8000; denial/failed audit still blocks delegation; internal Bearer unchanged.

## Hard exclusions / STOP
- No edits to `mcp-endpoint.mjs`, `dc-agent-*.mjs`, actual launchd services, operator-policy, Cloudflare, secrets, endpoints or machine/system settings.
- No production OAuth cutover, device restart, live process termination, unrestricted shell tool discovery, external real-business data, or network changes.
- No tail-log trimming or invented `SIGTERM` state without actual Agent schema/provenance proof.
- No automatic merge, Ready-for-Review, deployment, Owner UAT PASS or A4.1 OAuth Canary modification.
- No additional runtime tool names / privilege changes.

## Verification / delivery
- Verify syntactic validity and isolated Node tests; test existing `official-parity-*.test.mjs` with pinned dependencies when possible.
- Create Draft PR against `main` only; await CI on exact branch HEAD and independent Owner authorization for merge/deploy.
- If runtime/source parity cannot be established, retain the candidate as **not live** and record the unresolved source reconciliation gate.

## Follow-ups deferred, not claims of fixes
- Upstream cancellation/exit reason fidelity requires the authoritative Agent process schema.
- Output pagination must preserve intentional final stdout empty lines.
- A typed `cwd` option is not in current public tool schemas; shell `cd` already works.
- Windows identity mapping and PowerShell encoding require separate evidence.

## 2026-10-15 governed implementation attempt and blocker
- Official DC US Mac mini: `claude --version` returned Claude Code `2.1.252`; a dedicated, clean worktree was created for the exact branch without changing the existing dirty checkout.
- Structured launch provided required `AICC_WORK_PACKAGE_ID`, `AICC_PROVIDER_ROUTING_DECISION=CLAUDE_CODE`, `AICC_EXECUTION_CLASS=IMPLEMENTATION` and `AICC_PROVIDER_ROUTING_REASON`; requested default Sonnet 4.6 and scoped edits only.
- Governed launcher exited before implementation with: `Failed to authenticate: OAuth session expired and could not be refreshed`.
- Postflight: isolated worktree clean at commit `6765cf92c3bac01fbbf2d4c78c961a2ed54826c4`. No implementation files edited, no tests/CI claimed, no non-governed fallback used.
- Next prerequisite: Owner reauthorizes/reconnects the existing US Mac mini Claude Code session through the normal official login flow. Do not request or transfer tokens. Then resume the same WP and branch, preserving Writer and merge gates.

## 2026-10-15 owner provider correction
- Claude Code authentication is no longer a prerequisite or action item for this branch. Owner explicitly selected Codex instead. Preserve the prior failure only as historical evidence, not the current gate.
- Only a governed Codex invocation scoped to this exact WP/worktree can implement the four allowed files; no non-governed bypass, no wide shell execution or extra write permissions.
