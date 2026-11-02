# AICC V3-B — R6-B2 → R6-B4 Dev-only candidate

**Date:** 2026-11-02 (Asia/Taipei)
**Repository:** `beyourlovercom/aicontrolcenter`
**Required base:** merged PR #113 / GitHub `main` commit `4c83ecc25d162ff790b944cc60b42584a33910c3`
**Delivery:** self-contained *unmerged* file package, **not** a GitHub PR, deployment, or real DC integration.

## Scope and hard boundaries

GitHub branch creation and self-hosted DC remote calls were blocked by the tool safety gate during this session. The resulting files were built in the isolated working container and tested with Node 22. The output **has not** been tested in the real US Mac worktree or through the repository's full V3 CI. Do not claim GitHub main updated, Dev deployed, or Owner real Canary passed.

- **R6-B2:** local synthetic scope/nonce reservation with `openSync('wx')`, 0700 user-owned isolated root, persistent reservation, explicit revocation, no replay after restart.
- **R6-B3:** Ed25519 *test-fixture* service evidence verification with role/audience/domain, exact project/WP/task/repo/HEAD/device/operation/nonce scope, TTL at most 60 seconds, and three distinct public-key fingerprints across Owner, device, service fixture. Distinct proof verification **does not establish runtime OAuth delegation**.
- **R6-B4:** fixed allowlist for `us-macmini` / `remote_process_selftest` / zero arguments; synthetic single-project lease, synthetic result binding, invalid-result quarantine and crash reconciliation to UNCERTAIN_STOP with no automatic retry.

**Never real dispatch:** Neither module has a DC transport, network request, shell executor, OAuth client, signer private-key storage or enabled server route. All reported policy decisions are `STOP`; the preexisting `assertDcAutomaticDispatchAllowed` on main must remain unconditional STOP. Do not copy ChatGPT's formal OAuth token into AICC.

## Bundle files

- `v3/lib/dc-r6b-service-proof-dev.mjs` — synthetic service claim verifier, three-role root comparison, typed read-only validator.
- `v3/lib/dc-r6b-ledger-dev.mjs` — persistent local synthetic request, revoke and receipt state transitions, private `/tmp/aicc-v3b-*` storage.
- `v3/tests/dc-r6b-trust-receipt-dev.test.mjs` — 12 Dev tests covering valid synthetic proof (still STOP), fake key, mismatched scope, TTL, replay, forged results, lease conflict, revoke, crash and expired receipt.
- This handoff document.

## Known limitations — no claims of production security

1. **No independent real Owner issuer** or persisted externally verified approval. A caller-provided test key does not prove Owner identity. Approval/checkpoint record creation in this sandbox is not a real grant.
2. **No AICC OAuth service delegation** or DC-issued device health signature. The service proof is issued by test code; the three distinct keys are synthetic.
3. **No durable remote nonce ledger or authentic remote signed receipt.** The local ledger only models behaviors for future implementation. `SYNTHETIC_COMPLETED` explicitly does not indicate a DC device performed any work.
4. The local file ledger uses POSIX 0700 ownership and atomic file creation, but rename-based updates have same-UID TOCTOU and multi-process crash windows. Before any real dispatch replace with hardened transactional design, directory handles and remote reconciliation. The request lease is intentionally left quarantined on uncertain result.
5. Time is supplied by the test harness, not a trusted runtime. This must not be used for a production authorization clock.
6. B1 existing dual-signed evaluator is not wired to the new sandbox by design; no callable chain can accidentally turn synthetic proof into authority.
7. An actual code change work package, real device call, Production activation, OAuth/Agent/Gateway changes, READY restart and Stable R9–R13 work are all excluded.

## Results from isolated container

Node v22.16.0: `node --test v3/tests/dc-r6b-trust-receipt-dev.test.mjs` **12/12 PASS**. Node syntax checks for both modules passed. No existing repo tests were available in this working container; **no full root or GitHub Actions CI results are claimed** for this new package.

## Next instructions when authorized tools become available

1. On a new branch from exact `main` base `4c83ecc25d162ff790b944cc60b42584a33910c3`, apply the additive patch, checking file name collisions and base HEAD first. Do not update `main` directly.
2. On the authorized isolated US Mac Dev host, run `node --test v3/tests/dc-r6b-trust-receipt-dev.test.mjs`, `npm --prefix v3 test` and root `npm test`.
3. Perform independent read-only Codex `SECURITY_REVIEW` for root symlink/TOCTOU, replay, trust-root injection, crash quarantine, and status semantics. Fix findings and rerun.
4. Create Draft PR; verify full CI (including Rust); obtain separate Owner exact-head Ready for Review/main authorization.
5. Obtain actual Owner issuer, trusted service broker/OAuth and device attestation verifier, remote nonce/receipt/rollback, then separately approve R6-C narrowly scoped **single** read-only automatic Canary. Until then STOP.

## Illustrative Dev UAT / rollback

Use only local temporary roots, never `~/.aicc-v3`, and no protected backups. Rollback is deleting the unmerged Dev worktree; existing main and AICC services are untouched. If a Draft PR is created later, revert only that PR or drop its branch; no Production rollback is implied.
