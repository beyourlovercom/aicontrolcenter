# AICC DC S5 — Pinned Four-Device Integration Simulation V1

**Purpose:** Validate the real code-interface compatibility of S1 state logic + S2 fixed-target signed wire + S3 signed trust-public-manifest candidate + S4 Agent challenge signer across four simulated devices. This is **Dev-only, on-host loopback with synthetic keys**, NOT a live four-device health integration or production deployment.

## Canonical source and independent PRs

- Source of truth: GitHub main at initial S5 branch base `581ff4300d401e2d7baa6d490d01b91fb7b212ef` (S1 PR #90 merged).
- S2 [PR #91](https://github.com/beyourlovercom/aicontrolcenter/pull/91) Owner Dev-only UAT PASS, exact-head `1a9fb3891368be5027ca98556086264d1c39f47a`, still unmerged.
- S3 [PR #92](https://github.com/beyourlovercom/aicontrolcenter/pull/92) Owner Dev-only UAT PASS, exact-head `23cfcf26a006b8a804c71b39bba195599cb1a727`, still unmerged.
- S4 [PR #93](https://github.com/beyourlovercom/aicontrolcenter/pull/93) Owner Dev-only UAT PASS, exact-head `15464cdf941be107558cda8ad0f5720a94ce44b2`, still unmerged.
- This S5 branch is independent of all three, **does not merge/cherry-pick or rebase their source into main or itself**. `stage-s5-pinned-e2e-test.sh` fetches exact GitHub PR refs and fails if a head changes, copies only three allowlisted approved `.mjs` files into a disposable temp folder, alongside main canonical S1/health helper, then runs a test-only local HTTP mock. All temporary files are deleted at exit.

## Actual isolated UAT coverage
- Challenge travels across **real HTTP request/response** bound to `127.0.0.1` on an ephemeral port: S2 fixed operation -> separate S4 handler with mandatory *synthetic test-only* Gateway credential validator -> synthetic local status -> Ed25519 signature -> S1 verification.
- Four exact simulated identities: `007windows`, `china-mac`, `us-macmini`, `windows`. Test-only keypairs generated in process. Each simulated Agent has its own signer, nonce cache and local readiness callback.
- S3 verifies synthetic issuer-signed device-public-key **candidate** manifest. **The test-only use of candidate pins within this simulator does not constitute independent root-of-trust enrollment**. S3 result remains `eligibleForRuntime:false`, `canActivate:false`, witness/issuer/epoch-liveness `NOT_INDEPENDENTLY_VERIFIED`. The S5 PR intentionally does not introduce any production helper that can promote candidates to runtime trust.
- Negative cases: 007 simulated unreachable -> `unreachable` not static `READY`; 007 missing pin -> `unknown` and **zero requests**; forged China signer -> `AUTH_FAILED` unknown; signed degraded Windows -> `degraded`; unauthorized Gateway -> never signed `reachable`; unknown local health -> no signed READY; S1 verified record TTL expiration -> `unknown`; S4 nonce replay and device substitution are HTTP 403; S3 tampered external witness receipt signature is rejected.
- `stage-s5` deliberately makes **no requests to actual Agent 8791, OAuth MCP, production Gateway or remote endpoints** after downloading pinned source through GitHub. Its network workload is GitHub's read-only Git fetch and local synthetic 127.0.0.1 tests only.

## Truthful real-device S5 blockers — separately authorized next stage

| Real machine | Registered | Live Agent signed challenge handler verified? | Externally attested individual signing public key? | Recent concrete evidence |
| --- | --- | --- | --- | --- |
| US Mac mini | YES | NO | NO | Local Agent /healthz HTTP 200, protected endpoints unauthenticated 401; no Ed25519 proof |
| China Mac | YES | NO | NO | remote_process_selftest previous PASS, not signed challenge |
| Windows | YES | NO | NO | previous basic hostname result, not signed challenge; Windows text encoding gap |
| 007windows | YES | NO | NO | previous PARITY_AGENT_UNREACHABLE while registry claimed READY |

**No software-only S5 test may close these gaps.** Service/security owner must independently attest issuer root/witness and device public signing keys (S3); provision **actual device-private signing key under OS custody**, approved real Gateway authentication callback and real Agent local-health measurement (S4); authorize fixed-target transport (S2); establish genuine old Agent recovery backup and R2-B restore gate (#85) before replacing/altering existing protected legacy Agent, Gateway or OAuth. Do not bypass denied protected source access, OpenAI platform security refusals or quota-limited old DC.

Actual four-device Dev-only signed-health UAT must require real `reachable/degraded/unreachable/unknown` under keys independently approved, timestamp/nonce replay proof, 007 reconnection and Windows UTF-8 checks, rollback and unattended fallbacks. No automatic production deployment, no READY machine restart and no implicit GitHub main merge of any PR.

## Code scope / approvals
Only S5 synthetic test, pinned read-only staging script, GitHub Actions and work package. PR #91/#92/#93 remain independent **not merged**; S5 PR requires its own Owner code UAT and later separate exact-head main merge authorization. `S5_SYNTHETIC_TEST=RUNNABLE`; `REAL_FOUR_DEVICE_SIGNED_HEALTH_UAT=NO`; `PRODUCTION_STATIC_READY=UNCHANGED`; `R2A_LEGACY_AGENT_RECOVERABLE_BACKUP=NO`; `R2B/AGENT_OAUTH_CANARY=STOP`.
