# AICC V3-B — R6-C single-device read-only Canary acceptance

Date: 2026-11-02 (Asia/Taipei). Branch: feat/aicc-v3b-r6c-canary-20261102.
GitHub main baseline: 4c83ecc25d162ff790b944cc60b42584a33910c3 (PR #113 merged).

## Narrow scope
- Single device: us-macmini; sole operation: remote_process_selftest, arguments {}.
- No code-write, shell, restarts, Agent/Gateway/OAuth edits, or Production.
- AICC automatic execution still STOP until real independent authorization and service identity are proven.

## Verified facts
- Self-hosted formal BYL DC supervisor invoked one fixed read-only remote_process_selftest; response: as-Mac-mini.local. This is a supervised ChatGPT connector operation, NOT an AICC autonomous Canary, cryptographic device health or signed remote receipt.
- Imported previously isolated R6-B2–B4 patch with exact SHA256 620d40271e2a46f945b7948a97e8973b40d783f814b7f4c1819fad3a4638ec5c into isolated US Mac worktree.
- B2–B4 12/12, V3 223/223, root npm test PASS on US Mac before R6-C additions.
- Prior merged code contains canonical signed-health Dev contracts in scripts/byl-remote-mcp/remote-v2-{verified-availability,health-wire-dev,signed-health}.mjs; their own docs require independent device signer enrollment, trusted Agent runtime and approved transport, which are NOT verified here.
- Codex read-only B2–B4 review PASS_FOR_DEV_CANDIDATE for SYNTHETIC DEV ONLY, not production; identified same-UID TOCTOU, nontransactional ledger races, stale leases and lack of real provenance.

## Synthetic R6-C rehearsal
- v3/lib/dc-r6c-readonly-canary-dev.mjs combines B1 fixture Owner/health Ed25519 proof, B3 fixture service proof, B4 fixed self-test tool and single-attempt local synthetic ledger.
- It performs NO real device call, service OAuth or network. A result named SYNTHETIC_COMPLETED means only local record transition. Every result reports realCanaryExecuted:false, automaticDispatchAllowed:false, runtimeOAuthDelegated:false, remoteReceiptVerified:false, decision:STOP.
- New tests verify all three independent test signatures, single-use nonce, scope digest, device restriction, forged request denial, role separation, TTL and lack of real dispatch.

## True R6-C STOP prerequisites (not met)
1. Owner-side independent, persisted, revocable exact scope grant, not just prompt claims or locally generated test signatures.
2. AICC backend has a separate owner-approved least-privileged OAuth/service delegation. Never copy ChatGPT connector credentials.
3. Live Agent signed health challenge verified using independent enrolled signer/pin. READY and hostname do not qualify.
4. Real server enforced fixed device/operation allowlist without any shell/generic tool fallback.
5. Remote durable single-use nonce, signed real receipt/readback, crash and revocation reconciliation.
6. Hardened race-resistant storage and review of same-UID threat model.

**Supervised read-only selftest:** observed. **AICC single-device automatic real Canary:** NOT RUN / STOP. Do not label a synthetic rehearsal as real UAT PASS.

## Gate and rollback
Require root npm test, V3 suite, Codex read-only security review, Draft PR CI. Owner exact-head approval required for Ready/main; separate concrete service-side evidence and authorization needed for real auto Canary and later Production. If not approved, discard isolated Dev worktree; existing services unaffected.
## R6-C Dev UAT readback — current candidate

- Supervised US Mac tests on this isolated worktree: R6-B2–B4 + R6-C focused **20/20 PASS** (13 B2–B4 including symlink regression + 7 R6-C); V3 **231/231 PASS**; root \`npm test\` **PASS**.
- Codex read-only SECURITY_REVIEW on seven files: **PASS_FOR_DEV_CANDIDATE only**. Its sandbox \`mkdtemp('/private/tmp')\` yielded EPERM so local host tests, not Codex sandbox, establish the 231/231 result.
- Codex expressly identified that local synthetic receipt is unsigned, Owner/service/health fixture signatures do not independently bind requestId/branch/expiry, local ledger has same-UID TOCTOU and multi-writer races, and no transactional fsync or remote receipt trust exists. **All are hard STOP for real automatic dispatch.**
- Current synthetic-only source is safe to submit as Draft PR after GitHub CI. No Owner Ready/main or Production approval is inferred.
