# DC Remote V2 — Phase A source governance candidate (2026-10-12)

Status: **AUDIT CANDIDATE ONLY**. Base: GitHub main `b7302620a054c7264f23606aef340533f108ae5a`. No executable Gateway, Agent, Router, or health endpoint changes in this candidate.

## Verified provenance
- Existing main contains `remote-v2-live-health.mjs`, `remote-v2-signed-health.mjs` and tests from merged PR #58. This is library-level evidence, not deployed live health.
- `feature/byl-remote-mcp-v1` contains candidate `gateway.mjs`, `device-router.mjs`, `dc-agent-macos.mjs`, `dc-agent-windows.mjs`, `health-monitor.mjs`; branch has diverged from main (ahead 27, behind 48). Do not merge the whole branch.
- PR #51 still targets `feature/byl-remote-mcp-v1`, not main. OAuth source and route policy remain a separate exact-HEAD Owner merge gate.
- The historical runtime SHA-256 evidence in `REMOTE-DC-V2-RUNTIME-PROVENANCE-20261012.md` describes one audited checkout, not current deployed process identity on all three devices.

## Source review gate
1. **No private topology in source:** relocate peer addresses, machine-local runtime paths and token-file paths to deployment-owned configuration; enforce fixed, validated device identity and upstream allowlists. Do not publish any real configuration values.
2. **Gateway and OAuth separation:** retain official `/oauth/mcp` behavior and independent legacy `/mcp` behavior. No router, auth, DNS, Cloudflare or runtime switch in this PR.
3. **True health:** registered devices must never be labelled live READY without verified signed challenge/response. Verify Ed25519 against pinned per-device key; identity binding, timestamp/nonce freshness, replay resistance, timeout and TTL are mandatory.
4. **Agent protection:** authenticated incoming Gateway requests, fixed peer restrictions and non-public signing-key lifecycle; signing keys are not checked into GitHub or logged. Any restart endpoint needs distinct explicit authorization and must not be invoked for health checks.
5. **Observability:** bounded, redacted, data-minimal status events; no raw response bodies, credentials or personal content in logs.
6. **Parity evidence:** compare sanitized canonical source hash to audited runtime provenance and verify actual executing per-device binary/config versions through independently permitted read-only attestations; record mismatch as UNKNOWN, not PASS.
7. **Test gate:** isolated syntax/unit tests; explicit offline, degraded, stale, restore, tampered, replay and cached state cases; three-device real Owner UAT only after separately authorized runtime integration.

## Approval gates
- This branch is for documenting source review and preparing isolated candidate work; it does not claim V2.0 completed.
- Any executable source PR must exclude environment values, include isolated test evidence, and target main.
- GitHub PR merge requires independent Owner exact-head approval. Production Agent/Gateway install, persistent private key enrollment, network changes and any READY-service restart each require independent approval.
- Production OAuth remote execution has returned `OPERATOR_TOOL_DENIED`; do not switch tools, routes or endpoints to circumvent this.
- Only update AICC Notion Roadmap. Do not write BYL Website Notion data.

Tracking: Issues #57, #59, #56.