# P6 — BYL Remote MCP OAuth Operator Authorization UAT

Status: **DESIGN / NOT OPERATOR-ENABLED**. Environment: independent `mcp-uat.beyourlover.com` OAuth staging only. Owner requested advancement to P6. Do not turn on operator access on production.

## Existing implementation (already in development baseline)

- `scripts/byl-remote-mcp/access-auth.mjs` validates Cloudflare Access RS256 JWT signature via JWKS, issuer, audience, expiry/not-before and an exact normalized email member of `BYL_MCP_ACCESS_READ_EMAILS`.
- `BYL_MCP_ACCESS_OPERATE_EMAILS` is a separate exact-email allowlist and must be a subset of read members; default empty.
- `resolveAccessPrincipal` sets `canOperate=true` only for authorized operator email.
- `mcp-endpoint.mjs` registers `remote_call` **only when** `principal.canOperate`; `remote_process_selftest` executes only the fixed `hostname` command.
- Existing internal Bearer credential grants the legacy internal operator principal. Do not modify, expose, or replace it.
- **Threat note:** `remote_call` delegates to upstream agent tool registry; once granted, this is powerful remote execution capability across all three devices. Staging promotion needs an explicit tool/action allowlist, auditable exact principal/device/action decision and write/restart protections, not merely an email check.

## P6 acceptance criteria

1. **Role configuration:** staging application Access Owner Only policy is verified for exact owner identity; JWT issuer and audience match staging application. Only owner explicitly approved for operator role; all other email principals read-only or denied.
2. **Code/tests:** unit tests cover disabled Access, missing/forged JWT, wrong issuer/audience, expired/not-yet-valid JWT, outsider email, operator-subset constraint, email case normalization, and missing operator email yields `canOperate=false`. Include negative `remote_call` exposure via MCP `tools/list`, not just unit principal flags.
3. **Privilege boundaries:** scope operator to approved devices and actions; deny destructive commands, production writes, service restarts and secret reads by default. Implement allowlist / owner action gate rather than opening arbitrary upstream process execution. Log metadata only (principal ID hash, device, tool, decision, timestamp), never credentials or command secrets.
4. **Staging-only deployment:** back up isolated staging environment/config; update only staging operator allowlist after tests, and never modify production 8792, control console 8793, production Cloudflare Access, token or agent services. No reboot of READY devices.
5. **Dual-principal UAT:** re-connect OAuth as operator; `tools/list` should include `remote_call`, and a fixed approved harmless read-only command succeeds on each device. Read-only identity's `tools/list` must NOT expose `remote_call`. Forged JWT, outsider and non-approved tool requests denied.
6. **Regression:** verify legacy Bearer initialize/tools/list at localhost and public production unchanged, old `/control/` authentication, independent UAT discovery 200 JSON, live three-device hostname 3/3.
7. **Rollback:** remove staging operator allowlist/revert staging origin only; prove read-only plugin continues to work. No production cutover without separate security/edge compatibility gate.

## Execution checkpoints

- **P6-A:** role model and deny-list/allowlist regression tests; independent code review.
- **P6-B:** staging-only privilege enforcement and audit evidence.
- **P6-C:** staging operator OAuth connector tool-list and 3-device harmless read-only calls.
- **P6-D:** negative-auth and recovery validation.
- **P6-E:** owner confirms Operator UAT PASS; only then plan production rollout under P5/P7 separate gate.

## Current evidence

- P4: both localhost and public-edge legacy Bearer `initialize`/`tools/list` HTTP 200.
- P5: independent OAuth staging read-only plugin and 3/3 live hostname PASS, but production OAuth Discovery remains 401/404 and not ready.
- This document is an implementation plan, **not** evidence that operator permissions have been enabled or UAT passed.

## P6-C live staging route decision — 2026-10-09

**Observed today:** independent processes respond HTTP 200: legacy prod localhost 8792, read-only OAuth UAT 8794, Operator candidate 8795. Cloudflared UAT ingress dry-run routes `https://mcp-uat.beyourlover.com/mcp` to 8794. Alternate path `/operator-mcp` on the same hostname would also route to 8794 and has no matching operator handler: changing URL path alone does not work.

**Safe target:** separate `mcp-operator-uat.beyourlover.com/mcp` with its own narrowly scoped Cloudflare Access Managed OAuth app, Owner Only policy, exact callback allowlist, independent ingress pointing only to localhost 8795. This hostname is **proposed; neither DNS nor Access app existence has been verified**. It must not be added to a wildcard Access policy or overwrite the 8794 application's routes.

**Staging candidate code flags:** `BYL_MCP_STAGING=1`, `BYL_MCP_UAT_CANDIDATE=1`, `BYL_MCP_OPERATOR_CANARY_ENABLED=1` plus `BYL_MCP_ACCESS_ENABLED=1`, with exact new Access issuer/AUD, and operator/read email allowlists containing only a verified approved owner identity. Keep Access values private and outside GitHub. The currently running 8795 process was started without operator auth and must not be misrepresented as an Operator-capable service; activation requires separately controlled candidate restart only after preserving rollback.

**Minimum pre-live gates:**
1. Create isolated Access application and verify its exact hostname, audience, authorized email policy, discovery JSON and fixed OAuth callback behavior. Do not alter production or existing UAT policies.
2. Back up current 8795 candidate files, configuration metadata and process ownership; prepare revert route and prior launch state, never print credentials.
3. Confirm current source hash and run 13+ identity/policy tests and MCP syntax check on US Mac mini, plus GitHub CI current commit.
4. Restart **only** isolated 8795 candidate with exact authenticated environment and candidate flags; demonstrate unknown/anonymous requests rejected and unauthenticated tools not leaked.
5. Add separate candidate tunnel ingress/DNS after Access app readiness; verify all three hostnames' route targets and no path overlap.
6. In ChatGPT add **separate** Operator UAT plugin, sign in through exact approved Owner identity; verify `remote_call` is listed and only fixed `start_process`/`hostname` per device is permitted. Verify unsafe shell injection/file reads rejected and old read-only UAT connection continues to omit `remote_call`.
7. Re-run public legacy Bearer initialize/tools/list, production health, original UAT live 3/3 and control-console login; then rollback candidate route/flags and confirm read-only behavior.

**Blocker as of this audit:** no connected Cloudflare account write integration to verify/create isolated Access app; Cloudflare app/DNS and exact Operator OAuth callback have not been established. Therefore P6-C operator online UAT remains PENDING. Do not substitute an unprotected public tunnel route or copy production Bearer token into the ChatGPT app.

## 2026-10-09 Owner architecture correction — REUSE EXISTING OAUTH HOSTNAME

The owner rejected the extra `mcp-operator-uat.beyourlover.com` domain/Access application. The previous section proposing that hostname is **superseded and must not be implemented**. The existing production `/control/` password/session flow is separate from MCP OAuth; no additional console password/hostname is needed for Operator testing.

**New approved same-host split:**
- Existing `https://mcp-uat.beyourlover.com/mcp` → localhost **8794** (read-only OAuth UAT, preserve as-is).
- Existing code path `https://mcp-uat.beyourlover.com/__byl_remote_mcp/mcp` → localhost **8795** (isolated Operator candidate after private OAuth configuration and Canary activation).
- Keep the *same* existing hostname-scoped Cloudflare Access Managed OAuth application, Owner Only policy and OAuth discovery. No new Access app, domain or public password flow.
- OAuth per-user tool authorization is independently enforced by MCP origin. Only candidate service can advertise remote_call when `BYL_MCP_STAGING=1`, `BYL_MCP_UAT_CANDIDATE=1`, `BYL_MCP_OPERATOR_CANARY_ENABLED=1` and JWT-validated owner is on both read/operator allowlists. The allowed call is exclusively `start_process` with `command:'hostname'`, timeout 8000, on the three enumerated devices.
- After successful online UAT, reverse the path-specific ingress rule to return Operator alias to 8794 or deny by default, and disable candidate Canary; original `/mcp` route remains untouched throughout.

### Read-only technical proof
- Unauthenticated public GET `/__byl_remote_mcp/mcp` returned **401** with `WWW-Authenticate: Bearer` challenge and resource_metadata URL for that exact path. Corresponding `/.well-known/cloudflare-access-protected-resource/__byl_remote_mcp/mcp` returned **200 JSON**. These requests currently resolve to the *old 8794 service*, not the candidate; this proves discovery can be path-specific, not yet candidate connectivity.
- Created **shadow-only** tunnel configuration `/tmp/byl-mcp-uat-route-candidate-20261009.yml` on US Mac mini (original remains unmodified). Cloudflared `ingress validate`: **OK**.
- Shadow ingress dry-run `/mcp` → rule #1 `127.0.0.1:8794` PASS; `/__byl_remote_mcp/mcp` → rule #0 exact path `127.0.0.1:8795` PASS.
- **No running tunnel changed/restarted.** Production 8792 and staging 8794 remain healthy. Live 8795 candidate still needs authenticated owner JWT configuration and exact-source runtime restart.

### Remaining secure activation gates
1. Securely reuse the existing *staging* Access issuer/AUD/owner email locally, without printing credentials or copying process environment into logs; verify exact app audience for both OAuth paths and owner-only policy.
2. Configure and start only the isolated candidate process 8795 with Access validation and single-owner operator allowlist, both explicit Canary flags; read-only/denied behavior verified before changing tunnel ingress.
3. Back up active UAT tunnel configuration, apply only exact-path ingress rule with rollback plan; ensure original `/mcp` remains on 8794. Observe public challenge/discovery from Operator path without exposing old legacy credentials.
4. Create a *separate ChatGPT custom MCP connection* to the Operator **path** (same host/OAuth app). Verify it negotiates OAuth and advertises only the authorized `remote_call`. Test harmless hostname on 3/3 devices and negative calls. Do not claim UAT PASS before real tool invocation.
5. Restore candidate route/role on UAT failure. After success rerun preexisting Read-only UAT and legacy production Bearer compatibility.

Current gate: shadow routes and public path discovery **PASS**; Operator authenticated 8795 and online client verification **PENDING**. The domain mentioned in the superseded section is not reachable and should not be created.
