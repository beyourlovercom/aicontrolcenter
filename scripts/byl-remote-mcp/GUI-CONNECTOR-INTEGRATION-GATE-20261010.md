# Remote GUI Connector integration gate — 2026-10-10

## Current observed connector
- Connected plugin: `BYL Remote MCP Operator UAT`. Public capability surface exposes `remote_list_devices`, `remote_list_tools`, and `remote_call`.
- `remote_list_tools(china-mac)` lists Desktop Commander operations only; no native `gui_dev_inspect` or `gui_fixture_action` endpoint is registered.
- The current system can exercise isolated GUI stdio MCP via remote `start_process`; that is **not** equivalent to adding callable tools to the connected plugin.
- PR #52 is in `beyourlovercom/aicontrolcenter`, while the installed remote connector's server implementation and deployment route are not established by this repo. Do not assume PR merge updates the plugin.

## Integration requirements
1. Locate and verify the actual deployed Operator UAT server repository, version and its tool registration source.
2. Add a separate Dev-only device GUI tool to that connector, or a signed, authenticated proxy route, with explicit allowlist and scoped auditing. A shell bridge is not acceptable for general GUI access.
3. Bind each request to the real browser window process, title, and AX address bar **within the same guarded operation**; the existing local `file://` fixture cannot establish Dev web origin.
4. Coordinate a single desktop lock among all GUI clients, and require a verified before/after state receipt.
5. Add a deployment gate: no READY device restarts, no US primary MCP changes, no Production/checkout mutations, no unreviewed permission expansion. Validate isolated backend and OAuth on the new tool first.
6. Demonstrate end-to-end using **ChatGPT's actual connected GUI tool**, not solely a terminal command or a local stdio client.

## Acceptance criteria
- Remote tool discovery visibly exposes new named GUI tool.
- Exact target PID + URL binding, supported action, and screenshot/state receipts all PASS.
- Concurrent requests, focus steals, wrong host/PID, stale window, and unknown outcome fail closed.
- Owner UAT covers one harmless Dev navigation or form interaction, with no payment flow.

## Current status
Native offline fixture and standalone stdio MCP E2E PASS; **deployed connector integration NOT DONE**.
