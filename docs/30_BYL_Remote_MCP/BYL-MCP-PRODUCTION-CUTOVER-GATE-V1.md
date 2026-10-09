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

## Read-only production route evidence — 2026-10-09
- US Mac mini SSH through existing China Mac recovery channel: PASS. Production localhost:8792 /healthz HTTP 200; staging localhost:8794 /healthz HTTP 200.
- Production cloudflared ingress validated OK. Exact ingress rule for https://mcp.beyourlover.com/mcp: rule #0, path ^/mcp$, origin http://127.0.0.1:8792.
- https://mcp.beyourlover.com/control/ matches rule #2 and origin http://127.0.0.1:8793 (existing password/session console).
- https://mcp.beyourlover.com/.well-known/oauth-protected-resource matches rule #2 and origin http://127.0.0.1:8793, **not** the OAuth-aware MCP service. Production OAuth discovery requires an explicitly reviewed route and Access policy change; cannot be achieved by renaming UAT.
- Both production and UAT cloudflared tunnel processes were running independently. No service restarted, no production config changed.
- Gate still pending: enumerate legacy Bearer clients and establish Cloudflare Access path-level policy compatibility. Do not claim production OAuth UAT PASS.

## Production endpoint negative-path and discovery read-only checks — 2026-10-09
- US Mac mini production local POST http://127.0.0.1:8792/mcp with unauthenticated empty JSON: HTTP **401** (deny baseline PASS).
- Local GET http://127.0.0.1:8793/control/: HTTP **200** (page reachability only; does NOT establish successful console login).
- Public GET https://mcp.beyourlover.com/.well-known/oauth-protected-resource: HTTP **401**.
- Public GET https://mcp.beyourlover.com/.well-known/oauth-authorization-server: HTTP **401**.
- Public GET https://mcp.beyourlover.com/.well-known/cloudflare-access-protected-resource/mcp: HTTP **404**.
- Existing production ingress also routes /healthz to localhost:8790 and /__byl_remote_mcp/mcp to localhost:8792, with separate catch-all 8793. These must be considered in path-scope migration design.
- **BLOCKED**: production OAuth discovery not ready; legacy authenticated Bearer initialize/tools/list has not yet been tested and Cloudflare edge Access behavior for legacy clients is unverified. No production configuration changes approved or executed.
- **Next gate**: inventory actual legacy clients without reading secrets, test authenticated MCP using the existing token locally without printing it, and propose a path-isolated OAuth rollout that does not intercept /control/ or legacy MCP traffic.

## P4 closeout / P5 path-isolation decision (2026-10-09)

### Verified P4 local legacy credential compatibility — PASS
Owner ran `scripts/byl-remote-mcp/audit-legacy-bearer-readonly.mjs` on the US Mac mini against `http://127.0.0.1:8792/mcp`:
- `initialize` — HTTP 200, valid JSON-RPC 2.0 result, no error.
- `tools/list` — HTTP 200, valid JSON-RPC 2.0 result: `remote_list_devices`, `remote_list_tools`, `remote_call`, `remote_process_selftest`.
- Token contents were not disclosed. Tool registration does not establish invocation authorization.
- **P4 = PASS for localhost only; public Cloudflare edge Bearer compatibility remains UNTESTED.** This supersedes the earlier P4-pending sentence above.

### P5 public path comparison — BLOCKED
| Path | Production mcp.beyourlover.com | UAT mcp-uat.beyourlover.com |
| --- | --- | --- |
| `/.well-known/oauth-protected-resource` | 401 HTML | 200 JSON |
| `/.well-known/oauth-authorization-server` | 401 HTML | 200 JSON |
| `/.well-known/cloudflare-access-protected-resource/mcp` | 404 | 200 JSON |
| `/healthz` | 200 JSON | 401 JSON |

Production unauthenticated `/control/` currently returns 401 HTML (do not classify as a failure without valid console login). Production cloudflared ingress dry-run confirms discovery path `/.well-known/oauth-protected-resource` matches catch-all rule #2 => localhost 8793. The source layer of 401 remains unproven.

### Cutover choice and sequencing
1. **Hold existing production `/mcp` / `/control/` untouched.** Do not install a hostname-wide Cloudflare Access application. No production OAuth discovery claim yet.
2. **Edge compatibility gate:** run the same reviewed read-only script at `BYL_AUDIT_MCP_URL=https://mcp.beyourlover.com/mcp`, record only HTTP statuses, JSON-RPC result and tool names. If denied, do not change the existing Bearer clients; choose a separate OAuth hostname/path.
3. **Preferred non-disruptive option:** keep canonical legacy `mcp.beyourlover.com/mcp` unchanged and stand up an *independent* production OAuth hostname (distinct from `mcp-uat`) with precisely scoped Access application, OAuth discovery and JWT-validated read-only principal. Only consider a same-host `/mcp` switch after inventory/compatibility evidence and explicit cutover approval.
4. Verify Cloudflare hostname/path scoped Access rule ordering, protected-resource discovery routing, and existing Basic/password/session boundary via non-secret response checks. Prepare exact backup/rollback diffs and independent origin port before any changes.
5. Canary criteria: public OAuth discovery JSON, valid owner OAuth read-only MCP initialize/tools/list, fixed hostname 3/3, no `remote_call` for OAuth read-only, invalid JWT denied, existing control login and legacy Bearer untouched, healthz checks.
6. **Rollback:** disable only the newly created OAuth Access app/tunnel route, restore previous ingress/config pointer and leave existing production `8792`/`8793` processes intact. No device restarts, production data changes, or secrets in GitHub.

Do not interpret existing broad rollout approval as permission to accept an unmeasured production authentication regression; require a passing explicit compatibility gate before any change to the canonical production `/mcp` route.

## P5 pre-cutover public edge baseline and OAuth UAT repeat — 2026-10-09

- **Legacy Bearer public-edge baseline PASS:** owner invoked reviewed script against `https://mcp.beyourlover.com/mcp`: `initialize` HTTP 200 with JSON-RPC result; `tools/list` HTTP 200 with 4 registered names (`remote_list_devices`, `remote_list_tools`, `remote_call`, `remote_process_selftest`).
- **Staging OAuth device liveness 3/3 PASS again:** via connected read-only BYL Remote MCP UAT, fixed hostname self-tests reported `as-Mac-mini.local` (US), `amacbook-pro.tail5ca8e5.ts.net` (China), `YST-241030SSD` (Windows). This does not authorize `remote_call`.
- **Production discovery remains BLOCKED:** a production OAuth canary has not yet been enabled or verified. The legacy Bearer baseline must be re-run **after** any production edge routing/Access change; today's PASS is not evidence about a future configuration.
- **Canary rollout guard:** introduce an independently scoped OAuth endpoint and associated discovery routes; verify read-only JWT principal, 401/403 denial, public discovery, no overlap with existing `/control/` or production `/mcp`; have a no-restart rollback to prior ingress/config. Do not change production credentials or restart endpoints during staging proof.
