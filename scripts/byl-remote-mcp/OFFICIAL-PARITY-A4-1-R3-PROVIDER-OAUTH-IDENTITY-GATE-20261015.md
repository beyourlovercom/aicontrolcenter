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


## 7. Public OAuth discovery probe — verified full Cloudflare Managed OAuth chain, 2026-10-15

### 7.1 Owner UI evidence

Owner screenshot of Cloudflare Zero Trust > Access controls > Applications >
"BYL MCP OAuth Production" > OAuth settings shows **Managed OAuth ON**
and two ChatGPT callback URI entries. It is an edit view, thus does not
independently prove the settings were saved. No values were changed/saved.
The HTTPS response evidence below independently verifies a Managed OAuth
challenge is active at the live public hostname.

Cloudflare's documented Managed OAuth sends **opaque** OAuth access tokens
to clients; Cloudflare resolves them at the edge and forwards its **signed
Cf-Access-Jwt-Assertion** to the origin. The origin must cryptographically
validate the JWT and apply server-owned Operator Policy. An extra OAuth-JWT
access-token verifier (Draft PR #76) does not apply to Cloudflare's opaque
client token unless an independent OAuth issuer is actually in use.
Sources:
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/managed-oauth/
- https://developers.cloudflare.com/cloudflare-one/access-controls/applications/linked-app-token/

### 7.2 Credential-free public URL tests

Using official Desktop Commander on US Mac mini, read ONLY public HTTPS
status, content-type classification and presence of OAuth standard fields.
Never sent a bearer, cookie, JWT or Cloudflare API credential; no response
body/token values were printed or saved.

| Path and discovery method | HTTP | Result |
|---|---|---|
| GET \`https://mcp.beyourlover.com/oauth/mcp\` unauthenticated | **401 JSON** | **Bearer** \`WWW-Authenticate\` header with \`resource_metadata\` URI |
| Follow **exact resource_metadata URI** supplied by challenge | **200 JSON** | Resource matches the MCP origin; has \`authorization_servers\`, Cloudflare protected-resource metadata marker |
| Follow listed Cloudflare Access AS issuer to \`/.well-known/oauth-authorization-server\` | **200 JSON** | Issuer matches listed AS; authorization endpoint, token endpoint, client registration endpoint; **PKCE S256** supported |
| Naïve GET \`/.well-known/oauth-protected-resource\` on MCP hostname | 401 HTML | Not the metadata URI advertised by Cloudflare's actual challenge |
| Naïve GET \`/.well-known/oauth-authorization-server\` on MCP hostname | 401 HTML | Not the actual listed Cloudflare Access AS issuer hostname |
| GET \`/healthz\` | 200 | Normal health |

**Correction to prior interim hypothesis:** The canonical bare MCP-host
\`/.well-known/oauth-*\` probes were insufficient. Cloudflare advertises an
alternate **\`/.well-known/cloudflare-access-protected-resource/...\`**
URI in the Bearer challenge, and that exact URI returns valid public JSON.
The AS is a different authorized \`*.cloudflareaccess.com\` hostname whose
metadata also returns valid JSON. Therefore public OAuth *discovery* has
**PASS** evidence. Do NOT make metadata-only Cloudflare bypass rules or
change Managed OAuth on the basis of earlier naive 401 results.

This PASS does NOT prove the origin got a verified user JWT, that the
installed Operator Policy authorized the operator, that the feature flag
was ON during ChatGPT refresh, or that five new named actions have been
registered and discovered. These remain independent live gates.

### 7.3 Narrowed next gates

1. Keep Cloudflare Managed OAuth and both allowed ChatGPT redirect URIs
   unchanged; do not modify Cloudflare, issuance, session lifetime, scopes
   or token policy without a separate approved change.
2. Existing A4 runtime already exposes a Cloudflare JWT verification hook
   (\`resolveAccessPrincipal\`) and requires the installed
   \`canExposeRemoteCall\` and \`authorizeRemoteCall\` gates. Verify using
   a **previously approved, non-sensitive and policy-compliant** attestation
   that a real operator request is classified as \`cloudflare-access\` and
   passes Operator Policy; emit booleans / registered name count only,
   never tokens, subjects, headers, private files, audit contents or env.
   Prior platform-blocked private service introspection MUST NOT be
   reproduced via alternate tools.
3. Independently determine whether Core-5 is Flag-ON during discovery and
   whether the **backend** tools/list for a legitimately verified operator
   advertises exactly 9 names. Do not infer from static READY or code mocks.
4. Only when authenticated backend 9-tool list passes, refresh the
   ChatGPT plugin action schema and verify the five newly invocable \`dc_*\`
   names. Existing ChatGPT action inventory was 4 legacy/0 direct on
   prior rechecks.
5. 4-device fixed innocuous read-only Owner UAT, ACL denial/audit proof,
   rollout/rollback confirmation are mandatory for stage closure.
6. Draft PR #73 is only the **both-credentials** precedence corner case;
   normal Cloudflare Managed OAuth client opaque bearer plus injected
   validated CF JWT should already follow the CF verifier when the
   bearer does not equal the internal static service token. Do not claim
   PR #73 alone solves current missing-tool discovery.
7. Draft PR #76 is an **unwired JWT client-token candidate**, not a fix
   for Cloudflare-issued opaque tokens. Keep it Draft unless an actual
   independently verified JWT issuer integration is required.

## 8. Revised R3 disposition

- Public OAuth discovery: **PASS** (challenge -> actual resource metadata
  -> actual Cloudflare AS metadata, including DCR and PKCE S256).
- Origin user identity / operator policy: **NOT YET PROVEN LIVE**.
- Feature-flag state during provider schema discovery: **NOT YET PROVEN**.
- Backend 9-tool authorized tools/list: **NOT YET PROVEN**.
- ChatGPT five *newly invocable* direct actions: **NOT YET PROVEN**.
- Four-device Owner UAT: **NOT STARTED**.
- No secret/profile/token inspection, Cloudflare mutation, device restart,
  PR merge, Production runtime write or browser reconnect in this step.
