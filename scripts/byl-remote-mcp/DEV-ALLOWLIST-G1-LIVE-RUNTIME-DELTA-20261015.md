# G1 Live OAuth Runtime Compatibility Delta — Read-only Evidence (2026-10-15)

**Purpose:** preserve the working four-device production OAuth MCP while preparing a separate Dev deployment capability. This evidence is NOT deployment authority.

## Sources and method

- Live service source inspected **read-only** through formally connected OAuth MCP `remote_call(deviceId=us-macmini, name=read_file)`, targeting specific code files under `~/.byl-remote-mcp/oauth-production-v1/`. The observed directory contains `mcp-endpoint.mjs`, `operator-policy.mjs`, `endpoint-routing.mjs`, and `access-auth.mjs`.
- Reference: GitHub `beyourlovercom/aicontrolcenter`, ref `docs/byl-mcp-production-cutover-gate-v1`, paths `scripts/byl-remote-mcp/<name>`.
- Comparison strips Desktop Commander `[Reading ...]` framing and compares source lines. Device private network addresses and authorization material are not copied here.
- This is a *source-file* observation only. It does not independently establish the process currently bound to each public route, nor SHA of the loaded JS module in memory. The runtime process/route cutover proof must be gathered by the authorized service owner before any change.

## Exact observed differences

### `mcp-endpoint.mjs` — 130 lines live vs 128 lines in historical GitHub ref
- Live `TARGETS` adds the fourth device `007windows` and leaves the existing three entries intact.
- Three tool argument sites now use bounded device ID string validation (`z.string().min(1).max(64)`) instead of the historical explicit three-item `z.enum(...)`, so the fourth device can be addressed. This still requires independent runtime `TARGETS`/authorization enforcement; do not treat string schema as unrestricted device permission.
- Live source includes a comment enforcing the existing full-exec Operator policy for `007windows`.
- Neither live nor historical source registers `dev_release_status`, `dev_release_prepare`, `dev_release_apply`, or `dev_release_rollback`.

### `operator-policy.mjs` — 131 lines live vs 129 lines in historical ref
- Live `OPERATOR_DEVICES` includes `007windows` alongside US Mac mini, China Mac and Windows.
- Live policy documents that `007windows` inherits the existing OAuth full-exec gates and approved tool allowlist.
- Live has an `007windows`-specific `get_config` allowance.
- **Do not silently remove or broaden these existing controls** during source reconciliation.

### `endpoint-routing.mjs` and `access-auth.mjs`
- Read-only contents match the respective historical GitHub reference after stripping transport framing and terminal whitespace. These observations are not a substitute for an installed-runtime checksum attestation.

## Mandatory G1 fail-closed criteria

1. Preserve all four live devices, their existing operator capability and explicit tool argument boundary.
2. Preserve all current OAuth device tools and existing SDK `tools/list` / `tools/call` handlers. A new Dev tool adapter must not overwrite or shadow them. Prefer a separately registered Dev-only runtime.
3. Keep production `/oauth/mcp`, legacy `/mcp`, issuer/AUD, existing owner allowlist, and server service stable; no restarting READY devices.
4. Introduce `dev_release_status` read-only first after separately authorized source parity, server registration and ChatGPT app action-review flow.
5. Do NOT copy/merge the historical PR #51 wholesale. Preserve the current deployed source, then reconcile reviewed exact deltas back to the GitHub main target through separate owner-approved source-control steps.
6. Keep G2 Dev receiver and journal security gates; prior attempted journal symlink-safe read/fsync update was blocked by the platform and remains NOT written. Do not bypass that specific refusal.
7. G3/G4 require the newly fetched exact YBY-Core PR #103 SHA, green CI, immutable artifact, Owner receipt, Dev runtime preimages, verified rollback and desktop/iPhone 14 Owner UAT.

## Result

**G1_RUNTIME_SOURCE_DELTA_CONFIRMED — G1_FORMAL_TOOL_REGISTRATION_BLOCKED**. Candidate PR #66 provides only isolated contract/activation checks; no new action is installed in production OAuth MCP. The safety checklist requires `existingRemoteToolsPreserved` and `fourDevicePolicyPreserved` before any Dev canary is marked ready.
