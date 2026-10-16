# AICC-DC-P2-ATTESTED-AGENT-CALL-V1-20261016

## Scope and isolation

Candidate branch: `feature/aicc-dc-p2-agent-attested-call-20261016`
Exact base: `91ce2a7f61f805c443aaa3bea2363bdf8e778ac1`
Authorized new public files: exactly these three files:

- `scripts/byl-remote-mcp/p2-attested-agent-call.mjs`
- `scripts/byl-remote-mcp/p2-attested-agent-call.test.mjs`
- this work-package document

No private source, OAuth runtime, Agent, credentials, key loading, network/listener, service, reboot, production integration, commit, push, or P1 change is in scope. The guard is a pure injected dependency and remains default-inert.

## Security contract implemented

The guard requires two distinct Ed25519 public keys and an injected `authorizeOperatorReceipt` callback. The callback is required at construction and must independently verify A4.1 policy, issuer identity, revocation, rotation, and expiry; the guard accepts only the exact decision shape with `issuer: 'a4.1-policy'` and exact receipt/device/operation identity matches. It runs after both signatures verify, before nonce reservation, and on every `NEXT` request.

After transport signature verification, `rawBody` must be a `Buffer` whose UTF-8 decode round-trips byte-for-byte and whose parsed value round-trips exactly through JavaScript `JSON.stringify`. This rejects duplicate keys, noncanonical whitespace, overlong escapes, and invalid UTF-8 before SDK access. All malformed names, arguments, receipt fields, unknown tools, missing proofs, and extra fields use the same `P2_ATTESTED_RECEIPT_INVALID` result until operator proof and A4.1 authorization succeed.

Receipt expiry is exclusive (`expiresAt > now`), future `issuedAt` and `expiresAt` are bounded by configured `maxSkewMs`, TTL is bounded by configured `maxReceiptTtlMs`, expired nonces are pruned at `expiresAt <= now`, and no more than 128 live nonces are retained. Raw errors and SDK details are never returned. Response envelopes remain below 65,536 characters and bytes.

## Verification evidence

Focused command:

```text
node --test scripts/byl-remote-mcp/p2-attested-agent-call.test.mjs
```

The focused suite covers the complete 107432-character Chinese/emoji/CRLF/trailing-blank start plus newly signed nonce `NEXT` loop, exact reconstruction, byte/character response limits, duplicate `name`/`arguments`/`receipt` keys, invalid UTF-8 in an unused field, noncanonical JSON, future/stale/exact-expiry/tight-skew clocks, forged operator keys, missing second proof, wrong trusted identity, revocation denial, callback-per-page, simultaneous nonce reuse, 128-nonce exhaustion, hostile key proxies, stable errors, and sanitized SDK failure.

Required final checks are run against pinned dependencies already present, with no network access:

```text
node --test scripts/byl-remote-mcp/p2-attested-agent-call.test.mjs
node --test scripts/byl-remote-mcp/p2-*.test.mjs scripts/byl-remote-mcp/official-parity-*.test.mjs
node --check scripts/byl-remote-mcp/p2-attested-agent-call.mjs
node --check scripts/byl-remote-mcp/p2-attested-agent-call.test.mjs
git diff --check
```

## Gate decision

**Candidate security gate: GO** — all independent P2 attestation blockers are addressed in the isolated three-file candidate, and the focused/full P2 verification below passes.

**Production/integration gate: STOP.** This is not production approval, Owner Visual UAT, Human UAT, merge approval, or deployment authorization. Production remains blocked until A4.1 supplies live verified operator policy/revocation keysets, audited issuer identity, rotation/expiry controls, and independently attested Agent integration. No OAuth or production code was changed here.

### Final command record

- Focused P2: `PASS` (9 attestation tests).
- Full P2: `PASS` (55 tests).
- Full parity attempt: `72 PASS`; 5 test files could not load because pinned `zod` and `@modelcontextprotocol/sdk` packages are absent from this workspace. No network or dependency mutation was attempted.
- Orchestrator independently executed the isolated pinned-local full P2/Parity test: `202/202 PASS`; this is distinct from the Codex sandbox result of `72 PASS` with 5 dependency-blocked test files.
- Node syntax checks: `PASS` for both new `.mjs` source/test files.
- `git diff --check`: `PASS` (no reported whitespace errors).
- Commit/push: `NOT PERFORMED`.
