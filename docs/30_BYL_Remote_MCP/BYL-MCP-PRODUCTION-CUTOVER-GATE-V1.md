# BYL Remote MCP — Production Cutover V1 Gate

Status: **Architecture review / NO PRODUCTION CUTOVER**. Source baseline: feature/byl-remote-mcp-v1 (PR #50 merged). Staging ChatGPT OAuth and three live device fixed-hostname checks PASS. This does not authorize production rollout.

## Current production authentication boundaries
- https://mcp.beyourlover.com/control/ is the existing password + session-cookie protected control console. Keep its route and login unchanged.
- https://mcp.beyourlover.com/mcp currently uses a private internal Bearer token, served by the existing production origin at localhost:8792. Keep existing clients working.
- https://mcp-uat.beyourlover.com/mcp uses an independent Cloudflare Tunnel, Managed OAuth Access application and Access JWT origin verifier on localhost:8794. Retain for future regressions.
- Cloudflare OAuth discovery and Access policy are hostname/path-sensitive. An Access application on the entire production hostname can intercept /control/, /healthz or legacy Bearer clients. **Do not create a hostname-wide Access application as a shortcut.**

## Required production compatibility checks
1. Inventory exact existing production Cloudflare Tunnel ingress routes, Access applications/policies, and control-console cookie path; record only non-secret route data. Identify whether Access can enforce only /mcp while serving discovery routes without authentication.
2. Verify public OAuth discovery routes /.well-known/oauth-protected-resource, /.well-known/oauth-authorization-server and the Cloudflare Access-specific challenge resource route on the production hostname. Ensure no overlap with /control/.
3. Verify legacy Bearer clients against /mcp remain accepted **after** any new edge policy. Cloudflare Access could block the request before it reaches the origin; origin's dual-auth implementation alone is not enough. Prefer separate origin or controlled service-token migration if needed, with client inventory and rollback.
4. Confirm production origin's JWT issuer, audience, signature, expiry, and exact operator allowlist are configured without logging secrets. OAuth read-only role must not expose remote_call.
5. Establish canary tests: existing /control/ login, existing Bearer MCP initialize/tools/list, OAuth initialize/tools/list and fixed hostname for three devices, denied outsider/forged JWT, /healthz, rollback to previous route.
6. Require a separate explicit owner approval for production Access creation, production tunnel ingress changes and production process reload; no device restarts.

## Recommendation
**Do not replace or rename the staging hostname.** Keep mcp-uat.beyourlover.com and use mcp.beyourlover.com/mcp as the future canonical production endpoint only after legacy Bearer compatibility is proven. If Cloudflare Access cannot preserve legacy Bearer clients on the same path, retain the existing production /mcp as-is and introduce a separate production OAuth hostname or a separately routed OAuth path until migration is approved.

## Evidence and scope
- PR #50 merged into development baseline at 7606f5417f1bacf69611e1f839406dc03f1cf008.
- ChatGPT staging OAuth, remote_list_devices, remote_list_tools and remote_process_selftest for us-macmini, china-mac, windows passed in the staging UAT evidence document.
- No production DNS, Tunnel, Access policy, authentication secret, live service or device was modified during this architecture gate.
