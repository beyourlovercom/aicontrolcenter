# S6 Real Four-Device Signed Agent Integration — read-only capability and security gate

**Owner direction, 2026-10-19:** S5 [Draft PR #94](https://github.com/beyourlovercom/aicontrolcenter/pull/94), exact `7c92d3ee6b16eb99c9afd51ad9b362c42679d365`, **Dev-only synthetic integration UAT PASS**. PR #91, #92, #93, #94 each still require an **independent exact-head GitHub-main-only merge authorization**. No live Gateway/Agent/OAuth deployment, Windows service installation, device restart, or private legacy source access is authorized.

## Live read-only observation from authorized existing OAuth tools

**Provenance:** existing formal self-hosted OAuth MCP `link_6ad57abc...`; real direct `remote_list_devices` and each device's `remote_list_tools` response taken in this conversation 2026-10-19. No safety denial was rerouted through a second account.

| Device ID | remote_list_devices registry | Direct remote_list_tools | Signed health proof | Approved device signing key |
| --- | --- | --- | --- | --- |
| us-macmini | READY | 24 generic tools listed | NONE | NOT ENROLLED |
| china-mac | READY | 24 generic tools listed | NONE | NOT ENROLLED |
| windows | READY | 24 generic tools listed | NONE | NOT ENROLLED |
| 007windows | READY | PARITY_AGENT_UNREACHABLE | NONE | NOT ENROLLED |

**What it means:** `remote_list_devices` reports registered/static `READY`, not signed liveness. The 007windows mismatch was independently reproduced. Ordinary tool-list success **does not prove** a signed Agent health handler was installed even if some remote commands work. No separate signed health action was in the 24 visible tool names; this alone cannot prove an authenticated HTTP health endpoint does not exist. The previous US Mac localhost `/healthz=200`, protected endpoint `401` observations likewise do not authenticate any Ed25519 challenge response.

## This S6 PR deliverable

- Pure `remote-v6-real-readiness-audit.mjs`, designed for replaying **whitelisted, independently obtained external control-plane observations**, not for pulling arbitrary endpoints or private credentials.
- A static four-device READY record never yields cryptographic `reachable`; a successful `remote_list_tools` call is labeled `tool_call_success`, **not signed health**. `PARITY_AGENT_UNREACHABLE` is explicitly `unreachable` in the control-plane dimension, not a verified Agent death certificate. `OpenAI safety block` is `unknown`, never retried through alternate accounts.
- Strict exact-four device allowlist; sanitized bounded status and counts, timestamp freshness and no raw exception/secret echo. S6 always reports `decision:HOLD`, `canDeploy:false`, `canReplaceStaticReady:false` until a **separately authorized release process** validates real physical, authenticated, owner-attested evidence. It is not a new signing protocol or gateway implementation.
- Existing S1 Ed25519 verification remains the only expected runtime signed proof. Actual signature/client wiring S2 (#91), trust candidate S3 (#92), future Agent signer S4 (#93) and synthetic E2E S5 (#94) have Owner **CODE UAT PASS**, but none has been merged into main or installed.
- Automated tests include replay of real **shape** of four observed outcomes, wrong/stale states and no false deployment GO; all test observations are synthetic timestamps, not archived as external device cryptographic proof.

## Real S6 gate sequence and required external evidence

1. **G0 Proven owner recovery:** R2-A encrypted backup of legacy US Mac Agent private runtime, two independent durable ciphertext copies, separately stored decrypt/recovery materials, validated R2-B isolated restore before changing installed Agent. Do not bypass denied protected source by alternate shell or GUI.
2. **G1 Legally approved service ownership:** service/security admin independently identifies actual installed source/release, OS code signing and approved installation location. No direct changes by normal DC while access is restricted.
3. **G2 Four device private signer custody:** independently approved per-device Ed25519 keypairs, nonexporting OS-held private keys, S3 issuer root and witness receipts checked, SPKI fingerprint pins and durable epoch/replay ledger stored separately from GitHub/ChatGPT. Never use S5 synthetic keys.
4. **G3 Genuine Agent handler:** S4 reviewed handler bound by proven cryptographic Gateway auth + actual service-local readiness source, replay-safe single-owner instance or authorized shared atomic ledger, fixed health operation from S2.
5. **G4 Dev-only real four-device UAT:** verify signed nonce/protocol/clock and pin matches for all actual four (with 007 offline observed as unreachable/unknown, then recover without READY restart unless separately authorized), degraded/expired/tamper/unauthorized, TTL and Windows UTF-8. Safe recorded evidence includes device ID, timestamp, signed response checksum/fingerprint, status, but not secrets.
6. **G5 Owner releases:** independently authorize PR #91/#92/#93/#94/#this PR main merges by exact head; separately authorize dev then production service changes, canary and rollback. Explicit release GO must be given by Owner/admin; **never inferred from S6 observation report**.

**CURRENT:** 007windows tool endpoint genuinely unreachable at recent read; static READY remains misreported. Old Agent backup real R2-A NO, R2-B STOP, main only S1, real signed UAT NOT DONE. This S6 work can proceed through Dev code tests without any production Agent/Gateway/OAuth change. Real integration cannot truthfully be closed until privileged service owner supplies the above authorization and evidence.
