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
