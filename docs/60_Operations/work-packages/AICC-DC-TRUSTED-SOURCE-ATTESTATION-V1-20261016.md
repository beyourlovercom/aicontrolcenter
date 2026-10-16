# AICC DC Agent V1 — GitHub source attestation pilot and real rollback gate

## Exact scope, 2026-10-16

This is a **source-provenance pilot**, NOT a running Agent release. It validates that GitHub Actions can produce a verifiably signed immutable tarball from three already merged **public P2 modules**. It never reads or installs private Agent source, starts an Agent, restarts a device or creates an actual rollout/rollback.

Canonical baseline before this work: `main@43230d7549f9933f83aaeb2c7d44afbcc773da61` (merged PR #81). Historical source `feature/byl-remote-mcp-v1@7606f5417f1bacf69611e1f839406dc03f1cf008` provides historical Agent SHA comparisons but **not** live process/build provenance.

## Workflow trust boundaries

Workflow: `.github/workflows/dc-agent-attested-public-source-v1.yml`.

1. Pull requests only receive `contents:read`, run the pinned source-build script and the current offline builder's tests. **They do not receive GitHub OIDC/attestation write permissions**, upload a signed artifact or access production secrets.
2. After a separately authorized GitHub-only merge, a **human-controlled** `workflow_dispatch` run on `main` with acknowledgement `ATTEST_PUBLIC_P2_SOURCE_ONLY` can generate a Sigstore/GitHub attestation using `actions/attest@v4`; this is not enabled by the PR or merge.
3. GitHub's checkout commit must equal `GITHUB_SHA`. The script copies only the three pinned public module files with verified immutable Git blob identities: `p2-attested-agent-call.mjs` (`c1b62119ae424821872056d2bb01126a85d72891`), `p2-agent-snapshot-bridge.mjs` (`52028248b2b3d46ebc056b78d074319fc958e257`), `p2-bounded-mcp-response.mjs` (`bcf2eefb12cfb7bdcda1e4fd6743f676bb863bcd`). Any change requires independent review and an updated pinned file list.
4. Existing merged `agent-versioned-release.mjs` creates a deterministic `UNSIGNED_LOCAL_CANDIDATE` manifest with `deployPermission=NONE` and `rollbackBuild=UNVERIFIED`. GNU tar packages the exact offline bundle; `actions/attest@v4` signs **the tarball digest** via GitHub-managed OIDC/Sigstore without handling a local signing private key. The workflow then **requires** `gh attestation verify` with the expected source digest, main ref, signer-workflow identity and signed attestation bundle to PASS *before* any artifact is retained. The artifact is retained for 14 days. `actions/attest@v4` is present in GitHub's canonical `actions/attest` repository (verified in 2026-10-16, refs/tags/v4).
5. An attestation only proves that GitHub's identified workflow signed the named artifact digest at a specific reviewed source ref. **It does not transform public P2 modules into a complete Agent binary, install them on US Mac, prove PID 40746, or establish a rollback**.

### Independent signature verification after actual manual dispatch

The owner downloads the exact `aicc-p2-public-source.tar` artifact from that workflow run, computes SHA-256, and verifies the remote signed provenance with GitHub CLI:

```sh
gh attestation verify aicc-p2-public-source.tar \
  --repo beyourlovercom/aicontrolcenter \
  --signer-workflow beyourlovercom/aicontrolcenter/.github/workflows/dc-agent-attested-public-source-v1.yml \
  --source-ref refs/heads/main \
  --source-digest <EXACT_MAIN_SHA_OF_THE_WORKFLOW_RUN>
```

Do not set a guessed commit or accept an attestation from a different workflow, signer, repository, source ref, or digest. Record actual run ID, head SHA, tar SHA-256, attestation verification output (redacted), and independent reviewer. The GitHub website showing SUCCESS is not equivalent to cryptographic verification.

## Additional production Agent / recovery gates — not satisfied here

| Gate | Acceptance evidence | Current status |
| --- | --- | --- |
| Full, reviewed, sanitized runnable macOS Agent source in GitHub main | Complete entrypoint/dependencies build manifest and isolated real SDK functional UAT | **OPEN** |
| Trusted signed runnable Agent artifact | GitHub/Sigstore verified tar digest + exact reviewed commit + signed release identifier | **OPEN** |
| Existing live US Mac build ↔ process identity | Trusted `launchd` label, PID/start, executable hash, issuer-approved deployment/start record, reconciliation without prior blocked private-source reads | **UNKNOWN** |
| Agent-only rollback | Separate retained exact previous runnable Agent artifact/config reference, trusted checksums and independently verified **isolated restoration test** | **UNKNOWN** |
| Dual attestation P2 policy | Actual trusted OAuth operator issuer, policy/revocation/key rotation and per-page audit binding proven live | **OPEN** |
| Agent-only Canary then OAuth Canary and four-device UAT | Separately authorized, one device at a time, safe automatic service-only rollback | **NOT AUTHORIZED** |

US Mac previously observed service is `com.byl.remote-mcp-us-agent`, and live Agent `/healthz` returned 200 and 26 downstream tools. Those observations are HEALTH/PROCESS evidence, **not** a build or recovery proof. `007windows` retains an independent provenance chain.

### GO/STOP decision

**GO:** GitHub code-only Draft PR and unprivileged PR dry-run CI.

**STOP:** GitHub merge without separate Owner approval; manual source-attestation workflow dispatch before merge + owner acknowledgement; production Agent installation, launchd changes, service restart, OAuth/Cloudflare changes, release/rollback signing claims, Canary, and final Owner UAT without their dedicated gates.

No private tokens, keys, IPs, paths, service plists, or old platform-blocked resources are to be copied into this PR or the artifact.
