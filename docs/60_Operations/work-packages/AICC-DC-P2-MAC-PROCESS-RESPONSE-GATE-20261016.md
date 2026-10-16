# AICC-DC-P2-MAC-PROCESS-RESPONSE-GATE-20261016 — `list_processes` response-size gate

Status: `PLANNED / STOPPED ON UPSTREAM AGENT CONTRACT EVIDENCE`

Authority base: `origin/main@3496d4d51771da478c5eef5884ee3b3e5b787d89`

Branch: `feature/aicc-dc-p2-terminal-mac-process-20261016`

Provider: `CODEX ONLY`, as explicitly approved for this isolated investigation.

Scope owner: distinct P2 Terminal/Mac response-size work. The adjacent A4.1 OAuth identity/provider-registration/8797 runtime work is owned by another window and is out of scope.

## Decision

Do not implement a normalizer, validator, pagination adapter, response-cap change, Agent change, OAuth change, or client-contract change in this iteration.

The public repository does not contain enough authoritative Agent implementation/schema evidence to implement a safe response-size normalizer without speculation. Only this planning document is added. No running Agent, installed runtime, OAuth service file, secret, Cloudflare configuration, service process, or production system was touched.

## Evidence at the exact base

### Confirmed repository transport bound

- `scripts/byl-remote-mcp/official-parity-a4-signed-agent-client.mjs:29-43` accepts `maxResponseChars` only in the range `1..65536`, defaulting to `65536`.
- The same file checks `content-length` at `:71-73`, reads the response text at `:74-78`, rejects text longer than the bound, and parses JSON at `:79-80`; all these failures become `PARITY_AGENT_RESPONSE_INVALID`.
- `scripts/byl-remote-mcp/official-parity-agent-delegate.mjs:13-16` independently caps delegated output at `65536`; `:24-33` unwraps `out.result ?? out`, serializes objects, and rejects oversized serialized text as `PARITY_RESPONSE_INVALID`.
- `scripts/byl-remote-mcp/official-parity-session-tools.mjs:14-34` maps `dc_list_processes` to `list_processes`, preserves the existing authorization call, and rejects a returned text value over `65536` at `:31-33`.
- `scripts/byl-remote-mcp/official-parity-a4-signed-agent-client.test.mjs:82-87` and `scripts/byl-remote-mcp/official-parity-agent-delegate.test.mjs:35-37` prove only synthetic oversized-response rejection. They do not prove the deployed Agent's truncation, pagination, or response schema.

Owner-provided live evidence for this P2 investigation records: current self-hosted `remote_call(list_processes)` on two Macs fails `PARITY_AGENT_RESPONSE_INVALID`; official US Mac `list_processes` text is approximately `107432` characters while the signed Agent transport cap is `65536`. This makes response length a plausible root cause, not a conclusive causal proof. The cap must not be raised.

### Public Agent/source boundary

- `scripts/byl-remote-mcp/REMOTE-DC-V2-RUNTIME-PROVENANCE-20261012.md:22-34` records that `gateway.mjs`, `device-router.mjs`, `dc-agent-macos.mjs`, `dc-agent-windows.mjs`, and `health-monitor.mjs` were observed in a runtime worktree but were not tracked by GitHub main; their listed hashes are not proof of parity with every executing device.
- The same document at `:39-42` requires source reconciliation and says production integration is a separate gate; it also records that existing Agents do not yet implement the signed response handshake.
- `scripts/byl-remote-mcp/OFFICIAL-PARITY-V1-A0-EVIDENCE-20261015.md:42-46` states that live activation is blocked because GitHub main lacks the installed production OAuth runtime source. This P2 document does not attempt that reconciliation.
- `docs/60_Operations/work-packages/AICC-DC-TERMINAL-PARITY-V1-001.md:18-19` explicitly warns that historical Agent code is not verified as the bytes of every current running Agent and that tail-page blank-line, cancellation-signal, and initial REPL-exit behavior remain unresolved.

### Terminal, exit, and Windows evidence

- `docs/60_Operations/work-packages/AICC-DC-TERMINAL-PARITY-V1-001.md:39-43` defers authoritative cancellation/exit-reason fidelity, preservation of intentional final stdout empty lines, and Windows identity/PowerShell encoding evidence.
- `scripts/byl-remote-mcp/OFFICIAL-PARITY-V1-A0-EVIDENCE-20261015.md:13` records a successful Windows read-only self-test with console encoding artifacts, but explicitly does not establish signed-Agent health.
- `scripts/byl-remote-mcp/windows-backup-gateway-uat.mjs:46-52` is a separate Windows backup fixture using Node `spawnSync` with UTF-8 and `maxBuffer`; it is not authoritative evidence for the installed Desktop Commander Agent protocol and must not be generalized to it.
- The repository's Codex executor contracts (`docs/40_Architecture/AICC-V3-CODEX-RUN-CONTRACT.md:61` and `:127`) describe Codex process semantics, not Desktop Commander Agent `list_processes` response semantics; they cannot substitute for the missing Agent contract.

## Candidate P2 protocol, pending proof

After authoritative Agent schema evidence is available, the smallest safe design may be one of the following, chosen only if the upstream contract supports it:

1. **Bounded page request:** add a typed `offset`/`limit` (or the Agent's exact equivalent) to `list_processes`, with a stable ordering/cursor and an explicit `hasMore`/continuation field.
2. **Bounded summary:** request a typed summary/count mode and expose a separate, explicitly named detail operation if the Agent already supports both.
3. **Pure response gate:** if the Agent already returns a typed page/summary envelope, validate its shape, byte/character budget, continuation token, and terminal metadata without truncating or inventing fields.

No candidate may split arbitrary JSON/text at the gateway, silently drop records, change the `remote_call` envelope, raise `65536`, or infer pagination from line breaks. Any page boundary must preserve record integrity, stable ordering, intentional final stdout empty lines where applicable, and the upstream's actual exit/signal metadata.

## Required upstream evidence before implementation

The next gate must provide reviewable, non-secret evidence for the exact Agent version/source used by the affected Macs and Windows target:

- authoritative `list_processes` input schema, including pagination/summary fields, defaults, maximums, cursor/ordering rules, and backward-compatible omission behavior;
- authoritative output JSON schema, including process-record identity, stdout/stderr representation, encoding, truncation markers, continuation metadata, and error envelope;
- transport framing and size accounting: bytes versus JavaScript characters, `content-length` behavior, and whether the `65536` limit is enforced before or after JSON serialization;
- terminal semantics: exit code, signal/cancellation reason, timeout, partial output, and whether a final empty stdout line is meaningful;
- macOS and Windows encoding rules, including PowerShell/console code-page handling and whether the Agent normalizes to UTF-8;
- version/hash provenance for the running Agent and gateway, reconciled to a reviewable public source or an independently approved source-parity artifact;
- synthetic fixtures/tests covering below-bound, exactly-bound, over-bound, multi-page, empty-final-line, non-ASCII, malformed, timeout, cancellation, non-zero-exit, and partial-output cases.

Raw process listings, credentials, tokens, private keys, unredacted runtime logs, and user content are not required and must not be copied into the repository or printed in evidence.

## Compatibility and STOP rules for a future implementation

- Existing `remote_call` and `agentCall(deviceId,name,args)` behavior remains unchanged when pagination fields are omitted.
- Existing five read-only Core-5 authorization/audit gates remain unchanged; no new device, operation, permission, or OAuth identity behavior is introduced.
- The signed transport response cap remains `65536`; a larger upstream result must be paged or summarized by an already-supported Agent protocol, never accepted by raising the cap.
- A malformed, ambiguous, over-budget, unsupported, or provenance-unknown response fails closed with a redacted stable response error; raw upstream content is not surfaced.
- Stop immediately if implementation would require editing `dc-agent-macos.mjs`, `dc-agent-windows.mjs`, installed runtime files, OAuth service files, secrets, Cloudflare, or a live device.
- Stop if the exact upstream schema cannot be independently established. Do not infer a protocol from the approximate `107432`-character observation or from synthetic tests.
- No commit, push, merge, deployment, service/Agent restart, production action, or Owner UAT PASS is implied by this work package.

## Proposed future file/test scope

Only after the evidence gate passes, a separate Owner authorization should name the exact files. The likely safe scope is one pure public response-envelope validator/normalizer plus offline tests, with no Agent or OAuth edits. The exact module and schema must be selected from authoritative source evidence; this document does not authorize or preselect an implementation file.

## Effort estimate

After upstream schema/provenance is supplied: approximately **8–14 engineering hours** for contract reconciliation, pure validator/page-envelope implementation, and deterministic tests; **4–8 hours** for independent review and evidence/UAT preparation. If the Agent itself must gain pagination/summary support, that is a separate upstream Work Package, likely **2–4 engineering days** plus device-specific validation, and is not estimated as part of this P2 gate.

## Verification performed for this iteration

- Exact branch/base and clean starting worktree checked before investigation.
- Source search and line-level inspection performed read-only.
- No live process content was retrieved or printed.
- No tests were run because no implementation was authorized or added.
- Final verification must confirm this is the only changed path and that `git diff --check` passes.

## NEW EVIDENCE — 2026-10-16 inspection record (sanitized, read-only)

- Repository inspection records `origin/main` at `3496d4d51771da478c5eef5884ee3b3e5b787d89`; draft PR77 CI is recorded as **SUCCESS**. This does not change the authority base or authorize implementation.
- On the authorized US Mac mini, only `launchctl` and `ps` source metadata was used. No paths or source values were retrieved or printed. The running launchd service `com.byl.remote-mcp-us-agent` reports script basename `dc-agent-macos.mjs`, `4534` bytes, and SHA-256 public prefix `6fb0512be58a932b`. The running `com.byl.remote-mcp-gateway` reports script basename `gateway.mjs`, `5543` bytes, and SHA-256 public prefix `c59e4d1d7fabdad4`. These public prefixes and byte counts are provenance metadata only, not a full source-integrity attestation.
- Read-only keyword analysis of the installed macOS Agent found `/v1/call`, `/v1/tools`, `callTool`, `listTools`, `JSON.stringify`, and a generic SDK server marker. It found no literal `list_processes`, `list_sessions`, `start_process`, `read_process_output`, `offset`, `cursor`, `page`, or truncation markers. The Agent therefore appears to be a bridging MCP handler in this static inspection; these findings are not evidence of the downstream tool response schema. The gateway keyword inspection found `/v1/call`, `/v1/tools`, and a proxy marker. These are static keyword findings, not full protocol proof.
- Existing self-hosted Macs continue to show `list_processes` failure `PARITY_AGENT_RESPONSE_INVALID`; the official US Mac observation remains greater than `65k` characters. Never increase the transport bound without a validated upstream schema. The specific next step is to obtain an authorized Desktop Commander vendor/schema artifact or an isolated synthetic SDK response; no live payload may be disseminated.
- This evidence is **READ-ONLY provenance metadata**. No service or configuration was changed, no READY restart was performed, and no private file was copied.

### Optional next read-only checks

If separately authorized, inspect only sanitized metadata for transport framing (request/response content type, declared length versus serialized byte count, and where the existing bound is applied) and for page hints (presence and names of typed limit/offset/cursor, continuation, summary, or truncation fields). Preserve the no-live-payload rule and do not infer a schema from keyword presence alone.

This new evidence does not claim a fix, implementation readiness, or UAT PASS.
