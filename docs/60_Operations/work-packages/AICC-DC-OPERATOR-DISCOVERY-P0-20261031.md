# DC Operator Tool Discovery — P0 Source Fix (2026-10-31)
Status: **GitHub isolated candidate only. No production deployment, no scope expansion.**

## Root cause and evidence
- OAuth `remote_list_tools` previously passed through signed Agent `GET /v1/tools` directly. That lists device **capabilities**, not permissions of this OAuth principal/device.
- The same connection's `remote_call` uses the private `authorizeRemoteCall(principal, deviceId, name, args)` and rejected `get_config` with `OPERATOR_TOOL_DENIED` on Windows; authorized read/shell tools passed.
- Historical [operator-policy.mjs in PR #51](https://github.com/beyourlovercom/aicontrolcenter/pull/51/files) omits `get_config` from its general Full Exec name allowlist. However [Issue #62](https://github.com/beyourlovercom/aicontrolcenter/issues/62) documents `get_config` working on 007windows, and a later recorded installed-source comparison found an explicit 007-only policy addition. Do **not** infer an identical permission set across four devices.
- Production's current private policy/entrypoint hashes and live loaded bytes were not independently verified in this work package; private runtime access was blocked by platform safety checks. No alternate provider or private-path bypass was attempted.

## Minimal candidate fix
1. Add pure `filterDiscoveredAgentTools`: intersect actual Agent `tools` with names from `listAuthorizedRemoteToolNames(principal,deviceId)`. Missing/malformed resolver or malformed inventory fails closed. Nonoperators receive no privileged delegated tool metadata.
2. The **trusted private Operator Policy** must export a synchronous `listAuthorizedRemoteToolNames` bound to the same principal, device gates and effective name allowlist used by `authorizeRemoteCall`. **Never** generate the list by probing the authorizer with fake arguments; path/command argument rules are distinct. Never accept allowed names from an MCP caller or the Agent itself.
3. The credential-free A4 OAuth candidate now REQUIRES this private export, injects it via launcher → HTTP runtime → MCP surface, and applies it to `remote_list_tools`. Thus a deployment against an unchanged private policy fails preflight rather than silently advertising unsupported operations. This is a deliberate migration gate.
4. Keep `remote_call` authorization and audit unchanged; **do not add `get_config` to any allowlist**. If an existing device-scoped policy permits it, retain that access. No mutation tools gain new permission.

## Explicit deployment gate: STOP
- This PR alone does **not** modify the privately installed `mcp-endpoint.mjs` / `operator-policy.mjs` and does **not** fix the connected production OAuth service.
- Before any service release: authorized service owner must obtain **sanitized source hash and effective allowed-name receipt** (no secrets, no private IP/absolute path/executable logs) and reconcile current installed policy to the canonical source. Supply the new policy name-discovery export **without changing any existing permit/deny decision**.
- Confirm current 007windows `get_config` status via trusted policy/approved non-sensitive evidence, not by dumping full `get_config` output.
- Isolated CI tests: Windows denied tool hidden, 007-only explicit permission retained if already granted, anonymous/nonoperator denied metadata, upstream-only tools never exposed, fail closed if resolver missing, execution-time reauthorization still blocks `get_config`.
- Reviewer must verify existing OAuth compatibility (four legacy top-level wrappers), no regression in internal Bearer principal, no implicit new access, and enforce exact-head / CI / source hashes.
- **Owner approval required separately** for PR merge and for any OAuth service-level deployment and rollback. No READY device restart, no OAuth reconnect, no Cloudflare/Agent changes, no production data writes.

## Work Package
`AICC-DC-OPERATOR-DISCOVERY-P0-20261031`
- Authority: GitHub main at branch creation `69c8a7816d3a75a50b40eab11c8123eda0ae2e4a`.
- Scope: isolated candidate discovery/filter library, unit/SDK tests and release contract; no source copied from private runtime.
- User directive: begin repair, preserve current permissions and device state.
- Provider routing note: isolated source-only typed GitHub changes; no governed private service executor or production shell action invoked. This is not a claim of runtime-authorized governed provider execution.
