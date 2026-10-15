# DC Official Parity V1 — A4 Core-5 Activation Gate (2026-10-15)

**Scope:** AICC Issue [#67](https://github.com/beyourlovercom/aicontrolcenter/issues/67), Draft PR [#68](https://github.com/beyourlovercom/aicontrolcenter/pull/68). GitHub \`main\` is the sole eventual implementation fact source. This document is a **read-only deployment readiness contract**, not an approval to merge, register, deploy, edit network routes or restart any READY device.

## What is already real
- Public AICC repo: Actions runner billing/spend-lock prevented job provisioning while private; public conversion restored the runner. On exact HEAD \`14fd63c4464e9508e75dfcdd0e712c0ca62d8e51\`, isolated named-tool and existing V2 signed-health tests **79/79 PASS**. Foundation CI must be checked on this same HEAD separately.
- Formal connected OAuth MCP still offers **four top-level tools** and a delegated list of 24 DC device operations, **no** \`dc_*\` direct tools. This is confirmed from the connected provider, not inferred from GitHub.
- Four devices \`us-macmini\`, \`china-mac\`, \`windows\`, \`007windows\` previously responded to fixed read-only hostname and file-info requests; this verifies the existing wrapper path, **not** that a new \`dc_*\` tool is installed.
- Installed US Mac mini OAuth runtime uses a fresh \`McpServer\` per verified HTTP request. \`getServer(principal)\` registers the existing \`remote_*\` tools; \`canExposeRemoteCall(principal)\` controls whether \`remote_call\` is discoverable, and \`authorizeRemoteCall(principal,deviceId,name,args)\` authorizes every delegated call. This running version has \`007windows\` functionality missing from the historical GitHub candidate. Existing production \`mcp-endpoint.mjs\` and \`operator-policy.mjs\` are **not on AICC main**.

## A4.0 candidate code contract — exact five read-only named tools
- \`official-parity-sdk-registration.mjs\` defaults \`enabled=false\`. In trusted, request-local integration \`mode='core'\`, it registers exactly \`dc_read_file\`, \`dc_list_directory\`, \`dc_get_file_info\`, \`dc_list_sessions\`, \`dc_list_processes\`.
- **Both** \`principal.kind==='cloudflare-access'\` and \`principal.canOperate===true\`, **and** existing \`canExposeRemoteCall(principal)===true\`, are mandatory before registering these additional names. The last condition is important: new tool discoverability MUST NEVER exceed old \`remote_call\` discoverability.
- Each direct operation routes through unchanged \`authorizeRemoteCall\` with **the same verified request principal**; delegate to the existing signed fixed-target \`agentCall\` using \`createParityAgentDelegate({agentCall})\`. The delegate permits only five read-only operation names and known device IDs; it normalizes existing \`out.result ?? out\` responses, restricts output, and explicitly rejects upstream failure.
- No generic shell, \`write_file\`, process termination, new arbitrary host/device input, or change to a user's existing OAuth/Agent permissions.
- Confirm \`remote_list_devices\`, \`remote_list_tools\`, \`remote_call\`, \`remote_process_selftest\` unchanged in both tool list and response semantics. The per-request \`McpServer\` instance and the production Operator Policy must be preserved.

## A4.1 is **optional, later** — signed health/Ping
- \`dc_list_devices_live\` and \`dc_ping\` remain hidden unless separately attested fixed-target signed Agent transport, four pinned Ed25519 public keys, verified identity/nonces/timestamps, no fake \`READY\`, and operator authorization for both list and ping are proven. No such live signed-Agent deployment has occurred.
- Gating \`signedAgentEvidenceVerified=true\` in the pure SDK candidate is **not enough by itself**: proof must be independently produced and reviewed by the trusted runtime owner.

## Operator source parity / launch sequence — steps **not yet authorized**
1. **Read-only service provenance:** trusted operator attests the exact files and loaded process serving formal \`/oauth/mcp\`; compare current four-device installed operator policy to tracked canonical source. Do not copy historic PR #51 over the running source. Keep environment-specific addresses, keys and tokens **out of public GitHub**, including all commit history and Actions output.
2. **Review GitHub source reconciliation:** establish a new explicitly scoped, credential-free canonical runtime implementation through GitHub code review; retain existing OAuth, owner allowlist, routes, old tools, full-exec capability gates, 007windows compatibility, and 4-device rollback pointer. Draft PR #68 does NOT itself modify a production entrypoint.
3. **Read-only tool registration Canary (separate Owner release authorization required):** approved operator deploys only reviewed runtime change using a service-specific, least-privilege route, without restarting any READY device. No network/Cloudflare change. New tool names discoverable only for an authorized existing OAuth principal; unauthorized subjects must not be offered them.
4. **Official client and four-device UAT:** refresh/review tools through supported app administration where available. Validate five \`dc_*\` reads on all four devices using harmless fixed fixtures; compare both legacy \`remote_call\` and new direct tools; deny unauthorized principal, unknown device, arbitrary operation and overlong result. Report exact observed tool names; don't claim parity from server-side mocks.
5. **Rollback and closure:** record old/new tool list, code provenance, CI SHA, owner UAT evidence and rollback plan. Do not auto-merge this PR into main or start WWW/ERP/Production operations.

## Current state
A0 DONE; A1–A3 GitHub isolated; A4 core-5 per-request protocol and Operator visibility tested in CI; live SDK tool registration and Owner UAT **NOT STARTED**. Dev Deployment OS Draft PR #66 remains paused. **No READY device restart, no production OAuth/MCP deployment, no change to ChatGPT app permissions, and no workaround of an unrelated prior platform safety denial.**


## 2026-10-15 exact installed-source read-only parity evidence
- A read-only four-file comparison to historical GitHub branch \`docs/byl-mcp-production-cutover-gate-v1\` established that the installed \`access-auth.mjs\` and \`endpoint-routing.mjs\` are byte-equivalent after trimming final whitespace.
- Installed \`mcp-endpoint.mjs\` differs from historical only by the fourth fixed \`007windows\` target, three \`deviceId\` field schemas changed from three-device enum to bounded 1–64-character strings, and a fourth-device authorization comment. The existing trusted device target resolver still uses fixed registered device IDs.
- Installed \`operator-policy.mjs\` differs only by registering \`007windows\` in \`OPERATOR_DEVICES\`, adding a fourth-device scope comment, and permitting \`get_config\` for that device under existing full-exec conditions.
- In-memory normalization of only these enumerated deltas produced equality on all four file texts; **no unexpected installed-source drift was observed within this four-file comparison**. This does not verify other installed Agent/gateway files, environment settings, actual Cloudflare routes, or original public Git history.
- New \`official-parity-source-audit.mjs\` and tests provide a pure, read-only, no-leakage comparison, refusing unknown auth/routing/tool/target deltas. **The module is not executed on production devices and its results are not a substitute for code review.**
- **Public GitHub safety:** the comparison logs no private target addresses or auth-key paths. Do not copy raw installed \`mcp-endpoint.mjs\` to Public GitHub because it contains machine-specific runtime configuration. The canonical source must use a separately reviewed config contract.

## 2026-10-15 per-operation audit gate
- To retain the original \`remote_call\` audit protection, \`registerOfficialParityV1\` now also REQUIRES a **trusted, synchronous \`auditOperation\` sink** before exposing any direct tool. The sink receives only \`decision\`, \`principalHash\`, \`deviceId\`, and canonical \`operation\`; no raw file paths, token material, command arguments or returned data are supplied.
- Every allowed operation must obtain \`auditOperation(...)=true\` **before** the delegate is called; a missing, throwing or rejecting audit sink fails closed with no remote operation. Operator rejection attempts a redacted deny audit and remains denied regardless of sink status.
- The candidate \`official-parity-oauth-hook.mjs\` passes this audit function from the trusted per-request server integration. Production must implement an actual reliable logger and explicitly acknowledge the receipt, rather than a silent/no-op function. No live audit logger wiring has been approved or performed.
