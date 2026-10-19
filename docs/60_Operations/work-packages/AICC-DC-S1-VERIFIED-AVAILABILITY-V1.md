# AICC DC S1 — Verified Device Availability V1 (Dev-only Code UAT)

## Existing assets reused
GitHub main contains `remote-v2-live-health.mjs` and `remote-v2-signed-health.mjs`; no duplicate monitor or new key-generation logic. Current production `remote_list_devices` is a statically registered `READY` list, not independent signed Agent live proof (Issue #56). OpenAI platform safety refusals, old paid Desktop Commander provider quota and Windows PowerShell mojibake are separate tracked issues.

## This PR
- `remote-v2-verified-availability.mjs` provides an **opt-in, read-only, dependency-injected Dev status adapter**. It returns `unknown` for every registered device until a cryptographically verified response exists; `TRUST_KEY_NOT_ENROLLED` devices are never probed. It reuses the existing Ed25519 challenge, pinned public keys, timeout/TTL/cache and bounded concurrency. Only `refresh()` invokes a caller-injected transport.
- Its test registry includes all four devices, including `007windows`. Generated test Ed25519 keys are **test-only**; external real operator enrollment remains mandatory. No private Agent public key, secret, token, Tailscale peer URL, hostname log, or customer data stored here.
- `classifyDcControlPlaneFailure()` safely labels `OLD_DC_PROVIDER_QUOTA_EXHAUSTED`, `CHATGPT_PLATFORM_SAFETY_BLOCK`, `CHATGPT_SETTINGS_UI_FAILURE_UNATTRIBUTED`, and `UNCLASSIFIED_FAILURE`. The response never echoes raw provider text or secrets. A platform safety block must never be retried via a different linked account for bypass.
- Source/CI includes **no network, file IO, shell execution, service mutation or OpenAI app settings changes**. Tests prove no refresh automatically occurs, missing keys never probe, spoofed signatures cannot mark online, TTL expiration removes verification, and genuine (test-only) signed degradations are not marked healthy.

## Needed for real runtime
1. An independently Owner-approved and *actually deployed* signed Agent health endpoint; service-scoped pinned Ed25519 device public keys whose enrollment is independently attested (not supplied by an arbitrary response). Existing legacy private Agent cannot be replaced, inspected or restarted without prior R2-A real recoverability.
2. A separately reviewed transport adapter fixed to those registered devices; no arbitrary user-supplied URL, bounds and sanitized errors. Integrate only when true installed Agent versions can be trusted. Do NOT copy an older PR #51 endpoint over current 4-device G15 OAuth runtime.
3. Dev-only UAT first; then separate Owner exact-head merge and production deployment gates if ever approved. No new fake READY claims. Production `remote_list_devices` currently unchanged.

## Explicit status
`DEV_CODE_GATE=PENDING_CI`; `SIGNED_AGENT_HEALTH_RUNTIME=NOT_PROVEN`; `REAL_FOUR_DEVICE_SIGNED_UAT=NOT_RUN`; `R2A_REAL_OLD_AGENT_BACKUP=NO`; `R2B_RESTORE=NOT_AUTHORIZED`; `AGENT/OAUTH_CANARY=STOP`. Owner Code UAT can accept only the **read-only presentation contract**, not claim actual live integration.
