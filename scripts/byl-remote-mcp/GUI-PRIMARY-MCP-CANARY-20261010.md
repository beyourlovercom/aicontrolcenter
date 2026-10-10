# Primary MCP GUI integration — 2026-10-10

## Root cause
- Main public `https://mcp.beyourlover.com/mcp` is backed by the US Mac mini MCP standard endpoint at 127.0.0.1:8792. The externally reachable `/healthz` is from a separate gateway.
- Actual `tools/list` on the public endpoint (using its existing bearer auth) returned only `remote_list_devices`, `remote_list_tools`, `remote_call`, `remote_process_selftest`. The primary MCP server did not register any GUI tool.
- Windows backup `mcp-win-uat.beyourlover.com/mcp` has its own tool registry and does not automatically populate the primary endpoint. The previous Operator UAT `OPERATOR_TOOL_DENIED` reflected this mismatch.

## Independent US Mac mini canary
- Created `mcp-primary-gui-candidate.mjs` from the actual live standard endpoint, with a single new named tool `gui_dev_cart_home_canary`, and a fixed-scope `gui-primary-bridge.mjs`.
- Standalone canary runs on 127.0.0.1:8796 using the same existing auth and signed-agent calls; existing production endpoint remains on 8792.
- 8792 `tools/list`: 4 original tools; 8796 `tools/list`: same 4 + GUI tool; unauthenticated 8796 POST returns HTTP 401.
- Native GUI E2E via 8796 `tools/call` to Windows Dev-only isolated Chrome → address readback returned `verified=true` and exit 0.
- Bridge rejects unknown process outcomes and requires both the fixed success receipt and process completion status 0; 7 focused tests PASS.
- Real-world only: Dev cart → home via Windows; no arbitrary GUI operations, real orders, payments or Production data.

## Release gate / rollback
- Draft PR #52; do not conflate an 8796 canary PASS with a formal 8792 deployment PASS. `mcp.beyourlover.com/mcp` still routes to the old registered tool list until controlled release.
- Before applying to 8792, respect GitHub main as source of truth and PR merge authorization. Keep a byte-for-byte backup of deployed `mcp-endpoint.mjs`, validate SHA and modified source, restart only `com.byl.remote-mcp-standard` if authorized. Do not reboot a READY device or restart the gateway or agent.
- Verify public `tools/list` preserves old names and adds GUI, test denied anonymous requests and a fresh isolated Chrome profile, then Owner UAT from actual connected ChatGPT plugin. On failure immediately restore old code and restart only the standard MCP service.
