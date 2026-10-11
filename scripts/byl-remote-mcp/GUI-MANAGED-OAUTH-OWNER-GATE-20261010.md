# BeYourLover primary MCP — Cloudflare Managed OAuth (2026-10-10)

## Deployment boundary
- Canonical endpoint: `https://mcp.beyourlover.com/mcp`. Existing five live tools/legacy Bearer are **not** changed by this branch.
- ChatGPT has **not yet** connected a first-class primary MCP app. Current operator/plugin instances should not be assumed to share OAuth.
- Native Cloudflare Access **Managed OAuth**, not an improvised username/password OAuth server, is the preferred method. Official docs: https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/ and https://developers.openai.com/plugins/build/auth .

## Cloudflare prerequisites — do not enable blindly
1. In Zero Trust > Access controls > Applications, locate the Access application whose hostname/path actually protects **`mcp.beyourlover.com/mcp`**. Verify domain/path, application ID and access policies (owner-only identities); ensure it is not just protecting the `/.well-known` paths while `/mcp` is bypassed. Confirm no shared unrelated apps/policies would be modified.
2. Make an exact backup/export of the existing Access application and policies.
3. Review the current legacy primary connector's authentication. Enabling Managed OAuth at Cloudflare can replace 302/401 behavior and might deny legacy static-Bearer callers at the **edge**, even though the origin continues to accept legacy Bearer; preserve a safe compatibility route or documented rollback before changing the app.
4. After policy isolation is proven, enable **Managed OAuth** on this application's Advanced settings. Configure Dynamic Client Registration with only the exact callback/redirect URI(s) displayed by ChatGPT when creating this MCP app (not an unrestricted wildcard). Disable localhost/loopback clients unless explicitly needed.
5. Review grants: short-lived access token and refresh/session duration; verify `S256`, dynamic registration, OAuth `resource` parameter and refresh-token support/behavior before using ChatGPT.
6. Record authoritative Access **team**, app **AUD** (exact 64-character hex), and allowed owner email addresses from the existing Cloudflare application configuration. Do not guess from unrelated JWTs.
7. Deploy the GitHub-main pinned `gui-managed-access-auth.mjs` to the US primary standard MCP with `jose` pinned in its own dependency lockfile, and set all three launchd environment values `CF_ACCESS_TEAM`, `CF_ACCESS_AUDIENCE`, `CF_ACCESS_OWNER_EMAILS` together. Fail closed if any are missing. Keep existing static token fallback for legacy clients.
8. Verify server's received `Cf-Access-Jwt-Assertion` via Cloudflare issuer JWKS, `RS256` signature, exact AUD, expiry, and owner email allowlist before any MCP tool is invoked. Never trust unverified assertion headers or client-supplied email.
9. Public discovery check: `node gui-oauth-discovery-check.mjs` must pass: protected-resource metadata HTTP 200 JSON, authorization-server metadata HTTP 200 with PKCE S256, MCP 401 with OAuth challenge. Confirm existing Bearer MCP calls still work where expected. Probe non-owner login denial and refresh without revealing access tokens.
10. Owner connects this exact official URL in ChatGPT, completes consent, and runs only `gui_dev_cart_home_canary` on isolated Dev cart; no real orders or payments.

## Current evidence / blocked conditions
- Read-only discovery probe at public domain: resource `302`, auth-server `401`, MCP `401` with **no OAuth challenge**: discovery readiness **FAIL**.
- Origin adapter in this branch uses pinned `jose` JWT verification. Full Node tests and standalone loopback canary verify legacy Bearer PASS, anonymous/forged assertion DENY, and signed RSA issuer/audience/expiry checks.
- China Mac Cloudflare Chrome session currently has zero scriptable windows; opening an existing Chrome profile via `open -a` did not yield a usable window. No Cloudflare dashboard settings have been modified. No Cloudflare API credential has been supplied or located in standard environment.
- **Not allowed:** enabling production Managed OAuth before auditing path/policy and legacy caller compatibility, or deploying guessed team/AUD/owner values. No restarting a READY computer or agent.

## Rollback
- Preserve original Access application/policies and original `mcp-endpoint.mjs` hash/backup before each independent cutover. Undo Access OAuth first if edge denies legacy clients, then restore only standard MCP service source and kickstart only `com.byl.remote-mcp-standard` if source rollback is required. Check public 5-tool authenticated discovery and legacy remote hostname.
