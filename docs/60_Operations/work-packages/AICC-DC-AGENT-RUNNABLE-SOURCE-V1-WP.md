# AICC / DC Agent V1 — Portable Runnable Source and Agent-only Rollback Evidence Gate

**Status:** GitHub-only development work package. NOT a production release or deployment approval.

**Canonical starting point:** `beyourlovercom/aicontrolcenter@c620e7de558ad06d64c96c79abc3d53d93d846c4`. PR #81 (offline immutable candidate) and PR #82 (first GitHub OIDC/Sigstore public P2 attestation) already merged. First genuine **P2 COMPONENT** attestation SUCCESS: workflow run #38885062428, attestation #56615911. This proof cannot serve as a complete Agent or rollback receipt.

## Why a new source candidate is needed

Historical public macOS Agent (`feature/byl-remote-mcp-v1@7606f5417f1bacf69611e1f839406dc03f1cf008`) hard-codes machine-specific runtime SDK/Node/entrypoint paths and has no standalone pinned dependency lock. Its historical SHA-256 evidence cannot establish the source actually running under the current US Mac `launchd` process.

This candidate is a **portable runtime source implementation**: `agent-core.mjs` implements the existing Gateway Ed25519 transport signature contract and `/healthz`, `/v1/tools`, `/v1/call`. `agent-entry.mjs` provides the real MCP SDK Client + stdio transport and reads non-committed private service configuration at authorized startup. The existing public locked `package.json` / `package-lock.json` from `scripts/byl-remote-mcp` supply `@modelcontextprotocol/sdk@1.30.0`. No machine-dependent file paths, private addresses, passwords, keys or device-specific endpoints are embedded in the source.

## Security deltas from the historical baseline

- Gateway remote peer is matched directly to TCP peer address, ignoring spoofable proxy headers; Ed25519 signatures require exact timestamp and canonical method/path/body hash. Mutating request signatures are denied on replay.
- A mandatory, explicit tool-name allowlist is **supplied by trusted service configuration**. No default auto-allow on SDK discovery. Dangerous legacy tools `set_config_value` and `force_terminate` are permanently denied; P2 advanced tools are **OFF** until the full independent operator dual-signature runtime contract is approved.
- `POST /v1/restart` is deliberately disabled; READY device restarts and service control are outside this HTTP Agent.
- Per-request audit is required **before** a tool invocation. Request bodies and private runtime values are not logged. Responses and request payloads are bounded.
- `/healthz` reports only self-observed operational status, including `buildIdentityAttested:false`; it is **not** an independently issued process/build proof.
- Release entrypoint starts only when explicitly run by an authorized service manager with validated `DC_AGENT_*` runtime inputs. GitHub CI imports/tests it in a temporary sandbox and never starts production services.

## Runnable SOURCE release candidate construction

The CI-only `build-runnable-source-bundle.sh` pins two public Agent source files and the existing dependency manifests (package blob SHA `5692e581c17eac6e477b6e1b46549a38940fdd0f`, lock blob SHA `16d583bea3a56573482cc6ba994a1db090e9af59`). It builds the existing V1 `UNSIGNED_LOCAL_CANDIDATE` manifest with `deployPermission=NONE`, verifies it, separately runs `npm ci --ignore-scripts` and Node SDK import in a disposable checkout, and creates a deterministic TAR **without embedding installed dependencies, keys or test fixture**. The artifact can be installed only after an explicit approved release process performs `npm ci` on an isolated macOS destination and independently pins/checks runtime files.

The PR CI job executes the **actual SDK stdio → HTTP Agent end-to-end test** using a fake MCP child process and synthetic keys. This is a valid runnable-source demonstration, not a live old-DC parity or OAuth test.

Only after **separate** GitHub-only merge approval, a manual `workflow_dispatch` on `main` with `ATTEST_PORTABLE_AGENT_SOURCE_ONLY` can issue a GitHub OIDC/Sigstore signature for the source TAR. The workflow must independently verify artifact digest + trusted repository/workflow/source-ref/exact commit before upload. Signing does **not** grant a deploy permission.

## Actual running identity and old Agent rollback: RELEASE OWNER acceptance contract

The trusted service release owner, not this code or any self-asserted Agent reply, must provide:

1. **Artifact receipt:** exact GitHub `main` source commit, reviewed Agent source SHA-256, dependency lock SHA-256, signed release TAR SHA-256 and a separately verified Sigstore bundle. Source-only tar is not a machine-installed binary.
2. **Existing Agent-only rollback artifact:** independently sealed, recoverable last-known-good macOS Agent program and its exact locked dependencies/config **reference** (not secret values), immutable integrity hashes, who captured it and when, and storage accessibility to the authorized service manager. An OAuth/Gateway backup or bare `launchd` label is not acceptable.
3. **Isolated rollback rehearsal:** restore the previous exact Agent artifact in an isolated non-production destination, validate checksums, install with pinned dependencies and perform read-only MCP handshake/smoke checks. Record a sanitized timestamped report with PASS/FAIL and auditor identity. Do not invoke actual production rollback in this phase.
4. **Actual running process receipt:** authorized release manager associates the service label, actual process PID/start event, exact installed executable/source-and-dependency hashes, approved signed build and authorized deployment transaction. Independently verify the signed receipt. A new on-disk file hash after process startup is **not proof** of which bytes a still-running process loaded.
5. **Operator policy:** the OAuth issuer must separately issue trusted, revocable per-operation receipts; Gateway transport authentication does not substitute for operator authorization, and the currently merged P2 module is not automatically activated.

If the existing production Agent lacks historical provenance, **do not backdate or fabricate** a previous release receipt. New attested release baseline requires a separately authorized Agent-only Canary with proven independent rollback path.

### STOP gates

This GitHub PR can add source and CI only. It **cannot** merge itself, trigger workflow_dispatch, install or replace Agent, edit launchd or OAuth, touch Cloudflare, read previously blocked private Agent runtime files through another tool, execute a rollback or restart READY devices. After a source-code review PASS, obtain explicit Owner exact-head merge approval. Only after trusted source signature, independent recovery evidence, owner release authorization and OAuth policy go/no-go can US Mac Agent-only Canary begin. Each other device, particularly `007windows`, has its own identity and rollback proof.

**Status convention:** `CODE TEST PASS` is not `SIGNED RUNNABLE RELEASE PASS`; `SIGNED SOURCE PASS` is not `CURRENT RUNNING AGENT PASS`; `ROLLBACK PLAN WRITTEN` is not `ROLLBACK RECOVERY PASS`.
