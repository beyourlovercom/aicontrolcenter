# DC Official Parity A4.1 — OAuth Runtime Canonical & Release Gate
Date: 2026-10-15. Tracking: AICC [Issue #67](https://github.com/beyourlovercom/aicontrolcenter/issues/67), merged [PR #68](https://github.com/beyourlovercom/aicontrolcenter/pull/68), isolated Draft PR #69.

> **State:** GitHub-only candidate, synthetic CI, not merged/deployed. An HTTP app constructor, NOT a production service launcher. A4.1 Owner authorization exists, but the exact-head code merge, validated service rollback and live registration remain separate execution gates.

## 1. Single source and separation
- GitHub `beyourlovercom/aicontrolcenter` `main` is the only eventual target for canonical code. PR #68 merged to `533874b47923e266bb199aa91ece92018ff274bd`.
- This branch adds `official-parity-a4-http-runtime.mjs`: a **no-listen, no-secret, request-local** OAuth/HTTP app constructor; and `official-parity-a4-signed-agent-client.mjs`: a signing transport constructor with **externally injected** four-device routes and key.
- The installed US Mac mini four-file runtime has been compared *read-only* to the historical branch: access auth + endpoint routing were equal, endpoint/operator policy only had 007windows and bounded device-ID changes. **Do not copy raw installed entrypoint or operator-policy paths into this Public repo.**
- The runtime retains approved four-device identities: `us-macmini`, `china-mac`, `windows`, `007windows`. The connected self-hosted OAuth still advertises **zero** direct `dc_*` names until a real service rollout and supported ChatGPT app discovery.

## 2. Private dependency contract
The service owner supplies these values from **private service configuration**, never GitHub or PR comments:
- internal bearer secret, Cloudflare Access issuer/audience and user allowlists, actual bound identities
- existing fixed device transport targets and gateway Ed25519 signing private key
- exact runtime authentication functions (`getAccessConfig`, `resolveAccessPrincipal`) and the *installed* Operator Policy functions (`canExposeRemoteCall`, `authorizeRemoteCall`)
- gateway `agentGet`/`agentCall` (or reviewed injected signed transport constructor), plus real acknowledged redacted legacy/new audit sinks
- reviewed allowed hostnames and the currently approved endpoint routing contract

**Public source must contain no** bearer, PEM, Tailscale/device IP values, local service home directory path, Cloudflare audience identity, employee emails or environment secret values. No tools print resolved private config.

## 3. Contract checks before any deployment
- Exact production-compat setting: `BYL_MCP_STAGING=0`, `BYL_MCP_OAUTH_COMPAT_CANDIDATE=1`, `BYL_MCP_PRODUCTION_OAUTH_ENABLED=1`, `BYL_MCP_ACCESS_ENABLED=1`; refuse conflicting or missing gates.
- The final existing route is exactly `/oauth/mcp` at loopback `127.0.0.1:8797`; do not bind on public interfaces or accidentally expose legacy `/mcp`.
- The HTTP module has **no `listen()` call**: importing/constructing it makes no network or device calls. Deployment-specific service binding remains a separate reviewed change.
- Existing four MCP tools remain: `remote_list_devices`, `remote_list_tools`, `remote_call`, `remote_process_selftest`. Even when the new flag is ON, a nonoperator receives only the original three read-only names, an internal legacy principal receives four, and an authorized operator receives nine (4 + 5 new).
- The five new tools are exactly `dc_read_file`, `dc_list_directory`, `dc_get_file_info`, `dc_list_sessions`, `dc_list_processes`. Underlying operations must pass installed `authorizeRemoteCall` and a confirmed redacted audit receipt **before** device delegation.
- `dc_list_devices_live` / `dc_ping` remain OFF; signed Agent health requires a different, independently verified device-challenge enrollment.
- Signing constructor accepts only four preconfigured private/loopback IPv4 endpoints on the existing Agent port; GET `/v1/tools` and POST `/v1/call` reuse the observed signed transport format and apply bounded responses without leaking upstream errors.
- Verify 401 unauthorized, 405 non-POST /oauth/mcp methods (after auth), sanitized 500, fixed healthz, and request-abort cleanup; no raw exception details in responses.
- Full CI, dedicated Parity CI, synthetic MCP SDK/HTTP/signature tests, secret scan and exact HEAD must all pass.

## 4. Required service-only release choreography — not executed
1. **Read-only provenance:** identify current service manager and exact running OAuth process/route, four-device transport and original MCP tool inventory; verify current process owner and deployment permissions. Do not interpret static READY as signed reachability.
2. **Private rollback pointer:** establish an exact backup of installed non-public runtime bytes and private environment via authorized service management, verify hash/restore viability and keep restore location private. Record rollback process without publishing secrets.
3. **Code-only initial rollout:** after separately reviewed exact-head merge and service release confirmation, stage the approved candidate behind `BYL_MCP_PARITY_CORE_READ_ENABLED=0`; run smoke against the *existing* service binding and confirm the four old MCP tools unchanged.
4. **Canary activation:** enable core-only flag for the existing authorized OAuth principal using approved service-specific deployment facility; `dc_ping` and signed-health stay disabled. Avoid changing Cloudflare DNS, routes, Access policy, device agents or READY device OS state.
5. **True provider discovery:** explicitly verify the connected ChatGPT OAuth app surfaces five new named tool actions. Back-end MCP registration or offline SDK mock alone is **insufficient**: discovery can require owner app review/refresh or reconnection via supported provider controls.
6. **Owner / operator UAT:** fixed innocuous read-only files / directories and session/process lists on all four devices; compare new and legacy outputs, verify 4-device ACL denials, no key/value or path leakage, 3-tool read-only principal, 4-tool legacy internal principal, audit presence/denial. Record user-visible PASS.
7. **Rollback and stop:** any login error, missing legacy tool, unauthorized exposure, output leakage, 007windows regression or absent audit receipt immediately disables the new flag/reverts service-specific release through authorized manager and confirms old four tools. A device reboot is never a rollback action.

## 5. Explicit non-goals and blockers
- **No device restart**, process kill, arbitrary shell UAT, Woo/ERP/WWW/order/payment changes, or Cloudflare edits. Only service-specific deployment under an approved manager is contemplated.
- The current GitHub A4.1 PR does **not** install a production listener or load production secrets. Deployment requires privately provisioned binding/rollback and verified operator tool path. The earlier connected-tool safety refusals for selected runtime file reads and initial branch creation were platform-layer blocks with no rule ID; they are **not** permission to substitute an unapproved channel or skip the evidence gates.
- PR #66 (Dev Deployment OS) stays paused and separate. PR #68 is already merged; do not redeploy or remerge it.

## 6. Stage closure condition
A4.1 code-preparation complete = exact-head dedicated & Foundation CI success + reviewed Draft PR + no-secret GitHub diff. **A4.1 live complete** is a different claim: authorized service registration + ChatGPT named-tool discovery + four-device Owner UAT + rollback evidence. Until then, continue to report `NOT LIVE`.
