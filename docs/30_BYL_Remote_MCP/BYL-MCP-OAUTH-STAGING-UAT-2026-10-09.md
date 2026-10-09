# BYL MCP Managed OAuth staging UAT — 2026-10-09

Status: OAuth discovery PASS; protected origin JWT/UAT BLOCKED pending verified AUD tag and owner email. Production untouched.

## Staging infrastructure
- Access app: BYL MCP OAuth UAT, hostname mcp-uat.beyourlover.com. Managed OAuth ON (owner saved settings). Owner Only policy exists, but underlying exact email rule must be rechecked.
- Separate Cloudflare Tunnel BYL-MCP-UAT-20261009, ID 93ba566b-21aa-4804-976f-89c8547f48f3. New CNAME created only for staging hostname.
- US Mac mini staging origin: 127.0.0.1:8794; code copied to /tmp/byl-mcp-access-stage-20261009. Production endpoint stays on 127.0.0.1:8792. Both /healthz HTTP 200.
- Dedicated ingress configuration: /tmp/byl-mcp-uat-tunnel-20261009.yml; separate tunnel credentials stored privately under ~/.cloudflared/. Never expose their contents.
- Staging Access JWT validation is deliberately OFF until application AUD tag and authorized operator identity are configured. Default Bearer auth remains fail-closed for OAuth clients; no real tools UAT claimed.

## Verified discovery via Cloudflare edge
- /mcp => HTTP 401.
- /.well-known/oauth-authorization-server => HTTP 200.
- /.well-known/oauth-protected-resource => HTTP 200.
- OAuth AS issuer: https://idollri.cloudflareaccess.com.
- AS metadata supports authorization code, refresh token, dynamic registration and S256 PKCE.
- Protected resource metadata: resource https://mcp-uat.beyourlover.com; authorization server https://idollri.cloudflareaccess.com.
- System DNS on US and China Macs still did not resolve staging hostname; edge verification used forced hostname/SNI and an existing Cloudflare IP. Normal direct ChatGPT reachability NOT confirmed.

## GitHub source and tests
- PR #50: https://github.com/beyourlovercom/aicontrolcenter/pull/50.
- Development flag BYL_MCP_STAGING=1 selects port 8794; production default remains 8792.
- Staging US Mac local JWT/auth unit tests: 8/8 PASS. Earlier PR CI passed; rerun after final changes.

## Required next gates
1. Read exact Access AUD tag under Additional settings > AUD tag; verify Owner Only policy uses Include Emails exact administrator address, not Everyone.
2. Inject staging-only settings locally: BYL_MCP_ACCESS_ENABLED=1, BYL_MCP_ACCESS_ISSUER=https://idollri.cloudflareaccess.com, BYL_MCP_ACCESS_AUDIENCE=<AUD>, BYL_MCP_ACCESS_READ_EMAILS=<approved>, BYL_MCP_ACCESS_OPERATE_EMAILS=<approved>. No secrets in GitHub or tool logs.
3. Test ChatGPT custom MCP app OAuth callback, /mcp initialize/tools/list, read-only device list and fixed hostname against three agents.
4. Denial UAT, audit evidence and owner approval before any production change.

Security: do not change production Tunnel, production authentication, credentials, services or reboot READY devices.
## Authentication boundary: existing /control/ is already protected
- Confirmed existing self-hosted control console URL: https://mcp.beyourlover.com/control/ . This is a previously configured, authenticated admin console, **not an unprotected endpoint**.
- The inspected console implementation uses BYL_CONTROL_PASSWORD and an HttpOnly, Secure, SameSite=Strict scoped session cookie (`byl_control_session`); these credentials remain private and unchanged. Cloudflare Access protection of this legacy console has not been independently demonstrated; do not infer it from the console's own password gate.
- The production Streamable HTTP MCP URL https://mcp.beyourlover.com/mcp uses a different internal Bearer token. The staging test hostname mcp-uat.beyourlover.com uses separately configured Cloudflare Access Managed OAuth. These are three distinct authentication boundaries.
- Preserve the stable production control-console password/session workflow, MCP internal token and signed agent backend. **Do not replace the existing /control/ login or redirect it to staging OAuth.** Only enable new Access token verification on a separately approved isolated staging origin before eventual production gate.

## 2026-10-09 Access JWT activation and OAuth staging UAT
- Owner supplied the exact Access application audience identifier and confirmed Owner Only allows only the specified administrator email.
- The isolated US Mac mini staging MCP instance (127.0.0.1:8794) was reloaded with Access JWT verification explicitly enabled, issuer https://idollri.cloudflareaccess.com, exact application audience and admin email allowlist. The operator allowlist remains empty to prevent arbitrary remote commands during read-only UAT.
- Production MCP (127.0.0.1:8792) was NOT reloaded or modified. Staging and production health checks: HTTP 200 / 200.
- Staging anonymous POST => HTTP 401, staged forged Access JWT POST => HTTP 401, production anonymous POST => HTTP 401. These tests prove denial behavior only, not authenticated tool success.
- Public staged /mcp returned HTTP 401 and a WWW-Authenticate Bearer resource_metadata challenge. The challenge points to /.well-known/cloudflare-access-protected-resource/mcp, which returned HTTP 200. Standard protected-resource and OAuth authorization-server metadata both returned HTTP 200.
- Cloudflare Access public certificates/JWKS endpoint returned HTTP 200. Previous locally signed JWT tests: 8/8 PASS. User-assisted ChatGPT OAuth browser login and real three-device read-only tool calls still REQUIRED.
- Next UAT: ChatGPT Plugins > Add custom MCP server, URL https://mcp-uat.beyourlover.com/mcp, Streamable HTTP, OAuth. Login using authorized admin identity. Verify exact ChatGPT redirect URI if registration requires it; never use wildcard redirects. Check tool list and each device's fixed read-only hostname before approving PR #50.

## ChatGPT plugin creation validation failed — callback-mode diagnosis
- The ChatGPT Add custom MCP server form rejected creation with generic setting-validation error for https://mcp-uat.beyourlover.com/mcp. Screenshot showed no required icon and OAuth selected; this error alone does not identify the rejected field.
- Fresh China Mac HTTPS/DNS checks PASS. /mcp returns expected 401 Bearer metadata challenge; OAuth PRM and authorization-server discovery return 200. Production health remains HTTP 200.
- The Cloudflare OAuth authorization server metadata advertises dynamic client registration and PKCE S256, but does **not** advertise `authorization_response_iss_parameter_supported: true` and does not advertise CIMD support.
- Under the OpenAI plugin authentication specification, when RFC 9207 authorization-response issuer identification is absent, ChatGPT uses a callback-ID-specific URI in the form https://chatgpt.com/connector/oauth/{callback_id}, **not** the stable https://chatgpt.com/connector_platform_oauth_redirect. The previous static URI allowlist is therefore insufficient for this callback mode. Official reference: https://developers.openai.com/plugins/build/auth.
- Proposed staging-only recovery: ensure ChatGPT uses DCR, add narrowly scoped allowed redirect pattern https://chatgpt.com/connector/oauth/* to the Cloudflare staging application's Managed OAuth redirect allowlist, retry creating the plugin, and then restrict to the exact callback URI when discoverable. Never use a wildcard hostname or /any-path wildcard and never change the production app. This is a suspected, not yet confirmed, root cause.
