# AICC DC S3 — Owner-Controlled Four-Device Trust Enrollment Candidate V1

**Status:** Read-only, off-host public-key manifest **candidate verification**, not installed Agent enrollment or live health. Source of truth is GitHub main; Owner just accepted Draft PR #91 Dev-only S2 communication UAT but has NOT authorized merging it. **This S3 branch intentionally starts from main as an independent PR**; it does not silently import PR #91 or alter its HEAD.

## Existing code reused
- `main@581ff4300d401e2d7baa6d490d01b91fb7b212ef` includes S1 PR #90 verified availability, prior Ed25519 signed challenge and bounded health monitor.
- Draft [PR #91](https://github.com/beyourlovercom/aicontrolcenter/pull/91), exact HEAD `1a9fb3891368be5027ca98556086264d1c39f47a`, isolated signed-wire contract UAT **Owner PASS**, CI 3/3, remains DRAFT/UNMERGED until separate exact-head merge approval.

## S3 four-device private-by-default enrollment contract
- Devices EXACTLY `007windows`, `china-mac`, `us-macmini`, `windows` in fixed canonical order. A missing, renamed or extra device fails closed. This is the allowed device registry, not real availability.
- One owner/security-controller-issued **Ed25519 detached signed manifest** containing only each device's public Ed25519 key in PEM, SHA-256 fingerprint of SPKI DER, and reference ID to independently issued witness evidence; no private keys, login credentials, service paths or customer data.
- External owner-approved issuer trust fingerprint is pinned **outside the manifest and this repository**; verifying a signature using a public key provided to the verifier is NOT proof that the key is trustworthy. The issuer public key must be independently verified by the real Owner/security controller.
- Exact issuer signature + domain separation; strict schema/canonical signed bytes; 30-day maximum manifest validity, 5-minute clock skew bound; unique device keys and distinct issuer/device signing keys; unique external witness receipt identifiers. Receipt existence and independence still need external verification.
- Epoch 1 requires zero predecessor hash; rotation epoch n+1 binds to a separately retained prior manifest signing-bytes SHA-256. **A caller-supplied previous epoch record is not yet a durable, trusted ledger**. Real enrollment requires service-owner-controlled nonrollback durable epoch custody. Do not promote an arbitrary manifest to production.
- The verifier returns candidate public keys + ledger proposal with `eligibleForRuntime:false`, `canActivate:false`, and explicit `NOT_INDEPENDENTLY_VERIFIED` for issuer enrollment, witness evidence and durable epoch custody. It cannot turn current static `READY` into signed live proof.
- The code is pure/offline: never connects to old Agent, never reads protected old Agent files, never logs credentials, never invokes process/launchctl/start_process; CI generates **synthetic ephemeral issuer/device keys** for tests only.

## Real fixed-target four-device integration readiness — separate Owner gates

| Device | Static registered | Verified installed signed Agent challenge endpoint | Independently enrolled signer + witness | Last relevant observation |
| --- | --- | --- | --- | --- |
| us-macmini | YES | NOT PROVEN | NOT ENROLLED | Local HTTP /healthz=200, protected endpoint 401 without authentication; does not verify signed response |
| china-mac | YES | NOT PROVEN | NOT ENROLLED | Prior OAuth fixed hostname PASS, not signed proof |
| windows | YES | NOT PROVEN | NOT ENROLLED | Prior OAuth fixed hostname PASS, not signed proof; PowerShell UTF-8 issues elsewhere |
| 007windows | YES | NOT PROVEN | NOT ENROLLED | Prior `PARITY_AGENT_UNREACHABLE` although static registry READY |

**Do not use mock keys or a fabricated receipt for a live Agent.** For real signing deployment the independently approved Agent service owner must first provide (1) lawful release procedure and real backup/restore capability for legacy US Mac Agent (#85), (2) a reviewed signed health challenge handler for the existing fixed Agent host, (3) four independently attested key issuances, pin custody and rotation/revocation record, and (4) fixed network adapter authorization and Dev-only 4-device live UAT. Under no circumstances bypass previously denied protected legacy-Agent source read via generic shell, GUI or alternate DC.

## Gates
`S3_CODE_UAT=WAITING`; `PR91_CODE_UAT=OWNER_PASS_BUT_UNMERGED`; `REAL_DEVICE_TRUST_ISSUER_ENROLLMENT=NO`; `REAL_SIGNED_FOUR_DEVICE_UAT=NO`; `PROD_STATIC_READY=UNCHANGED`; `REAL_LEGACY_AGENT_BACKUP=NO`; `R2B/AGENT-OAUTH_CANARY=STOP`. No production deployment/restart or implicit merge authority.
