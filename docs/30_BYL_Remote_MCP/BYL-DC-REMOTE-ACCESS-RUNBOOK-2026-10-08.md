# BYL DC Remote — Shared SSH & Authentication Runbook

**Version:** 2026-10-08 v1.0  
**Owner:** BYL infrastructure  
**Policy:** GitHub is the canonical documentation source. Never commit plaintext passwords, SSH private keys, bearer tokens, signing keys, cookie values or Cloudflare credentials.

## 1. Default connection and device registry

- **Self-hosted MCP:** `https://mcp.beyourlover.com/mcp` (Streamable HTTP). This is the preferred service, but ChatGPT direct OAuth integration is **not yet UAT PASS**.
- **Control console:** `https://mcp.beyourlover.com/control/` (different password/session authentication, NOT OAuth).
- **Health:** `https://mcp.beyourlover.com/healthz`.
- **Legacy secondary route:** `https://erp.beyourlover.com/__byl_remote_mcp/mcp`.
- **Legacy Desktop Commander cloud:** `mcp.desktopcommander.app`; its Offline flag is not authoritative for self-hosted device state.

| Device ID | Observed identity | Tailnet address | Agent |
|---|---|---|---|
| `us-macmini` | `as-Mac-mini.local`, macOS account `a` | `100.94.52.109` | localhost port 8791 |
| `china-mac` | `amacbook-pro.tail5ca8e5.ts.net` | `100.102.15.40` | port 8791 |
| `windows` | `YST-241030SSD` | `100.87.29.56` | port 8791 |

Addresses were observed in code and tests, and must be reconfirmed before use. China Mac and Windows account usernames have not been independently validated.

## 2. SSH from China Mac to US Mac mini

- SSH username: **`a`**.
- Host: `100.94.52.109` (Tailscale, TCP 22).
- Explicit private-key path on **China Mac**: `~/.ssh/id_ed25519_dc_recovery_us`.
- Public-key path: `~/.ssh/id_ed25519_dc_recovery_us.pub`.
- Authentication: Ed25519 public key. Without an explicit identity, `id_rsa` was attempted and refused.
- 2026-10-08 test returned `as-Mac-mini.local` and `a` successfully.

Read-only identity test:

```bash
ssh -i ~/.ssh/id_ed25519_dc_recovery_us \
  -o IdentitiesOnly=yes -o BatchMode=yes -o ConnectTimeout=6 \
  a@100.94.52.109 'hostname; whoami'
```

Never copy private key contents to chat, Git, an issue or PR. An SSH identity filename is not a password.

## 3. Running source / network ingress

GitHub repository: `https://github.com/beyourlovercom/aicontrolcenter`.

Actual running worktree on US Mac mini: `/Users/a/AI/007/worktrees/byl-remote-mcp-v1`.

| Runtime | Relative source | Local listener |
|---|---|---|
| Standard MCP | `scripts/byl-remote-mcp/mcp-endpoint.mjs` | `127.0.0.1:8792` |
| Gateway | `scripts/byl-remote-mcp/gateway.mjs` | `127.0.0.1:8790` |
| Agent | `scripts/byl-remote-mcp/dc-agent-macos.mjs` | port 8791 |
| Console | `scripts/byl-remote-mcp/control-center.mjs` | `127.0.0.1:8793` |

Cloudflare Tunnel config: `/Users/a/AI/production/erp.beyourlover.com/cloudflared/config.yml`; public `/mcp` routes to port 8792; other mcp hostname paths route to console 8793; `/healthz` routes to 8790.

OAuth development worktree (not production): `/Users/a/AI/007/worktrees/byl-mcp-oauth-adapter-v1`, branch `feature/byl-mcp-oauth-adapter-v1`.

## 4. Secret inventory — locations / mechanisms ONLY

| Purpose | Secret reference | Rules |
|---|---|---|
| Gateway and current MCP bearer token | US Mac: `/Users/a/.byl-remote-mcp/gateway.token` | Do not print, expose, copy or check into Git |
| Signed agent requests | US Mac: `/Users/a/.byl-remote-mcp/keys/gateway-ed25519-private.pem` | Ed25519 private key must remain server-side |
| China-to-US SSH | China Mac: `~/.ssh/id_ed25519_dc_recovery_us` | Never commit/export private key |
| Control console password | Environment variable `BYL_CONTROL_PASSWORD` on US Mac | Exact secret injection store not yet verified; login creates `byl_control_session` cookie |
| Cloudflare tunnel credential | US Mac: `/Users/a/.cloudflared/16316426-1b58-456a-8c97-9981536933cd.json` | Do not publish, read aloud or commit |
| ChatGPT OAuth credentials | **Not provisioned / not confirmed** | Do not invent a Client ID or secret |
| China and Windows agent secrets | **Not verified** | Inspect authorized on-device secret stores only |

No passwords or bearer-token values belong in this document. For access, use the existing approved secret store / responsible operator; rotate only with separate authorization and rollback plan.

## 5. MCP and OAuth truth

Current standard endpoint tools: `remote_list_devices`, `remote_list_tools`, `remote_call`, `remote_process_selftest`. Fixed device allowlist, signed agent requests, agent-side tool restrictions and fail-closed routing are important security invariants.

As inspected 2026-10-08, unauthenticated `/mcp` returned 401 JSON-RPC `Unauthorized`. The `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/mcp`, `/.well-known/oauth-authorization-server` and `/.well-known/openid-configuration` endpoints returned 401. The ChatGPT Add custom MCP server OAuth auto-discovery failed. **Self-hosted agent Online does not imply ChatGPT OAuth success.** Console password auth is not an OAuth authorization server.

OAuth adapter must use validated discovery, PKCE, callback allowlisting, audience/scope validation, revocation and token lifetime controls while keeping internal gateway token private. No unauthenticated fallback. Production OAuth deployment requires separate approval.

## 6. Operator workflow shared by ALL projects

1. Select BYL self-hosted MCP first, then verify actual tool visibility in the *current ChatGPT session*; do not claim a BYL call was made through the legacy DC plugin.
2. Confirm device heartbeat/identity, run read-only `hostname` before any authorized operation.
3. If US fails, distinguish Tailscale reachability from SSH auth using the explicit recovery key, **without** restarting an online READY machine.
4. Inspect source path, process presence, Cloudflare route and HTTP response codes; **never dump .env, secret stores, private keys, tokens, or cookies into logs/chat**.
5. Develop in an isolated Git branch/worktree with tests, PR and CI. No production credential changes, deploy or device restarts without separate authorization.
6. UAT must prove ChatGPT plugin install, `remote_list_devices`, and `remote_process_selftest`/read-only `hostname` for all three devices; audit unauthorized-denial behavior.

Applies to BYL, ERP, YBY, content, ads and other permitted projects. For disconnected endpoints request approval for a bounded fallback rather than silently switching to the Desktop Commander vendor cloud.

## 7. Items requiring verification

- ChatGPT Plus custom MCP OAuth and read/write tool UAT remain pending.
- Console password's source/injection mechanism was not independently confirmed.
- Windows account username and local key/secret paths are not confirmed.
- Self-hosted console device status needs fresh heartbeat before each high-impact operation.

**Do not infer credentials or permissions from this document alone.**
