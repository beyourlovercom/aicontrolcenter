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
## R6-C H2 cooperating-writer ledger hardening (2026-11-02)

- The Dev-only local ledger now uses a single per-root atomic exclusive mutation lock across reserve, stage, record, revoke and reconcile. Active or crash-stale locks **fail closed**; they are never automatically stolen.
- Synthetic nonce, lease and record writes use file-descriptor fsync where applicable; directory-entry crash persistence remains unproven. This is NOT a production transactional store.
- Reconciliation only removes a leftover lease if its requestId and planDigest match a SYNTHETIC_COMPLETED record with valid receiptDigest and exactly one synthetic attempt. Uncertain outcomes keep quarantine; no retry.
- New negative tests: stale mutation lock, terminal lease cleanup without replay, uncertain lease quarantine. Focused total 23/23.
- Remaining real-readiness blockers: independently issued Owner grant, AICC service OAuth, trusted Agent signed health, signed remote receipt with remote nonce, external revocation and same-UID threat review. Cooperating-writer lock is NOT hostile same-UID protection.
- The Draft PR #114 HEAD will change on this amendment; old head cannot be reused for merge approval.
## R6-C H2 supervised recovery policy (after initial Codex STOP)

Initial H2 Codex review returned STOP for a crash-stale mutation lock and a lease-created-before-INFLIGHT window. Current Dev-only resolution:

- New inspectDevMutationLock(root) is **read-only**, requires a private trusted Dev root and returns STOP regardless of whether a lock is present. It never steals, deletes or grants permission.
- An existing dev-ledger-mutation.lock blocks both mutations and automated reconciliation. This is deliberate: a stale lock cannot safely be distinguished from a live writer using local flags or PID alone.
- **Separate Owner-supervised, Dev-only incident protocol:** (1) stop initiating new Dev work; (2) independently inspect process liveness, all current open descriptors and the exact isolated worktree; (3) record lock path, SHA-256, file owner and time; (4) only with a distinct Owner incident authorization, archive the stale lock **inside the isolated private root** without deleting its evidence; (5) immediately run reconcileDevLedger; (6) quarantine all uncertain work; never auto-retry or reuse a nonce. If the active process cannot be conclusively excluded, STOP and leave the lock untouched. No real Agent/Gateway or running Production process may be touched.
- Reconciliation now recognizes an exact matching active lease with PREPARED_DEV_ONLY and zero attempts (crash between lease creation and INFLIGHT). It marks the record UNCERTAIN_STOP / R6B4_CRASH_AFTER_LEASE_CREATION, leaves its lease in place and never retries.
- It cleans only a matching terminal synthetic completion lease, and never reuses the nonce.
- The current worktree tests simulate archiving a stale **synthetic fixture lock** inside a disposable temp directory. They do not exercise actual operator authorization or Production recovery.
- File fsync does not guarantee durable rename/directory entry; same-UID file replacement and multiresource crash atomicity remain **hard STOP for real automatic dispatch**. No production-ready transactional guarantee is claimed.

This is a governed offline Dev recovery design, **not** an automated crash unlock. Real R6-C remains STOP pending independent Owner authorizer, service-delegated OAuth, trusted signed Agent health, remote nonce/receipt and transactionally hardened ledger.
