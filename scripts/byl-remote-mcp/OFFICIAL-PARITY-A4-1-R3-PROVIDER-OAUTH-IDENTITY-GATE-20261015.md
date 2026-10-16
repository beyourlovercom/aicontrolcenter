# A4.1 R3 — ChatGPT OAuth Operator Identity and Core-5 Discovery Gate

Date: 2026-10-15
Status: **PROPOSAL / evidence and acceptance contract only, NOT production implementation**
Owner tracking: [AICC Issue #67](https://github.com/beyourlovercom/aicontrolcenter/issues/67)
Related unmerged code fix: [Draft PR #73](https://github.com/beyourlovercom/aicontrolcenter/pull/73)
Single code source: GitHub `beyourlovercom/aicontrolcenter` `main`.
Do not treat this documentation as authorization to merge, deploy, rotate keys, modify Cloudflare Access, or restart READY devices.

## 0. Decision

**Do not solve "4 legacy, 0 direct" by granting the internal shared Bearer principal operator rights.**

The remote ChatGPT MCP OAuth client normally sends its OAuth access token in the
`Authorization: Bearer <token>` header. The OAuth resource server is responsible
for validating the issuer, audience, expiry and scopes of that access token before
using it for per-user authorization. This behavior does **not** imply an additional
`cf-access-jwt-assertion` header will be supplied by ChatGPT.
Source: https://developers.openai.com/plugins/build/auth

Existing A4.1 public HTTP runtime instead:
1. recognizes its private *static internal bearer* by digest; assigns `kind:'internal'`,
2. alternatively accepts an externally verified Cloudflare Access assertion and
   resolves `kind:'cloudflare-access'`,
3. only registers the five new `dc_*` actions for a verified, operating,
   policy-approved `cloudflare-access` principal.

Static internal bearer and per-user OAuth access token MUST NOT be treated as
interchangeable identities. A delegated `remote_call` being visible to an internal
principal does not make that principal a verified human operator.

## 1. Verified evidence vs unknowns

Verified in GitHub source and synthetic tests:
- Five Core-5 tools: `dc_read_file`, `dc_list_directory`, `dc_get_file_info`, `dc_list_sessions`, `dc_list_processes`.
- Synthetic internal principal registers 0 Core-5 tools; verified Cloudflare
  Access operator registers exactly those five.
- With both credentials, the original A4 code prioritizes matching internal
  bearer; PR #73 changes that to check a supplied verified CF assertion first.
- PR #73 main CI #38838746854 and Parity CI #38838746808 SUCCESS, but PR
  remains Draft/unmerged.
- Earlier A4 Flag-OFF released and old four actions passed live smoke.
- Core-5 Flag-ON was attempted with independent timeout rollback; no valid
  five-tool provider discovery was observed.
- Formal ChatGPT app in the previous session exposed only four `remote_*`
  actions even after the owner used Reconnect / Refresh.
- Official Desktop Commander is a *different* remote connection from the
  self-hosted OAuth provider; its tool surface cannot prove A4 discovery.

Unknown; DO NOT assert:
- Which issuer produced the current ChatGPT OAuth access token.
- Whether that token is JWT or opaque, and how the resource server currently
  verifies it; a matching static internal bearer is not evidence of per-user verification.
- Whether the gateway supplies a verified Cloudflare Access assertion to the
  A4 process on real ChatGPT MCP requests.
- Which authenticated human/scopes the actual MCP session resolves to.
- Whether action refresh is blocked by provider schema caching, user role,
  service rollout state or a combination. The transient Flag-ON window had
  timed out during earlier attempts.

Do not access private JWT/token/PEM/env/headers/log payloads from chat. Previously
blocked sensitive service-inspection operations are NOT to be retried using
alternate DC/shell tools. An explicitly approved local service owner may supply
non-sensitive yes/no readiness attestations through an authorized process.

## 2. R3A — Identity provenance without secret disclosure

Before any new Production release the authorized service owner should establish,
using a reviewed local-only process and safe, category-only attestation:
- `oauth_resource_server_verifies_issuer`: true/false/unknown.
- `oauth_resource_server_verifies_audience`: true/false/unknown.
- `oauth_resource_server_verifies_expiry`: true/false/unknown.
- `oauth_resource_server_verifies_scope`: true/false/unknown.
- `operator_is_derived_from_verified_user_identity`: true/false/unknown.
- `core5_operator_policy_uses_existing_allowlist`: true/false/unknown.
- `mcp_tools_list_operator_registration_count`: sanitized integer 0..9.
- `mcp_tools_list_internal_registration_count`: sanitized integer 0..9.
- `private_values_printed`: false.

No token or payload samples; no issuer/subject/email/host values, claims,
headers or private paths in GitHub, chat or error responses.

Attestation must distinguish *registered on backend* from *ChatGPT-discovered
app actions*. Those are two independent steps.

## 3. R3B — Trusted OAuth principal design (not implemented)

If the current ChatGPT MCP connection uses a true per-user OAuth access token,
require a **trusted resource-server verifier** that:
1. Verifies token authenticity according to the actual issuer's supported
   mechanism (signed JWT/JWKS with algorithm allowlist or protected opaque-token
   introspection; fail closed if no trusted issuer mechanism exists).
2. Enforces exact configured resource audience, active state, expiry/not-before,
   issuer, authorized client and required scopes; never trusts unsigned claims.
3. Resolves a stable operator subject through a **server-owned explicit
   allowlist / installed Operator Policy**, not from self-asserted role strings.
4. Produces an internal principal type that distinguishes verified, authorized
   user/operator from legacy shared-service bearer; returns only non-sensitive
   authorization booleans to tool registration.
5. Reuses the existing `canExposeRemoteCall`, `authorizeRemoteCall` and
   synchronous redacted allow/deny audit gating for each `dc_*` call.
6. Does not modify the four fixed Agent targets or existing signing format.
7. Denies invalid bearer, wrong audience/issuer, expired/missing-scope/replayed
   tokens and non-allowlisted users without exposing sensitive details.
8. Must remain compatible with legacy internal service bearer for the old
   four-tool interface; internal bearer alone never grants Core-5.
9. If no individually verifiable OAuth identity can be derived from the
   deployed authorization server, stop: design AS/resource-server integration
   as a separately reviewed phase rather than broadening permissions.

PR #73 is useful **only for verified dual-credential requests**; it does not
implement item 1-4 above for an OAuth bearer-only client.

## 4. Must-pass identity and registration matrix

| Fixture (synthetic only) | Expected HTTP / visibility |
|---|---|
| No credentials | 401, 0 actions |
| Invalid or expired OAuth access token | 401, 0 actions |
| Wrong JWT audience or issuer | 401, 0 actions |
| Validly signed OAuth user lacking required Core-5 scope | <=3 legacy read-only actions; 0 dc_* |
| Validly signed, scoped OAuth operator, allowlisted by server | 4 legacy + exactly 5 dc_* |
| Verified but non-operator OAuth user | 3 legacy read-only actions; 0 dc_* |
| Static internal bearer only | exactly 4 old actions, 0 dc_* |
| Valid CF Access operator assertion (where actually present) | 4+5 with Core flag ON |
| Valid CF non-operator assertion | 3 old actions, 0 dc_* |
| Forged/malformed CF assertion plus valid bearer | 401 (PR #73), never silent downgrade |
| Any authenticated principal, Core flag OFF | existing applicable legacy-only actions |
| Removed audit sink or policy unavailable | no remote delegation, sanitized error |
| No authorized device / mismatched device ID | denied without upstream operation |

For signed/opaque-token verification tests use only synthetic ephemeral credentials,
no production user records, secrets or private endpoints.

## 5. R3C — Deployment and provider discovery

1. Separate GitHub review/CI for any implementation; no merge without exact-head
   Owner authorization.
2. Independent service-only rollback available; no machine reboot, Agent restart,
   Cloudflare policy change, or Woo/ERP/WWW/order/payment/mail operation.
3. Flag-OFF service smoke: HTTP health 200, unauth 401 and four legacy actions
   discoverable/callable by the existing principal.
4. Flag-ON backend `tools/list` for the *real validated operator principal*
   must return 9 names, including exactly five `dc_*`. Record *count and names
   only*, never credentials.
5. Only after 9 backend tool names are proven: refresh/publish ChatGPT app tool
   definitions as applicable and verify five **new invocable connected actions**.
   ChatGPT OAuth reconnect alone is not evidence of tool-schema refresh.
6. Fixed harmless, read-only UAT on all four devices using those five named
   tools, testing nonoperator denials and audit receipts. Existing 007windows
   hostname encoding issue must be distinguished from authorization errors.
7. Stop/rollback on any loss of the original four tools, unauthorized Core-5
   exposure, authentication regression or missing audit acknowledgement.
8. Declare A4.1 live COMPLETE only after both backend and ChatGPT tool discovery
   and four-device Owner UAT PASS.

## 6. Work sequencing and current gate

- R1: PR #73 dual-credential precedence fix — Draft, CI 2/2 PASS, UNMERGED.
- R2: Code review and security regression — documented PASS, no service changes.
- **R3: actual verified OAuth operator principal provenance and binding — OPEN.**
- R4: separately approved production service-only Canary and five-tool discovery
  — BLOCKED until R3 has a supported identity path.
- R5: four-device Owner UAT — NOT STARTED.

Owner must approve production authorization changes and exact-head merges
separately. This document is an evidence/acceptance gate only, not approval to
modify runtime identities, secrets, token issuers or deployment policy.

## Authoritative public references

- ChatGPT plugin OAuth access-token delivery and resource-server validation:
  https://developers.openai.com/plugins/build/auth
- MCP tool publication, server-side authorization and enforcement:
  https://developers.openai.com/plugins/build/mcp-server
- OpenAI MCP tool discovery and bearer authentication:
  https://developers.openai.com/api/docs/guides/tools-connectors-mcp
