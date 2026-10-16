# AICC-DC-P2-AGENT-SNAPSHOT-BRIDGE-V1-20261016

## Candidate status

This is a Codex-only, opt-in, AGENT-LOCAL candidate. It is pure injected code: no network, server, OAuth, private Agent source, installed runtime, credentials, Cloudflare, A4.1 SDK/OAuth module, live process listing, or production rollout is involved. It does not register privileged MCP tools and does not spoof `remote_list_tools`.

The implementation is limited to the two new JavaScript files and this work-package record named by this work package and reuses the existing public `p2-bounded-mcp-response.mjs` without modification.

## Versioned protocol adaptation

`createP2AgentSnapshotBridge({ callTool, authorize, clock?, ttlMs?, maxPageChars? })` exposes a caller-local asynchronous `request(operation, request, requestContext)` function for exactly these operations:

- `p2_list_processes_start`, request `{}`: authorizes, calls injected `callTool({ name: 'list_processes', arguments: {} })` exactly once, snapshots the complete text, and returns `{ result: { ...page, handle } }`.
- `p2_list_processes_next`, request `{ handle, offset }`: authorizes again before retrieving the snapshot, verifies identity and the exact continuation offset, and returns the next page from the same snapshot without calling the source.

The adaptation is versioned as `aicc-p2-agent-snapshot-bridge/v1`. The upstream source remains the no-argument `list_processes` tool. Page data retains the public helper’s response version, snapshot hash, offsets, total, text hash, and explicit `next`; the opaque handle is added only by this bridge. The final page deletes the session, so replay is denied. A zero-length snapshot returns one terminal page and cannot create an infinite continuation.

`requestContext` is not accepted from the client request. A trusted wrapper injects it, and the wrapper must first verify the signed Agent request, operator policy, and audit redaction independently. Client-provided fields that merely resemble trusted context cannot satisfy this prerequisite. The bridge calls the injected `authorize({ operation, requestContext })` before every source call and every snapshot retrieval. The authorization result must have `allowed: true`, a nonempty server-origin principal, one canonical device ID (`us-macmini`, `china-mac`, `windows`, or `007windows`), exact provenance `server-verified`, and a nonempty stable server-origin `authorizationBinding`. Snapshots bind to all three identity values; handles are not portable between devices, principals, or authorization bindings. This is an authorization-binding and signing/policy precondition only, not cryptographic verification by itself.

The bridge keeps at most eight in-memory sessions and enforces `active sessions + in-flight source calls <= 8`; reservation occurs before awaiting `callTool` and is released in `finally`, including SDK rejection. At capacity, the oldest completed session is deterministically evicted before a new reservation. It always uses imported `node:crypto.randomBytes(24)` for opaque handles; no predictable randomness override or process logging is permitted. It limits snapshots to 131,072 JavaScript characters, expires sessions after 30 seconds by the injected clock, and never persists or exposes raw process content outside the returned page. Upstream responses must be the existing helper’s single text block with no metadata; failures and exceptions are reduced to stable small error codes.

The asynchronous boundary is required for SDK compatibility: `request()` awaits both the injected `authorize()` policy (whether synchronous or asynchronous) and `callTool()` (whether synchronous or a fulfilled/rejected Promise). Rejections are caught, redacted, and mapped to stable deny/source codes; no rejected SDK Promise may escape as an unhandled rejection. Input shape is rejected before delegation, and snapshots are retained only after authorization, source resolution, parsing, handle generation, and page construction all succeed. Concurrent starts receive distinct handles and retain their own identity-bound snapshots.

The helper’s page bound is not sufficient by itself because this protocol adds `handle`. The bridge repages dynamically and accepts a page only when the complete minimal signed-Agent wrapper `JSON.stringify({ result: { ...page, handle } })` is strictly below 65,536 JavaScript characters and UTF-8 bytes, with at least a 1,024-character and 1,024-UTF-8-byte reserve for higher-level framing. The actual final serializer must validate the full response before sending; this minimal wrapper is not an assumption that an unverified JSON-RPC wrapper will fit.

## Explicit non-goals and release gate

This candidate makes no OAuth authentication change and is not evidence that a real Agent is fixed. It must not be wired into OAuth, a server, a privileged MCP registration, or a production route by this work package.

Release requires a separate trustworthy source attestation and a separately signed protocol endpoint route, plus review of the caller’s signed-request verification, per-operator authorization, device binding, stable authorization binding, and independent audit redaction. No production rollout is authorized here. Rollback is removal of the candidate injection/route and restart only under a separate Owner Gate; this work package does not restart any READY service or device. Release STOP remains in force, and Owner UAT is not complete based on these synthetic tests.

## Verification scope

Use only the standalone synthetic test file. It covers reconstruction of 107,432 characters, Unicode/JSON/CRLF preservation, both transport bounds with the framing reserve, malformed input, synchronous and asynchronous authorization, trusted authorization fields and reauthorization binding, fulfilled and rejected SDK `callTool` Promises, identity/device failures, expiry and replay, source errors, unsupported content, overlapping concurrent identical snapshots, the eight-session quota, the eight in-flight reservation limit, and the signed-caller prerequisite. Tests use injected clocks, cryptographically generated opaque handles, mocked `callTool`, and no live process, token, connection, or private file.
