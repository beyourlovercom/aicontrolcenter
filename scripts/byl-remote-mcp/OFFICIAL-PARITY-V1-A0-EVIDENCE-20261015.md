# DC Official Parity V1 — A0 Evidence and A1–A4 Gates
Date: 2026-10-15. Issue [#67](https://github.com/beyourlovercom/aicontrolcenter/issues/67); Draft PR [#68](https://github.com/beyourlovercom/aicontrolcenter/pull/68).

## Purpose
Match the **daily useful operation experience** of official Desktop Commander while keeping the self-hosted four-device OAuth gateway stable. It does not attempt to clone the official managed cloud application or bypass ChatGPT safety protections.

## A0 read-only observed tool matrix
- Official connected Desktop Commander: **31 named top-level tool APIs**.
- Connected self-hosted formal OAuth MCP: **4 top-level tools**: remote_list_devices, remote_list_tools, remote_call, remote_process_selftest.
- Self-hosted `remote_list_tools(us-macmini)`: **24** advertised downstream DC tools; **23** names overlap the official 31. One additional downstream name is `get_prompts`.
- Eight official top-level names absent from downstream list: list_devices, who_am_i, get_tool_result, list_remote_tool_calls, ping, shutdown, set_config_value, force_terminate. Some (list_devices, ping) may be implemented at the gateway level; not all eight should be cloned or enabled. In particular, shutdown/force_terminate are **not V1 read-only targets**.
- Custom static `remote_list_devices` returns four `READY` values, not signed evidence. Official `list_devices` reports its *own* independently connected endpoints; do not treat a provider-state mismatch as a self-hosted outage.
- Formal MCP fixed read-only `remote_process_selftest` on `us-macmini`, `china-mac`, `windows`, `007windows` succeeded on 2026-10-15. Fourth Windows hostname text showed console encoding artifacts, but the read-only operation succeeded. This probe does **not** establish signed-agent health and must not be silently labeled as such.
- Both connected apps are set to `Allow all actions` at app permission level. This does not override platform safety checks, and a previous refused `GitHub.update_file` request was **not** a self-hosted OAuth MCP denial.

## A1 direct read-only names — GitHub-only candidate
`official-parity-read-tools.mjs`: `dc_read_file`, `dc_list_directory`, `dc_get_file_info`. Exactly four device IDs, strict per-tool arguments; URLs, injected operation names, oversized outputs and arbitrary shell excluded. Every operation invokes a **trusted existing** `authorizeRemoteCall(principal,device,name,args)` before the injected delegate. Operator Policy is not bypassed. This candidate **does not register into a running server**.

## A2 truthful health — reuse existing V2, no new Agent
`official-parity-signed-health.mjs`: `dc_list_devices_live`, `dc_ping`. Uses existing `remote-v2-live-health.mjs` (TTL/timeouts/deduplicated concurrency) and `remote-v2-signed-health.mjs` (Ed25519 signed challenge, device identity, nonce/time checks). Requires independently pinned per-device public keys, trusted fixed-target transport and server-side authorization. No key provisioning, live signed endpoint or public tool registration has occurred.

## A3 diagnostics
`official-parity-session-tools.mjs`: direct **read-only** `dc_list_sessions` and `dc_list_processes`; no start_process, kill, force_terminate, or session writes. `official-parity-failure.mjs`: redact arbitrary backend text, classify policy/auth/device/transport/response failures and never automatically repeat an uncertain write.

## A4 actual UAT gates, NOT yet passed
1. Reconcile current US Mac mini `/oauth/mcp` installed code (including 007windows operator/source deltas) to canonical GitHub without blindly copying historical PR #51. Confirm current public route/source.
2. Verify production ChatGPT application supports operator-reviewed discovery of *named* read-only tools. Do not rely on CI or server mocks as proof.
3. Confirm direct reads on all four devices, original remote_call semantics unchanged, identity/ACL failure test, no mass process commands, and expected error codes. Verify health is **cryptographically signed**, no static READY. Avoid legacy DC restart.
4. Real owner desktop/Windows UAT and mobile-facing diagnostic review where appropriate. Owner PASS and exact-head PR merge authorization are independent; no automatic merge or live deployment.
5. Explicitly exclude Dev Deployment OS (PR #66), WWW/ERP/Production, business data, mail, payment and all READY restarts from this branch.

## Expected operating behavior
- Fast common remote operations can use a single typed tool selection when officially activated, while existing delegated `remote_call` remains compatible.
- Signed health reports `reachable/unreachable/degraded/unknown`, with verification flag, observation timestamp, bounded latency and cache freshness.
- Errors are attributed to their observed layer; a refusal before a tool is called cannot be relabeled as an Operator failure.
- CI tests are **offline only**. All live integration and official tool registration are separate authorization gates.

## Roadmap
A0 audit: DONE. A1–A3 isolated implementation: CANDIDATE / CI. A4: BLOCKED on official registration and owner UAT. Initial engineering estimate 18–29h is not elapsed time and excludes external review.


## A4 staged compatibility implementation (2026-10-15)
- **A4.0 (core-only first):** \`registerOfficialParityV1()\` is disabled by default and now registers precisely **five** read-only tools in \`mode='core'\`, without requiring unprovisioned signed Agent response endpoints or pinned public keys. Existing four \`remote_*\` handlers are preserved by the same-session mocked SDK integration test. The live production service is NOT connected to this module yet.
- **A4.1 (signed health later):** \`mode='signed-health'\` may register the additional two health tools ONLY when the *trusted server integration*, not an end-user request, supplies \`signedAgentEvidenceVerified:true\` and an independently authorized monitor. Missing or false evidence rejects before any tool registration. The boolean is an isolated integration signal, NOT a replacement for real per-device signed response verification, key enrollment, and Owner approval.
- **Required operator review:** the running \`getServer(principal)\` in the installed OAuth endpoint constructs the MCP SDK Server per authenticated HTTP request. New tools must only be attached within that same trusted server/request context, using the exact principal from \`resolveAccessPrincipal\` and the installed \`authorizeRemoteCall\`, without altering the four existing \`remote_*\` handlers. Historical PR #51 lacks current 007windows source and must not overwrite it.
- **Live activation blocker:** GitHub main still lacks the installed production OAuth runtime source. Any source parity reconciliation / tool registration / OAuth app refresh / deployment is a separate authorized change and is NOT implied by CI PASS, Public repository visibility, or this Draft PR. No READY restarts.
