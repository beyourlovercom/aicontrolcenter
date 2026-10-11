# BeYourLover Remote DC V2 — canonical roadmap, 2026-10-11

Owner authorized beginning **V2 isolated development**. No approval to merge a new PR, deploy code, restart READY devices, create a new WordPress plugin, change Cloudflare/DNS, or perform orders/payment/production database writes. GitHub **main is the desired single source of truth**, and all production cutovers remain independently authorized.

## Baseline: G15 Owner PASS
- Production custom ChatGPT plugin \`正式 OAuth MCP\`: \`https://mcp.beyourlover.com/oauth/mcp\` via Cloudflare Managed OAuth and supervised US Mac mini 8797.
- A separately authenticated legacy \`https://mcp.beyourlover.com/mcp\` uses US Mac mini standard MCP 8792; remain compatible.
- China Mac, US Mac mini, Windows all passed **real** \`remote_process_selftest\` on the new production OAuth connector; Windows fixed Dev cart-to-home GUI Canary passed \`verified=true\`.
- Existing OAuth production runtime exposes 4 top-level tools; its Owner \`remote_call\` policy enables **21** delegated DC tools of 24 device-provided tools, subject to device agent's own ACL/audit.
- Known defect #56: \`remote_list_devices\` returns static READY from a registry despite an offline Tailscale peer.
- PR #55 for a redundant new OAuth path is closed unmerged and **must not be used**.

## V2.0 — source and safety parity FIRST
Current GitHub main \`1864f3e1859ada878f4859b2b9266389205c2978\` does **not** track these files currently running from the US Mac mini worktree: \`gateway.mjs\`, \`device-router.mjs\`, \`dc-agent-macos.mjs\`, \`dc-agent-windows.mjs\`, \`health-monitor.mjs\`, \`operator-policy.mjs\`, and \`access-auth.mjs\`. OAuth 8797 production core has a byte-verified PR #51 branch source but PR #51 remains open/unmerged. Running and tracked source must be reconciled, tests/audits added, and separately authorized into main before a V2 production integration. Never commit any token, OAuth secret, private key, identity assertion, local browser cookie or user data.

Deliverable: exact file manifest + source/permission comparison + test coverage + stop/rollback gates. Any PR merge and production release require explicit Owner authorization.

## V2.1 — truthful, signed live health (in-progress)
Separate **configured** status from **reachable** state. Only successful authenticated, device-bound agent responses may establish reachable. Timeout or transport failure means *unreachable at probe time*, not necessarily permanently offline. Stale cache becomes unknown, not READY. Bound per-probe time, concurrency, TTL and in-flight duplication. No probe to arbitrary URLs; fixed device registry only. No secret or private IP returned to ordinary callers.
- New isolated pure module: \`remote-v2-live-health.mjs\` with \`remote-v2-live-health.test.mjs\`.
- Current result: 14/14 base health tests PASS plus 16/16 Ed25519 response challenge tests; 128/128 complete Node suite PASS (including 98 pre-existing tests).
- New isolated signed proof library: remote-v2-signed-health.mjs with per-device public keys, random nonce, bounded signed timestamps, replay and identity mismatch denial, cryptographic verification and explicit degraded status.
- Read-only source-provenance audit: REMOTE-DC-V2-RUNTIME-PROVENANCE-20261012.md. Four 8797 OAuth runtime files SHA-256 byte-match PR #51, while runtime Gateway/Agent sources are still outside GitHub main.
- **NOT integrated into runtime** until new signed agent response endpoints, pinned key enrollment, authorized source parity, code review, Owner UAT and rollback are approved.
- Acceptance: offline/Tailscale-stop produces \`unreachable\` or \`unknown\` with timestamp,恢复 returns \`reachable\`; no false-ready; old MCP calls unchanged.

## V2.2 — durable audited remote jobs
- Stable job IDs, owner identity hash (not email in general logs), per-device nonce, immutable operation hash, verified receipts, bounded retry, audit trail.
- Resume only read-only or provably idempotent stages. Destructive/production writes must stop for explicit owner reapproval, no replay on uncertain outcomes.
- Cancellation must target only a named job, never restart a READY device.
- Acceptance: network lost after a write request produces \`unknown outcome\`, not automatic duplicate execution.

## V2.3 — evidence-backed GUI
- Per-device capabilities discovered independently: scoped Windows Chrome + macOS Chrome/Safari where allowed, screenshot metadata + redacted evidence, safe viewport selectors, explicit domain/profile restrictions, bounded navigation.
- Prefer existing fixed Windows GUI canary as trust baseline. Introduce general GUI controls only after independent security and Owner UAT gates.
- Mobile-first M14 screenshots and image comparison with human acceptance for hard pages.
- No credential screenshots, arbitrary payment/order clicks, CAPTCHA bypass or uncontrolled background browser restarts.

## V2.4 — multi-device orchestration
- Signed DAG plan with per-device resource locks; parallel read-only stages across US, CN and Windows; artifact/checksum handoff with allowlisted project paths only.
- GitHub exact-main review on US → Windows isolated Dev browser test → China Mac mobile screenshot verification → one final evidence report.
- No autonomous cross-environment propagation of secrets or production writes.

## V2.5 — GitHub and deployment governor
- Exact SHA and CI gates, code bundle hashes, backup-restore preflight, single-service restart if explicitly authorized, automatic rollback receipts.
- Existing GitHub main is canonical target; AICC recommendations do not override main; PR merge and production deploy are distinct owner approvals.

## V2.6 — operational dashboard
- True device health (online/unknown/unreachable), signed response latency, short-lived cache, last-verified timestamp, error category.
- Job state (queued/running/paused/blocked/complete), failure evidence, permission policy deny logs (redacted).
- No auto-restart of READY devices; condition-based alerts with cooldown.

## V2.7 — Owner E2E UAT / Closure
- All three registered devices reachability + signed terminal checks, offline/恢复 case, scoped GUI screenshots, job-resume and idempotency, strict permission denials, rollback rehearsal.
- Manual Owner PASS, then independent merge/deploy approval; no claim of V2 production success from isolated tests alone.

## Priority and acceptance gates
V2.0 → V2.1 signed probe integration → V2.2 durable receipts → V2.3 GUI evidence → V2.4 coordinated workflows → V2.5 policy/CI (in parallel with integration) → V2.6 dashboard → V2.7 Owner UAT. Additions to existing repository modules only, **no surprise plugins or agent restart**. This feature branch implements only V2.1's pure contract and tests; production G15 baseline is untouched.
