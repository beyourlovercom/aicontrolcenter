# Cloudflare Access — BYL Remote Control Center

## Scope
Protect only:
- https://mcp.beyourlover.com/control/*

Do not protect:
- https://mcp.beyourlover.com/mcp
- https://mcp.beyourlover.com/healthz

## Application
- Type: Self-hosted
- Name: BYL Remote MCP Control
- Domain: mcp.beyourlover.com
- Path: /control/*
- Session duration: 24h

## Policy
- Decision: Allow
- Include: one explicit owner identity/email only
- Authentication: existing Cloudflare identity provider or One-time PIN
- No public/bypass rule for /control/*

## Origin gate
After Cloudflare Access is confirmed working, set:
BYL_CONTROL_ACCESS_ACTIVE=1
in com.byl.remote-mcp-control-center.plist and reload the launch agent.

Until that flag is enabled, all public /control/* requests fail closed with HTTP 401 even if an Access-like header is forged.
