# AICC DC R2-A — Presealed Legacy Agent Backup Intake V1

**Scope: operational ciphertext-only intake from an already lawfully exported and client-encrypted legacy Agent snapshot.** This file is a technical implementation contract, NOT Agent source-export approval, an installed MCP tool, a production deployment, or a verified recovery.

## 0. Existing evidence to reuse

- GitHub main is the only canonical source. Parent execution work item: Issue #85.
- US Mac legacy service com.byl.remote-mcp-us-agent was observed with PID 40746 from October 13, 2026. This process is NOT proven to use signed portable V1 source issued October 16.
- Owner approved the bounded R2-A backup objective and later authorized an Agent-only Backup/Export setup. Prior denied access to private source/config must not be bypassed through any alternate tool.
- W1 synthetic-only encrypted Mac-to-Windows Taildrop UAT received Owner PASS and is CLOSED. Its test crypto keys cannot be reused as production recovery credentials.
- No real authorized old-Agent source-export mechanism, private storage approval, independent key escrow, actual backup, or R2-B isolated restore receipt exists yet.

## 1. New callable intake — real operational code with strict limits

Location: scripts/byl-remote-mcp/agent-release-v1/agent-only-presealed-intake.mjs

The library exports retainPresealedLegacyBackup(). It takes an **already encrypted ciphertext Buffer**, a short-lived detached Ed25519 signed authorization receipt, a public trust anchor to be supplied and enrolled by an external owner-controlled registry, two independently configured storage adapters, and an externally approved durable one-time authorization ledger.

It validates the exact old-Agent service label and device identity, backup/capture/off-Windows-custody receipt identifiers, source-manifest SHA-256, ciphertext SHA-256 and byte count, Ed25519 authorization signature, public-key fingerprint and expiration (24-hour maximum). Time is checked using the **host clock**, not an untrusted caller-provided `now` argument. An externally provisioned `receiptLedger.reserveOnce(backupId, ciphertextSha256)` must atomically and durably claim a backup ID **before any storage write**; missing or duplicate claims fail closed. It requires two separately declared storage failure domains; storage adapters must write the ciphertext once and return actual read-back bytes, which are independently SHA-256 checked. Each adapter receives its own Buffer copy, so an adapter cannot mutate the caller's buffer used for the second destination. **A failure after primary storage succeeded is a partial commit, not an automatic rollback**: the ledger claim stays consumed, the partial backup is quarantined and the trusted operator must reconcile both stores before issuing a fresh authorization. The limit is 128 MiB per intake operation; larger archives need a separately reviewed streaming pipeline.

There are no filesystem, process, launchd, network, key-secret or private Agent export functions in the module. The data path is **encrypted archive supplied by a trusted external provider -> signed subject validation -> approved encrypted-only storage -> double SHA-256 readback**.

This library does **not** itself prove that the presented trust anchor was enrolled independently, that a ledger is genuinely durable or atomic, that storage adapters actually performed durable IO rather than returning a fabricated Buffer, or that declared failure domains represent distinct physical systems. These are service-manager integration/UAT responsibilities, **not** claims of this isolated module. All results retain:
- sourceCapture: NOT_INDEPENDENTLY_VERIFIED
- externalIssuerEnrollment: NOT_INDEPENDENTLY_VERIFIED
- keyEscrow: NOT_INDEPENDENTLY_VERIFIED
- isolatedRestore: NOT_TESTED
- installedRuntimeBytes: NOT_PROVEN
- agentOnlyCanary: STOP; oauthCanary: STOP

No result can be interpreted as independent source provenance or production release authority.

## 2. Required operator integration — NOT supplied by this PR

1. The Owner-appointed service release administrator or authorized security team must expose a **permitted protected Agent-only source export mechanism**, with a verifiable grant that resolves the previous private-file access refusal through official authorization channels. Do not use general-purpose DC file commands, shell, Finder or a substitute channel to extract blocked Agent source.
2. Approved exporter captures the **actual legacy program and dependency state**, plus only a non-secret configuration reference and truthful source manifest. It signs a separate genuine capture receipt without publishing raw private program bytes or secret locations.
3. Source operator encrypts locally before transport, keeping the recovery key outside Windows and GitHub/Notion/chat. Taildrop Downloads may contain ciphertext only; its staging and retention must be covered by an approved policy.
4. Owner approves a primary ciphertext-only storage target and a real separate failure-domain replica, with access controls, retention and independent read-back. Windows F: was identified as a capacity candidate only, not hardened or authorized private backup storage.
5. A separately trusted issuer enrollment/independent recovery witness/isolated restore authorization is required for R2-B, followed by separate Agent-only Canary and OAuth Canary approvals. The previous offline evidence verifier PR #84 remains independent and cannot turn ciphertext intake into runtime provenance.

## 3. Verification

Local command: node --test scripts/byl-remote-mcp/agent-release-v1/agent-only-presealed-intake.test.mjs

Dedicated GitHub PR workflow: `.github/workflows/dc-agent-r2a-presealed-intake-v1.yml` (Node 22 syntax + 9 focused tests + source/service safety invariant checks). Generic repository CI success alone must not be counted as execution of these focused tests.

Nine offline tests cover signed ciphertext readback, tamper rejection before storage, forged/expired receipt with untrusted clock override, substituted trust fingerprint, same physical-domain identifier, incorrect independent storage readback, duplicate grant rejection, required replay ledger, and buffer isolation. Generated fixture is synthetic and does NOT repeat W1 network transfer or prove a real legacy backup.

## 4. Gate states

| Gate | Status |
| --- | --- |
| Ciphertext-only intake component + offline tests | CODE HARDENED / PREVIOUS LOCAL 6 of 6 PASS; NEW 9-CASE SUITE AWAITING DEDICATED GITHUB CI |
| Registered protected legacy-Agent exporter | MISSING |
| External signers, independent storage and key escrow | NOT APPROVED / NOT PROVEN |
| Real legacy-Agent R2-A backup | NO |
| Independent R2-B restore | NOT AUTHORIZED |
| Agent/OAuth Canary | STOP |

**Draft PR only.** No GitHub main merge, no live deployment or public key enrollment, no current Agent/launchd/OAuth/Gateway/Cloudflare mutation, no protected runtime read, no real ciphertext transfer and no READY restart.
