# AICC DC Agent-only Running Build & Recovery Evidence V1

**Scope:** Independent evidence intake and fail-closed checks only. This public PR does **not** acquire private machine source/config, stage a runnable Agent, enroll signing keys, install/restart services, execute a rollback, activate OAuth, or claim Owner UAT.

## 0. Known real facts from current releases

| Evidence | Source | Verified conclusion |
| --- | --- | --- |
| New public portable Agent source and dependency manifest | PR #83 merged into `aicontrolcenter/main@78eec45b54fdb830ac7cca68793158e0fd6270c1` | Code is available, isolated SDK tests were successful, **not** installed on US Mac |
| GitHub OIDC/Sigstore source TAR attestation | Actions #38894328496, Attestation #56640305, signed TAR SHA-256 `3b83579f4b058a9f6e0ddfd4273bd33e40f2879aeb0dd72d901205927c0e4c6b` | GitHub-signed **source** archive PASS, **not** actual process identity |
| US Mac service-only observation | Read-only `launchctl list` and `ps` on 2026-10-16; label `com.byl.remote-mcp-us-agent`, PID **40746**, `ps` start displayed `Tue Oct 13 18:38:22 2026`, launchd last-exit field `0` | This instance **predates** the signed Oct 16 Agent source. Displayed local time zone was not established; the observation does **not** prove which Agent code was loaded |
| Recovered previous installed Agent program and independent restore | No authentic service-release evidence provided | **UNKNOWN; not PASS** |

**Chronology conflict rule:** an Agent process that started October 13 cannot be claimed to have loaded a newly GitHub-signed October 16 artifact via the same unchanged launch event. Do not claim "current Agent V1 live" by pointing only to GitHub source success or a file installed after process startup.

## 1. Existing contracts reused

- Reuse `docs/60_Operations/work-packages/AICC-DC-AGENT-RUNNABLE-SOURCE-V1-WP.md` and `AICC-DC-AGENT-VERSIONED-RELEASE-V1-WP.md` for immutable SOURCE release, service-only cutover and rollback requirements.
- Reuse the actual signed source identity and exact SHA above. Never synthesize a new Agent deployment receipt from the historical `feature/byl-remote-mcp-v1` source commit or `/healthz`.
- The `agent-only-evidence-gate.mjs` file adds **read-only** Ed25519 cryptographic syntax/integrity validation of three separately issued documents, plus cross-document code/PID/start-time/rollback-hash consistency. It does **not** issue deployment authorization or act as a signing service.

## 2. Three external evidence authorities (no private material in GitHub)

A trusted service-release owner or approved service manager must first register independent **public-key fingerprints** in a separately controlled, Owner-approved trusted issuer enrollment registry. Never let receipt authors self-approve the registry, and never commit private keys, internal source paths, authentication tokens, private config or an installable old-Agent backup to this public repository.

The release owner must furnish redacted **signed** receipts through approved service-management channels:

| Issuer and role | Proof needed | STOP when |
| --- | --- | --- |
| **Deployment owner** | GitHub signed source TAR SHA / reviewed commit, exact installed code+dependency SHA, install timestamp, deployment transaction ID, process PID/start token and approved service launch statement | Installed timestamp precedes signed-source timestamp; process may still run old bytes; deployment identity missing |
| **Independent runtime observer** | Distinct Ed25519 key and issuer, same deployment ID and installed-code hash, observed launchd service label, real PID, process-start token, observation timestamp and agent health | PID/token mismatch, no independently verified process↔artifact link or observer trust enrollment |
| **Independent recovery witness** | Third, distinct Ed25519 key and issuer; previous sealed Agent-only artifact and code hash, backup capture timestamp, isolated restoration timestamp, matching restored code hash, stable privately retained backup handle and signed witness evidence digest | No actual private backup, backup captured only after cutover, restored code/hash differs, restore not isolated or unverified |

**Don't publish raw evidence containing private filesystem paths, private IPs, secrets, old Agent executables or config.** Only redacted receipts, public keys and non-sensitive hashes may be released after Owner review. If the platform previously blocked private Agent source/config inspection, do not route around that block via the old DC, alternate CLI, browser, GitHub, or any other tool. Obtain evidence from the authorized service-release operator instead.

## 3. Verification and the limits of its result

The offline evidence gate uses three detached Ed25519 signatures over a canonical, domain-separated JSON payload. Trust keys are passed by a previously approved **external** trust anchor, not included in the public repo. It checks signature integrity, signed issuer role, service ID, pinned source SHA, deployment ID, process PID/start token, pre-signature install time, old backup identity and independent restoration receipt. The synthetic tests exercise these checks but **do not** enroll the fixture keys or prove any real service was restored.

The function `verifyAgentOnlyReceipts({receipts,trustRoots})` can report **receipt cryptographic consistency** only. Caller-supplied `trustRoots` can be generated by an attacker, so even a fully signed, internally consistent bundle **always** returns:

- `externalTrustEnrollment: NOT_VERIFIED`
- `installedRuntimeBytes: NOT_INDEPENDENTLY_PROVEN`
- `physicalRollbackRestore: NOT_INDEPENDENTLY_PROVEN`
- `agentOnlyCanary: STOP`
- `oauthCanary: STOP`

**No booleans, unsigned attestations, self-reported Agent build strings, health endpoint, or GitHub CI success can change these stop gates.** An authorized independently enrolled service owner must corroborate the process's loaded code and successful restore and secure separate Owner deployment approval.

## 4. Service release owner handoff (separate authorization required)

The next real task is for the authorized release manager to prepare an **Agent-only last-known-good backup** in private storage, independently verify its restore viability in a separate sandbox, and produce a signed, redacted evidence packet from three enrolled issuers. Do not restart, unload, overwrite or repoint the existing `com.byl.remote-mcp-us-agent` service or READY devices in order to collect those facts.

Once the evidence actually exists, the Owner and trusted service manager should review the source↔installed runtime binding and restore proof, run cryptographic verification and only then consider a **separately approved** Agent-only Canary. The OAuth service, Gateway, Cloudflare, P2 operator dual attestation, and four-device Owner UAT are different gated stages. The 007windows device requires its own version and recovery history.

### Closure decision

**R0 read-only process observation: PASS (process only).**

**R1 GitHub signed portable SOURCE attestation: PASS (source only).**

**R2 independent Agent running byte provenance: UNKNOWN.**

**R3 actual independently restorable Agent-only rollback: UNKNOWN.**

**R4 Agent-only Canary: STOP; OAuth Canary: STOP; four-device Owner UAT: OPEN.**

No GitHub merge or production/service change is permitted in this work package without a new exact-head Owner authorization.
