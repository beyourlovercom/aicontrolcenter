# BYL Windows Backup MCP V1

Status: **isolated localhost UAT**. This is a new emergency gateway; it does not replace the US Mac mini, its gateway token, or `mcp.beyourlover.com`.

## Current implementation

- Dedicated Node MCP server, Windows machine local only: `127.0.0.1:8892/mcp`.
- Independent, high-entropy gateway token, created locally by `prepare-token.mjs`; never commit, display, or send it.
- `hostname`, `start_process`, `list_directory`, `read_file`, `write_file`, `edit_block` tools.
- Project file operations restricted to `C:\Users\Administrator\AI`; command execution runs with Windows gateway process's Windows user privileges.
- If `BYL_WIN_PUBLIC_HOST` is configured, a public Host request is **not eligible** for Bearer auth. It requires a valid Cloudflare Access JWT, verified for RS256, issuer, audience and exact Owner email.
- Do **not** enable public Tunnel routing before Cloudflare Owner Only Access app is configured and the corresponding JWT settings are set locally.
- Never open port 8892 on Windows firewall, forward TCP 8892 on router, use an unauthenticated Quick Tunnel, or copy US Mac private keys.

## Recovery / installation

Install Node >=22, `npm install --ignore-scripts` and Cloudflare cloudflared from their official installers. Work on a copy of this directory. Set `BYL_WIN_BACKUP_ROOT` to the approved project workspace and `BYL_WIN_BACKUP_TOKEN_FILE` to the locally generated secret file. Start Node gateway with `windows-gateway.mjs`; inspect `/healthz`.

Target independent hostname (not yet provisioned): `mcp-win-uat.beyourlover.com/mcp`. First configure a dedicated Cloudflare Access self-hosted Application scoped to that exact path and an Owner Only policy. Enable Managed OAuth. Then configure dedicated Cloudflare Tunnel forwarding to `http://127.0.0.1:8892` and set `BYL_WIN_PUBLIC_HOST`, issuer, Audience and Owner email. Do not reuse the production Tunnel credentials.

## UAT checklist

- Verify HTTP 200 on loopback health, 401 on unauthenticated MCP, valid JSON-RPC initialize and tools/list with local private token.
- Validate arbitrary PowerShell Git version, create/edit/read test file under project root.
- Test attempting to read out-of-root secrets is blocked.
- Prove public hostname Access JWT rejection of outsider, wrong issuer/audience, expired token, missing token and raw local Bearer.
- Prove Owner OAuth redirect and full tools/call end to end.
- Monitor standalone backup gateway stability and startup recovery separately before Final Closure.

**Current documented PASS (2026-10-10)**: local health, anonymous 401, Bearer initialize, tool discovery, terminal, create/edit/read, and loopback-only binding. Public Cloudflare OAuth is not configured or UAT-passed.
