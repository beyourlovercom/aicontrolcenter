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