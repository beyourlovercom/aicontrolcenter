# DC MCP Dev Allowlist V1 — G1 Runtime Source Parity and Activation Gate

Date: 2026-10-15. Status: **READ-ONLY AUDIT / NO RUNTIME CUTOVER**.
Parent: [Issue #65](https://github.com/beyourlovercom/aicontrolcenter/issues/65). Candidate: [Draft PR #66](https://github.com/beyourlovercom/aicontrolcenter/pull/66).

## Evidence observed

- `beyourlovercom/aicontrolcenter` default `main`: `7a7fc8310191272346e3dda43711fa71ffeabc15`. It contains the existing standalone GUI MCP and V2 pure libraries, but not `scripts/byl-remote-mcp/mcp-endpoint.mjs`, `operator-policy.mjs`, or the PR #66 Dev tool registration implementation.
- Prior production OAuth candidate source is in open, unmerged PR #51 (`head=776617c3635bca6b31bdc6a4edbe45fbec4d6334`, targeting `feature/byl-remote-mcp-v1`, **not** `main`). That branch is not a production runtime provenance or approval substitute.
- Read-only source blob comparison on historical gate ref `docs/byl-mcp-production-cutover-gate-v1`:
  - `mcp-endpoint.mjs` Git blob `b8048cb1d884dbe89cb3b82e85a72ba9b61c901b` (129 lines): generic remote tools, hardcoded TARGETS/static READY; **no `dev_release_*`**.
  - `operator-policy.mjs` blob `367de00c7ad6edd70e99d73906c3199b13696ace` (130 lines): policy for existing remote calls; **no dedicated Dev release action**.
  - `endpoint-routing.mjs` blob `1747ee332102c51a89b58bd13f5e772de5cd94c0`: controls candidate dedicated `/oauth/mcp`/8797 path.
  - `oauth-compat-persistent-config.mjs` blob `27ec62f03cf69f74b095e88e7c2e0dc7037f2d64`: secured runtime startup config.
- Formal connected OAuth MCP `remote_list_tools(us-macmini)` currently returns generic DC tools; **no** `dev_release_prepare`, `dev_release_status`, `dev_release_apply`, `dev_release_rollback`. The returned device list is not evidence of a new action being registered.
- Current isolated PR #66 includes `dev-allowlist-mcp-registration.mjs` + `dev-allowlist-mcp-tools.mjs`, but they are **not imported by the live server, installed, or discovered by ChatGPT**.
- AICC PR #66 was previously validated by Foundation CI and specialized CI (64/64 before 2026-10-15 new activation tests). Treat each new HEAD separately.

## G1 implementation plan — strictly non-disruptive

1. **Inventory live runtime read-only** through officially approved operator route: active service path/code hash, `/oauth/mcp` resource identity, OAuth principal policy, installed MCP SDK version, registered tool names and serving process boundary. Do not assume history reflects current process.
2. **Reconcile minimal source** with GitHub main, not wholesale copying PR #51 or resurrecting divergent runtime. Preserve existing `remote_list_devices`, `remote_list_tools`, `remote_call`, `remote_process_selftest` and legacy Bearer `/mcp`; no broadening of remote command permissions.
3. **Register one isolated, read-only `dev_release_status` first** using the fixed input schema and verified principal. Never replace the production server's existing `tools/list` and `tools/call` handlers with a separate handler that would remove existing tools. A composed registry must preserve the previous commands and correct authorization boundaries.
4. **Verify formal ChatGPT app tool availability** and approved action review under the user's actual permitted app administration workflow. This is independent of the server responding to its own endpoint.
5. Only after successful status canary, separately gate `prepare` with trusted authority, official build artifact reader, protected out-of-Web backup, PHP lint, durable receipts, and crash-safe recovery.
6. `apply` / `rollback` remain disabled until a real Dev-only preimage audit, Owner release receipt, security tests, and explicit Canary approval. No WWW/ERP/Production changes or READY device/process restarts.
7. An OpenAI tool-level safety denial is a terminal block for the affected operation. Do not retry under another name, alternate tool/device, encoding, or transport.

## Acceptance statuses

- `G1_BLOCKED`: production runtime provenance unknown, server tool absent, tool reviewer cannot expose action, or old runtime/main mismatch (CURRENT).
- `G1_STATUS_READ_ONLY_PASS`: tool truly registered in the approved runtime, current ChatGPT client invokes it with verified identity, denied clients cannot enumerate/call, legacy tools unaffected, and no target writes.
- `G2_PREPARE_PASS`: authorized immutable Owner/GitHub/CI/Artifact release, exact 3-file Dev root, protected backup, verified recovery receipt, **zero running-file changes**.
- `G3_DEV_CANARY_PASS`: explicit Owner receipt and exact 3-file runtime SHA, atomic apply, complete smoke, rollback proof, no Commerce/WWW change.
- `G4_OWNER_UAT_PASS`: Owner manually accepts Desktop + iPhone14 (~390 px) and role/legacy-link checks; main merge and WWW roll-out are independent.

## Source-of-truth caveat

A GitHub CI success proves tested candidate source, **not** the installed production OAuth runtime nor Hostinger Dev receiver. All code remains in Draft PR until explicit exact-head merge approval. Do not claim any live deployment without service-side attestations and site-side before/after SHA evidence.
