# BYL Remote MCP — OAuth Architecture Gate V1

Status: **DESIGN GATE ONLY — no production OAuth provider identified, no deployment authorized**.

## Current verified baseline
- Public MCP endpoint `https://mcp.beyourlover.com/mcp` is a protected Streamable HTTP MCP service. The running implementation is `scripts/byl-remote-mcp/mcp-endpoint.mjs` on US Mac mini, port 8792.
- The live endpoint currently expects an internal gateway Bearer Token; anonymous HTTP POST /mcp returned 401 but did not advertise OAuth Protected Resource Metadata via `WWW-Authenticate`.
- Public `/.well-known/oauth-protected-resource`, `/.well-known/oauth-protected-resource/mcp`, and `/.well-known/oauth-authorization-server` previously returned 401. The Cloudflare ingress currently routes only the exact `/mcp` path to port 8792; other hostname paths are served by the separate password-protected console on 8793.
- Console password/cookie authentication and backend HMAC signature/auth keys are NOT an OAuth authorization server. No legitimate direct ChatGPT OAuth login has been demonstrated.
- Source record: `beyourlovercom/aicontrolcenter`, branch `feature/byl-remote-mcp-v1`. PR #48 adds isolated credential-free read-only UAT tests, merged into this feature branch at `79017b2f515d4f27b1441a3fa39b3627009e8935`.

## Decision required before implementation
Choose and configure a **trusted OAuth 2.1 / OIDC authorization server** compatible with an MCP public resource server and ChatGPT public client. The team must establish:
- Issuer URL, authorization endpoint, token endpoint and public JWKS or approved token introspection endpoint.
- ChatGPT client registration via CIMD (preferred where issuer supports it), DCR, or static registered client + exact callback URI.
- Authorization code flow with S256 PKCE; login, consent, token lifetime, key rotation and revocation.
- Restricted account membership/consent: no third-party principals may obtain device-control scopes.
- Exact resource identifier `https://mcp.beyourlover.com/mcp`, expected token audience, issuer, expiry and signing algorithm.
- Scope mapping such as `byl:device:read` for enumeration/allowlisted hostname and `byl:device:operate` for `remote_call`. Per-device restrictions and operator audit logging must continue.
- Strong separation: never surface existing gateway Bearer Token, HMAC private key, SSH keys or console password in ChatGPT, GitHub or browser URLs.

Do **not** construct a fake OAuth implementation from the existing console password or expose a static production token as a ChatGPT client credential.

## Implementation contract (development branch, opt-in, fail closed)
1. Default mode retains current internal gateway authentication; no behavior change on production without a separate deploy gate.
2. Once a real OAuth issuer is configured, expose **public read-only OAuth resource discovery** at the mandatory well-known route(s), plus a `401 WWW-Authenticate: Bearer resource_metadata="https://mcp.beyourlover.com/.well-known/oauth-protected-resource"` challenge. Publish `authorization_servers`, resource and supported scopes. Cloudflare routing for well-known paths requires separately gated change; console must not intercept/401 those metadata routes.
3. Server accepts an OAuth access token only after verifying issuer, audience/resource, signature, expiration/not-before and scopes, using rotating JWKS or properly secured token introspection; reject malformed tokens, invalid audiences, wrong scopes and unknown algorithms. Avoid token passthrough to agents: keep existing signed server-to-agent calls.
4. Tool implementation must enforce scopes **server-side**, not merely by tool descriptions. `remote_call` remains privileged, independent of what `tools/list` advertises. All logs redact credentials and personal data.
5. Tests: metadata schema, 401 challenge discovery, PKCE issuer metadata capability, wrong issuer/audience/scope/expiry, signing-key rotation, anonymous-denied, exact device route and four registered tools.
6. Deploy only after code review, CI and separate production approval; verify rollback and health without restarting READY devices.

## UAT gate (must not misreport)
A. Automated authorization negative/positive tests against an **isolated test issuer** and `/mcp` dev endpoint. No live secrets.
B. Owner's ChatGPT Plus plugin performs OAuth interactive login and tool discovery. Confirm **actual** self-hosted BYL tools are exposed instead of the vendor's Desktop Commander MCP.
C. Complete `initialize`, `tools/list`, `remote_list_devices`, and fixed `remote_process_selftest` hostname on `us-macmini`, `china-mac`, and `windows`.
D. Out-of-scope devices/actions are rejected. Leave existing control console, Cloudflare tunnel, production env, Tailscale peers, and online agents unchanged during development.

## Current blocker
No verified compatible OAuth issuer, registered ChatGPT client and validated signing configuration have been provided. This is an **identity architecture decision**, not a Plus-plan entitlement issue. The separate credential-safe MCP read-only test harness is merged; authenticated real-device UAT and ChatGPT direct OAuth UAT remain pending.

No secret values or credentials belong in this record.
