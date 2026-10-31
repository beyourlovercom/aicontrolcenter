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
3. A **new default-OFF switch** `BYL_MCP_OPERATOR_DISCOVERY_FILTER_ENABLED` controls rollout. Missing or `0` preserves existing discovery behavior and does not require a new private policy export, enabling a code-only compatibility stage. Setting it to `1` REQUIRES the trusted private `listAuthorizedRemoteToolNames` export; the launcher → HTTP runtime → MCP surface fails closed before binding if absent. Do not enable until verified on server.
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

## 2026-10-31 loaded-policy identity verification (pending Owner service provenance)

Owner executed a prior private-file-only inspection and reported a SHA-256 and `DISCOVERY_EXPORT=false`. The inspected path may differ from the A4 Manifest's runtimeDir; do **not** assume the same loaded module.

A small public **read-only local** verifier is included:
`scripts/byl-remote-mcp/official-parity-a4-policy-identity-cli.mjs`. It takes
`BYL_MCP_A4_PRIVATE_MANIFEST_FILE` and `BYL_MCP_INSPECTED_POLICY_SHA256`
**from the authorized service-owner's local environment**, derives the
`runtimeDir/operator-policy.mjs` selected by that manifest, and reports only:
`scope`, `inspectedFileMatchesManifestPolicy`,
`discoveryExportStaticHint`, `liveListenerManifestAttested`,
`canEnableDiscoveryFilter`. It does **not** output paths, source bytes,
private keys, target addresses, hashes or tokens, import private modules,
bind ports, or mutate files. It always reports
`liveListenerManifestAttested=false` / `canEnableDiscoveryFilter=false`
because an arbitrary locally supplied Manifest is not proof that the running
launchd process loaded that Manifest. The static export hint is not proof of
runtime ESM export registration.

**Interpreting results:**
- Match `false`: the inspected file and supplied A4 manifest policy differ;
  STOP until trusted service-owner reconciles which one is live.
- Match `true` + export `false`: same file, still missing resolver; STOP.
- Match `true` + export `true`: proceed to trusted service-owner loaded
  process provenance and exact policy behavior review, **not** filter-ON.
- Any error: `UNVERIFIED`. Never turn a failed check into an authorization.

**Minimal private-policy implementation contract (not a generic pasted patch):**
Extract existing full-exec and canary name decisions into one private,
side-effect-free helper consumed by both `authorizeRemoteCall` and the
new `listAuthorizedRemoteToolNames(principal,deviceId,env)`. The latter
returns a synchronous `string[]` for an existing verified OAuth principal and
fixed device; no client/Agent list input, no broadening of scope. Preserve
`007windows` special-case `get_config` only when it is **already**
permitted by that actual loaded policy; the same principle applies to the
existing `hostname` / narrow canary permissions. Keep per-argument checks
in `authorizeRemoteCall`. Without reading the authorized actual private
policy, an automatically generated private patch would be unsafe and must not
be attempted. First validate the exact loaded source and expected name
decisions with four-device policy-only fixtures.

**Preserve Owner backup decision:** the 2026-10-15 service operations
contract explicitly says not to revalidate an already confirmed private
backup. Do not duplicate backups. Still preserve service-only rollback
authorization and current known-good entrypoint.

## Owner terminal check: missing manifest variable (2026-10-31)

Observed `POLICY_IDENTITY_MANIFEST_INVALID` when the CLI was invoked with
`BYL_MCP_INSPECTED_POLICY_SHA256` set but with no independently supplied
`BYL_MCP_A4_PRIVATE_MANIFEST_FILE`. This is a **preflight input problem**,
not evidence of a corrupted Operator Policy or of a failed SHA match.
A normal macOS interactive shell does not inherit a service-specific
launchd Manifest variable.

The CLI now reports
`POLICY_IDENTITY_MANIFEST_ENV_MISSING` when the variable is absent.
Never guess a manifest filename or copy private paths into public GitHub.

For authorized service owners operating locally only:
1. Locate the existing approved A4 private manifest path in the service's
   own launch configuration. Do not paste the path, environment dump, PEM
   contents, policy bytes or target URLs into chat.
2. In that local terminal, set
   `BYL_MCP_A4_PRIVATE_MANIFEST_FILE` to the actual **absolute** private
   Manifest path. The shell command should be one line, or use explicit
   `export` for both variables; do not insert a blank line after a trailing
   backslash.
3. Run the opt-in CLI with
   `BYL_MCP_INSPECTED_POLICY_SHA256` set to the already known inspected
   hash. Only the sanitized JSON result should be shared.
4. If `inspectedFileMatchesManifestPolicy=false`, STOP and reconcile
   policy identity locally. If true, the result still does **not** attest the
   live launchd process's loaded Manifest, nor permit filter-ON deployment.
5. If `POLICY_IDENTITY_UNAVAILABLE`, file access or ownership failed; never
   weaken private permissions to make the check pass.

No backup renewal, production restart, OAuth reconnect or new privileges.
