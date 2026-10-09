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
