# MCP Dev Allowlist V1 — authorized integration gate (2026-10-14)

Status: **OWNER APPROVED TO PROCEED WITH SCOPED INTEGRATION**, **NOT LIVE / NOT REGISTERED / NOT INSTALLED**. Related Issue #65, Draft PR #66. Original V2 Issue #57 remains closed.

## What was authorized

Owner message on 2026-10-14: "批准授权" in direct response to the explicitly described next gate: formally register dedicated MCP Dev deployment actions and integrate a **Dev-only** allowlisted receiver. The approval does not authorize an unreviewed production OAuth server modification, an OpenAI platform-safety bypass, merging a PR, changing WWW/ERP/business data, editing Cloudflare/DNS, or restarting any READY device.

## Verified facts

- Production ChatGPT OAuth MCP `remote_list_tools` still exposes the preexisting Desktop Commander generic tools, **not** the proposed four `dev_release_*` actions.
- The repository's `gui-mcp-server.mjs` demonstrates isolated SDK `ListToolsRequestSchema` and `CallToolRequestSchema` registration. The implementation in PR #66 reuses this pattern through **an injectable, verified principal resolver**, a two-level operator authorization check and an exact schema.
- GitHub YBY-Core PR #103 exact HEAD `6dde090de9b4a99b0ffe0963ff2564f8852a1546` had 4/4 successful runs in the latest read-only check; its dependent PR #99 and PR #90 are still Draft and unmerged. This does not establish Dev runtime file identity.
- We have not located a supported ChatGPT or formal OAuth MCP administrative operation that registers new tools into an active MCP server. `remote_call` or generic `start_process` **must not** be repurposed to install this feature when an explicit platform safety gate denies the operation.

## Implemented in isolated GitHub PR #66

1. `dev-allowlist-contract.mjs` — exact Dev environment / project / three-file allowlist, immutable SHA/CI/PR/artifact/Owner-receipt contract; command/path injection rejected.
2. `dev-allowlist-controller.mjs` — two-stage prepare/apply, status, explicit rollback, stage-by-stage reattestation, drift rejection, durable `APPLYING`/`ROLLING_BACK` intents and `MANUAL_RECOVERY_REQUIRED` on incomplete operations. No automatic replays after interrupted mutation.
3. `dev-allowlist-fs-receiver.mjs` — isolated Dev-root filesystem adapter: lstat/symlink checks, staged and backed-up file SHA verification, protected out-of-web-root backups, operator-owned PHP lint hook, per-file atomic rename and exact restoration.
4. `dev-allowlist-durable-store.mjs` — project-scoped filesystem receipt journal and exclusive lock with no automatic stale-lock removal.
5. `dev-allowlist-trusted-authority.mjs` — injected trusted GitHub/CI/Owner/artifact clients with fresh exact PR-head + 4 mandatory CI checks + approved scope/time checks.
6. `dev-allowlist-mcp-tools.mjs` and `dev-allowlist-mcp-registration.mjs` — candidate four exact SDK tools with no arbitrary command executor, operator access check on enumeration and invocation.
7. `dev-allowlist-*.test.mjs` — offline tests in fake and temporary filesystem environments; GitHub Actions `DC MCP Dev Allowlist Contract CI`.

## Required for ACTUAL D4 (not yet accomplished)

- **Formal MCP owner/operator registration route:** Identify and use a first-party supported administration/deployment mechanism for adding precisely the four dev_release schemas to a separately authorized Dev MCP runtime. Production `/oauth/mcp` may only be changed through a separately reviewed change plan that preserves its existing live clients, or use a separately approved Dev-only MCP application. Do not change Cloudflare/DNS or run generic shell commands to circumvent platform blocks.
- **Authenticating OAuth principal:** Implement and audit server-provided verified principal for the SDK adapter. User-supplied JSON identity must be ignored.
- **Trusted Dev receiver deployment:** Provision a *Dev-only* operator endpoint with fixed filesystem base, no arbitrary SSH/shell/URL, approved `artifactResolver` and `phpLint`, and tested out-of-web-root rollback storage. Receiver should have only the file access needed for the three allowed Core paths, not WWW or Commerce.
- **Durable integrity:** Establish persistence, fsync/recovery evidence for receipts and staged backups, exclusive lock across actual receiver instances, correct restart/crash recovery and fail-closed interruption behavior. Never automatically remove stale locks on a READY host.
- **Owner scope:** Issue server-owned, time-bound, path/commit/release-bound approval receipts and verify the protected backing store. Text `批准` is human authorization to start integration, not itself a cryptographic attestation the server can accept as a release token.
- **Current Dev preimages:** Read only the current real Dev runtime and its validated backup pointers. For PR #103, revalidate current GitHub SHA, required 4 CI runs, all three exact Dev paths and potential B1.1 drift. Do not copy entire zip or Commerce.
- **Canary sequence:** `prepare` (no live writes) → verified staging/backup → `apply` with exact approved files → independent checksums, PHP lint, Dev admin roles/legacy URLs, web/cart/checkout read-only smoke → reversible proof → iPhone 14 (~390 px) Owner UAT. A failure stays BLOCKED, not PASS.
- **Separate gates:** Owner exact-HEAD PR merge and any production MCP route changes remain distinct. No production/WWW/ERP deploy, no customer/order/payment/email/subscriber writes, no READY restarts.

## Exact reporting / stop condition

Report `PARTIAL — D0–D3 PASS, D4–D6 BLOCKED` until official tool registration, trusted Dev receiver wiring and actual approved canary evidence exist. CI PASS on an isolated candidate alone never proves deployed availability. If tool support or policy denies registration, record exact error and request the formal administration route; do not retry via Base64, alternate devices, tool renaming or ad hoc SSH commands.

AICC tracking: https://app.notion.com/p/3f95f5efdf94817fa0c4f31b1b0083d4
