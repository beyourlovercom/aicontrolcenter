# DC MCP Dev Deploy — G1 isolated read-only sidecar acceptance (2026-10-15)

**State: GitHub candidate; NOT LIVE.** Owner authorizes Dev-only work, not a change to the production OAuth Gateway. GitHub [PR #66](https://github.com/beyourlovercom/aicontrolcenter/pull/66) is Draft and remains unmerged. [Issue #65](https://github.com/beyourlovercom/aicontrolcenter/issues/65) is the tracking issue.

## Decision: isolated Dev sidecar instead of rewriting live OAuth/DC handlers

The live US Mac mini OAuth endpoint source includes four device targets including `007windows` and additional authorization rules compared to the old PR #51. The current service has independent historical MCP endpoint processes; we do not know the public route → PID/process source attestation. No `dev_release_*` tool is currently registered.

We therefore implement a **new** Dev-only MCP SDK `Server` object in `dev-allowlist-isolated-server.mjs` rather than passing the running production server to `registerDevAllowlistMcpHandlers`. The isolated constructor intentionally performs **no port bind, no process start, no host file IO, no OAuth/Cloudflare changes and no runtime registration**. SDK construction and process management are separate operator-controlled operations; do not assume GitHub tests have installed the service.

### Default capability

- `allowMutatingTools=false` is the unconditional default: only `dev_release_status` can be visible/invoked.
- Read-only status additionally requires a server-verified OAuth principal, operator authorization for both list and call, and the normal service-side `canView` check.
- `dev_release_prepare`, `dev_release_apply` and `dev_release_rollback` remain hidden/blocked even when an operator makes them visible by mistake, unless **the trusted runtime itself** independently chooses `allowMutatingTools=true` and operator action authorization also passes. This opt-in is **not** accepted as a user-supplied tool argument.
- Registration is isolated: it does not overwrite the production SDK's `ListToolsRequestSchema` or `CallToolRequestSchema` handlers; tests assert the four existing remote tool names and handler object references remain untouched.
- The low-level exported `registerDevAllowlistMcpHandlers` adapter is for constructing a **fresh isolated** server only. Wiring it into the live production OAuth Server would overwrite tool handlers and is prohibited.

## Gate to actually enable one read-only tool (not yet satisfied)

1. **Source and process provenance (G1):** identify, through approved operator read-only management, which PID/code hash serves the public `/oauth/mcp` resource; preserve all four devices and their Operator policies. Read-only process listing alone does not prove routing.
2. **Dedicated application identity:** operator provisions a separate Dev-only OAuth MCP application/resource and an independently managed sidecar runtime. It must not reuse or mutate production `/oauth/mcp`, `/mcp`, the existing tunnel or READY Agent, or any production credential without a separate approved change.
3. **Verified authentication:** derive principal from trusted server transport metadata, not from tool arguments or client-supplied identity. Enforce server-owned app allowlist and deny anonymous enumeration.
4. **Status-only service:** install a read-only status service and durable journal **after** resolving the outstanding journal symlink-safe read and fsync/crash-hardening review. No Dev WordPress writes, backups, ZIP replace, database writes or remote shell allowed for G1.
5. **ChatGPT tool discovery:** through an app-available officially supported connection/admin workflow, confirm `dev_release_status` is really discoverable and invocable by the intended authorized principal. Do not report PASS based on SDK test mocks or tool descriptions alone.
6. **No-regression readback:** compare existing production tool names and four-device Operator permissions before and after any separately approved Dev-sidecar registration. No new tool may appear on the existing production OAuth resource without explicit approval.
7. **Proof:** record operator-approved resource identity, commit SHA, actions discovered, principal/denial checks, journal status and no-write evidence in GitHub #65. If any check fails, report `G1_BLOCKED` and keep G2–G4 disabled.

## Subsequent gates (not automatically authorized by G1 status PASS)

- G2: hardened Dev-only Receiver with protected immutable artifact, out-of-Web backup, verified crash durable journal and rollback.
- G3: exact three-file Andy Core Dev Canary from fresh approved GitHub HEAD and 4/4 CI. Never whole-plugin ZIP or Commerce.
- G4: PC + iPhone 14 Owner UAT. No automatic PR merge, WWW/Production/ERP deployment, email, order, payment or READY device restart.

**Previous platform safety denial:** symlink-safe journal receipt/fdatasync write attempt was rejected by the GitHub write tool in an earlier turn. It remains incomplete. This document does not authorize retrying the same blocked operation via altered encodings, other tools/devices or transports.

## Evidence currently available

- Existing production OAuth four-device runtime previously confirmed via formal OAuth MCP read-only sources and processes; new dedicated Dev tool remains unregistered.
- PR #66 standalone isolated SDK adapter and fake-server tests provide *offline* proof only.
- AICC Notion tracker: https://app.notion.com/p/3f95f5efdf94817fa0c4f31b1b0083d4
