# BYL Remote MCP V1 Contract

## Goal
Replace the paid Desktop Commander Remote transport while retaining local execution capability.

## Topology
Internet client -> Cloudflare -> US Mac mini Gateway -> trusted executor backends.
China Mac and Windows remain private behind Tailscale and are never directly public.

## Security invariants
- Public Gateway binds only to 127.0.0.1.
- Cloudflare is the only public ingress.
- Every privileged API call requires a bearer token.
- Gateway never accepts arbitrary upstream URLs from callers.
- Device IDs map to a static allowlist.
- Executors keep their own command/path restrictions.
## V1 API
- GET /healthz: unauthenticated liveness only.
- GET /v1/status: authenticated gateway + executor status.
- POST /v1/executions: authenticated execution submission.
- GET /v1/executions/:id: authenticated execution status.

## V1 devices
- us-macmini: existing AICC Runner on 100.94.52.109:8787.
- china-mac: deferred to R4.
- windows: deferred to R4.

## Failure policy
Fail closed on unknown device, bad token, oversized body, executor timeout, or malformed JSON.
No automatic browser opening. No auth retry loop. No cross-device fallback.
## Current deployment canary
- Local Gateway: 127.0.0.1:8790
- Temporary dual-stack public path: https://erp.beyourlover.com/__byl_remote_mcp
- Reserved final hostname: mcp.beyourlover.com
- Final hostname currently publishes AAAA only; do not cut over until IPv4 A generation is corrected.
- Public health is intentionally non-privileged; all execution/status APIs require bearer auth.
## R3 Device Router
- Canonical device IDs: us-macmini, china-mac, windows.
- Every execution/status lookup requires an explicit deviceId.
- Unknown device IDs fail closed; there is no cross-device fallback.
- us-macmini is READY and routes to the existing US runner.
- china-mac and windows are registered as PENDING_AGENT until R4.
- US Gateway Tailscale probes PASS: china-mac reachable, windows reachable.
## R4 Private DC Agents
- china-mac agent: http://100.102.15.40:8791, peer allowlist = us-macmini only.
- windows agent: http://100.87.29.56:8791, peer allowlist = us-macmini only.
- Both agents are private Tailscale listeners and expose no public socket.
- Both agents use MCP Client + StdioClientTransport to call the local Desktop Commander MCP.
- Cross-device health and tool discovery PASS on both devices: 26 tools exposed.
- Cross-device get_config PASS: China DC 0.2.51 / macOS; Windows DC 0.2.51 / win32.
- All three canonical devices are now READY in the static router.
## R5 Security
- Gateway owns the only Ed25519 private key; China/Windows agents store the public key only.
- Agent privileged requests require: Tailscale peer allowlist + Ed25519 signature + 60s timestamp window.
- Signed canonical form: method + path + timestamp + SHA-256(body).
- Agent tool policy is explicit deny-first for administrative escape hatches.
- R5 deny set: set_config_value, force_terminate.
- Audit logs are JSONL and store timestamp, peer, event, tool, and success only; arguments and secrets are never logged.
- China signed get_config canary PASS; denied tool returned 403.
- Windows signed get_config canary PASS; denied tool returned 403.
## R6 Always-On
- US Gateway: launchd RunAtLoad + KeepAlive, single label, controlled restart PASS.
- China Agent: launchd RunAtLoad + KeepAlive, single label, controlled restart PASS.
- Windows Agent: Scheduled Task BYLRemoteMCPAgent with AtStartup + AtLogOn, MultipleInstances=IgnoreNew, plus Global Mutex.
- Windows watchdog restart backoff: 10 seconds; child crash recovery verified.
- Windows log rotation threshold: 5 MiB for watchdog/stdout/stderr/audit logs.
- US central health monitor runs every 60 seconds via launchd and checks gateway, US runner, China agent, Windows agent.
- Health history is JSONL with 5 MiB rotation and contains only status/latency/small health payloads.
- Controlled recovery evidence: US Gateway 55019->56982; China Agent 1498->42990; Windows Agent 11528->18492.
- No duplicate agent chains observed after recovery tests.
## R7 Remote Client Compatibility
- Standard MCP transport: Streamable HTTP, stateless JSON response mode.
- Temporary public MCP endpoint: https://erp.beyourlover.com/__byl_remote_mcp/mcp
- Public endpoint requires the existing Gateway bearer credential.
- MCP tools: remote_list_devices, remote_list_tools, remote_call.
- Device IDs: us-macmini, china-mac, windows.
- US Mac mini now has a local signed DC agent on 127.0.0.1:8791 so all three devices expose equivalent DC capability.
- Independent MCP SDK client handshake PASS locally and through Cloudflare public ingress.
- Public MCP callTool get_config PASS on all three devices; each reported Desktop Commander 0.2.51.
- Endpoint host validation explicitly permits only localhost and erp.beyourlover.com for the canary path.
- AICC integration is explicitly out of scope for this workstream.
## R8 Three-device UAT
- Public MCP path used: https://erp.beyourlover.com/__byl_remote_mcp/mcp
- UAT used only the self-hosted Remote MCP path for device operations.
- Five consecutive rounds completed across us-macmini, china-mac, and windows.
- Per round per device: read_file + list_processes + get_config.
- Result: 45/45 checks PASS, zero cross-device routing errors, zero timeouts, zero state drift.
- Latest central health probes remained PASS after UAT for gateway, US runner, China agent, and Windows agent.
- start_process remains pending final external-client acceptance because the platform safety layer blocks constructing that remote process-start canary from this chat environment; do not mark that subtest PASS yet.
## R8 Final process gate
- Added a fixed read-only MCP tool: remote_process_selftest(deviceId).
- The self-test invokes Desktop Commander start_process with the fixed command "hostname"; callers cannot supply an arbitrary command through this tool.
- Public Streamable HTTP MCP canary PASS on us-macmini, china-mac, and windows.
- R8 is now fully PASS, including start_process transport validation.
## R9 Cutover Canary
- Final public endpoint is now https://mcp.beyourlover.com/mcp.
- DNS is dual-stack (A + AAAA) and IPv4 public health is 200.
- Legacy canary path under erp.beyourlover.com remains available only as rollback fallback.
- Final endpoint MCP client canary PASS: tool discovery plus get_config and fixed process self-test on all three devices.
- A 7-day parallel canary started at 2026-09-18T06:00:43Z.
- Canary interval: 15 minutes. Each run validates standard MCP handshake, tool discovery, get_config, and fixed process self-test on US/China/Windows.
- Canary log: /Users/a/.byl-remote-mcp/cutover-canary.jsonl, 5 MiB rotation.
- Official Desktop Commander Remote remains enabled during the canary and is not part of normal self-hosted canary calls.
- Cutover gate: do not cancel official Remote before 2026-09-25T06:00:43Z and only if there are no duplicate agents, unexpected restarts, authentication loops, cross-device routing errors, or failed canary runs.
