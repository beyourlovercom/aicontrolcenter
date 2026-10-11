# Primary-domain ChatGPT OAuth isolation gate — 2026-10-11

## Objective
Keep the established Bearer-token `https://mcp.beyourlover.com/mcp` endpoint and all existing MCP callers running without any Cloudflare Access changes. Prepare a separately protectable `https://mcp.beyourlover.com/chatgpt/mcp` route on the **same production hostname** as a non-final OAuth canary.

## Contract
- The original `/mcp` and `/__byl_remote_mcp/mcp` routes remain unchanged and accept only the already configured legacy Bearer or an owner-verified Cloudflare assertion when configured.
- The added `/chatgpt/mcp` path allows **only** a successfully verified Cloudflare Access owner assertion, not the old static Bearer token. With OAuth inactive it must fail closed with 401.
- No arbitrary paths, calls to live orders, payments, or unrelated Cloudflare applications.
- The first code-only release must not make the ChatGPT path accessible before an isolated owner-only Access application and validated JWT parameters exist.

## Cloudflare application prerequisites (separately authorized)
- Existing production Access application contains paths `/.well-known/oauth-protected-resource`, `/oauth/mcp`, and a Windows backup MCP destination. Do not enable Managed OAuth on this mixed application.
- Instead, use a **separate** Access application for `mcp.beyourlover.com/chatgpt/mcp`, without the Windows backup destination, and with one owner-only policy. Review discovery-path overlap with the existing application before saving.
- Save the prior Access application settings and policies. Inspect/record the new application's exact AUD and team, restricted owner identities and exact ChatGPT callback/redirect origins, without exposing credentials.
- Enable Managed OAuth with PKCE S256 and only the necessary redirect URI pattern, short access-token expiry and bounded refresh-token session. Preserve the legacy /mcp path untouched.
- Confirm OAuth protected-resource metadata, RFC 8707 resource support, 401 WWW-Authenticate challenge, dynamically registered client, successful Owner JWT validation, and legacy Bearer regression.
- Explicit manual Owner approval required for new Access application, source launchd JWT environment values and public route release. No new DNS or hostname required.

## Final endpoint decision
The new path is a staging bridge **on** `mcp.beyourlover.com`, not a silent replacement for canonical `/mcp`. Once ChatGPT OAuth works, migrate canonical `/mcp` only under separate approval and after an audited legacy-connector migration plan. If the canonical URL cannot change without breaking existing users, keep route separation until those clients have migrated.

## Validated without production changes
Node unit tests 101/101 PASS. Loopback MCP candidate at 127.0.0.1:8803 preserves all five original tools and legacy-authenticated `/mcp`; unauthenticated alternate path returns 401 and unknown child paths 404. Source branch is not merged and not deployed.
