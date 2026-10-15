# A4.1 Controlled OAuth Service-only Launch Contract

Status: draft / not deployed. [AICC Issue #67](https://github.com/beyourlovercom/aicontrolcenter/issues/67). This is a controlled OAuth process change, **not** a device Agent reboot, Cloudflare configuration change, or a change to WWW/ERP/orders/payments.

## Owner decision
On 2026-10-15 Owner confirmed a recoverable private backup has been completed and explicitly instructed proceeding **without further backup validation**. Respect that direction: do not request a second backup. Keep the existing private backup pointer available to the service owner; never copy backup bytes to Public GitHub.

## What is and is not ready

1. GitHub candidate PR #71 includes `official-parity-a4-launcher.mjs` and explicit `official-parity-a4-entrypoint.mjs`. Importing source does not listen or load secrets. Running the entrypoint needs **BYL_MCP_A4_SERVICE_LAUNCH_ENABLED=1** plus existing OAuth production-compat gates.
2. Confirmed current service launchd label `com.byl.remote-mcp-oauth-compat` owns loopback port 8797. An old service already bound to 8797 cannot coexist with a new one on the same port. The launcher now refuses an occupied port and never kills existing processes.
3. The service entrypoint **requires** a local private JSON manifest specified by `BYL_MCP_A4_PRIVATE_MANIFEST_FILE`. It must contain exactly `runtimeDir`, `bearerPath`, `signingKeyPath`, `targets`, `allowedHosts`, `auditPath`.
4. Manifest, key, bearer and audit paths must exist and be owned by the running service user with **0600** permissions. Module directory must be owned by the same user and be private (0700 recommended). The repository contains no actual manifest values, Ed25519 key, bearer, target IP or user email.
5. Exact device IDs: `us-macmini`, `china-mac`, `windows`, `007windows`. Four targets are private/loopback IPv4 URLs using the current signed Agent port. No target DNS/public IP/wildcard; the server refuses those.
6. Private manifest creation and binding must be carried out by the authorized service owner **without copying secrets, source with secrets or private endpoint addresses into GitHub/chat**. Existing `access-auth.mjs`, `endpoint-routing.mjs`, `operator-policy.mjs` are imported from the already-owned private runtime module directory; **never import old `mcp-endpoint.mjs`** because it auto-binds a port.
7. Audit destination is append-only JSONL containing decision, principal hash, device ID and operation; no file paths, raw arguments or response payloads.
8. Gate new names by `BYL_MCP_PARITY_CORE_READ_ENABLED=0` for initial service smoke; authorized operator should still receive exactly four existing names, nonoperator three. Only after the service smoke passes, flip the core flag to `1` in the reviewed service configuration (and restart **only the OAuth listener service**), never on an Agent device.
9. OAuth HTTP checks: `/healthz` returns 200, unauthenticated GET `/oauth/mcp` returns 401, client-side authorized MCP tools listing must show **4 old + 5 direct read-only**; `dc_ping` remains absent.
10. If any old interface disappears, credentials leak, audit cannot write, or the app does not discover new names, immediately revert only the OAuth service to its prior launch command/config through its approved launchd manager and reconfirm 200/401/old tools. Do not reboot macOS, stop/restart an Agent, kill arbitrary PIDs or edit Cloudflare routes.

## Private manifest shape (example only — invalid placeholders)
```json
{
  "runtimeDir": "<private-installed-auth-policy-directory>",
  "bearerPath": "<private-existing-bearer-file>",
  "signingKeyPath": "<private-existing-ed25519-key-file>",
  "targets": {
    "us-macmini": "<current-private-agent-http-target>",
    "china-mac": "<current-private-agent-http-target>",
    "windows": "<current-private-agent-http-target>",
    "007windows": "<current-private-agent-http-target>"
  },
  "allowedHosts": ["localhost", "127.0.0.1", "<existing-oauth-public-host>"],
  "auditPath": "<private-0600-jsonl-audit-file>"
}
```

## Do not confuse completion levels
- GitHub CI and isolated US-Mac tests PASS means **source/staging PASS** only.
- Production service launch means real OAuth restart/swap of listener 8797 under launchd, requiring private manifest loaded by authorized service owner and service-only rollback.
- Real Owner UAT requires client/provider registration of new `dc_*` operations and 4-device fixed read-only calls. **Do not claim Owner UAT until that is observed.**
