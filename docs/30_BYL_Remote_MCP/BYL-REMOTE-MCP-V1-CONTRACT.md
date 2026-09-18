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
