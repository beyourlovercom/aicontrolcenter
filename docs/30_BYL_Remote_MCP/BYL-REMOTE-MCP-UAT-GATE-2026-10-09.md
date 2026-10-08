# BYL Remote MCP — Read-only UAT Gate V1

Status: **PARTIAL PASS / AUTHENTICATED TOOL GATE BLOCKED** (2026-10-09).
No production deployment, configuration changes, credential reads, restarts, or business-data writes were performed.

## Source of truth
- Repository: `beyourlovercom/aicontrolcenter`.
- Test branch: `test/byl-remote-mcp-readonly-uat-v1`, branched from `feature/byl-remote-mcp-v1`.
- Test files: `scripts/byl-remote-mcp/uat-mcp-readonly.mjs` and `uat-mcp-readonly.test.mjs`.
- Production MCP source observed on US Mac: `/Users/a/AI/007/worktrees/byl-remote-mcp-v1/scripts/byl-remote-mcp/mcp-endpoint.mjs` (untouched).

## Evidence
1. China Mac isolated test clone under `/tmp/byl-mcp-uat-20261009`: `node --test scripts/byl-remote-mcp/uat-mcp-readonly.test.mjs` -> **6 tests PASS / 0 FAIL**.
2. US Mac isolated temp directory `/tmp/byl-mcp-uat-20261009`: the same 6 tests -> **6 PASS / 0 FAIL**.
3. US Mac local `http://127.0.0.1:8792/healthz` -> **HTTP 200**.
4. US Mac local unauthenticated POST to `http://127.0.0.1:8792/mcp` -> **HTTP 401**, negative-auth **PASS**.
5. Authenticated initialization, tools/list, registration and hostname for `us-macmini`, `china-mac`, `windows` -> **BLOCKED: NO_LOCAL_TEST_CREDENTIAL**. No authenticated tool operation is claimed.
6. China Mac curl to public `/healthz` -> **HTTP 200**, while Node HTTPS fetch returned `UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Never disable TLS verification to work around this. US Mac localhost HTTP tests are unaffected.

## Strict read-only scope
The test client only invokes MCP `initialize`, `tools/list`, `remote_list_devices` and `remote_process_selftest` (fixed `hostname` tool). It checks anonymous rejection and validates host identities for each canonical device. No arbitrary `remote_call` is executed even though its presence must be discoverable. The current MCP `remote_list_devices` implementation returns fixed registered devices labelled READY; **that label is not a live heartbeat**.

## How to repeat without exposing secrets
Run on the authorized US Mac mini with Node 20+ from a copied/test worktree:
```bash
node --test scripts/byl-remote-mcp/uat-mcp-readonly.test.mjs
node scripts/byl-remote-mcp/uat-mcp-readonly.mjs
```
The second command performs health and negative-auth tests only, prints `BLOCKED` and exits code 2 if no authorized credential is available. For full production tool UAT, a responsible operator must inject `BYL_MCP_UAT_BEARER` securely into the *local process environment*, never into chat, git, command-line arguments, CI logs or a copied file. A credential must **not** be harvested, printed, or relayed by remote debugging tools. Only after appropriate authorization and secure injection:
```bash
node scripts/byl-remote-mcp/uat-mcp-readonly.mjs
```
No password, private-key or token values are stored in the test code or this document.

## Pass criteria for next owner UAT
- Real `initialize` and `tools/list` succeed under the authorized identity.
- All four expected tools are advertised.
- All three `remote_process_selftest` hostname checks pass.
- HTTP 401 for unauthenticated MCP POST remains enforced.
- No restart, credential disclosure or business data writes.
- ChatGPT Plus OAuth direct plugin UAT is **separate**, and presently blocked by OAuth discovery: `/.well-known/oauth-protected-resource` and the authorization server discovery endpoints returned 401. Do not substitute controller-password login for OAuth.

## Safety
GitHub is the canonical record; test artifacts in `/tmp` are isolated from production. The old vendor DC was used only as a temporary inspection transport through China Mac; a vendor Offline indicator is not BYL self-hosted uptime evidence. No production rollout without a separate gate.
