# AICC-EXECUTOR-DC-PRIMARY-V3 — Dev-only implementation record

Owner authorization: Explicit approval in current conversation on 2026-11-01.
Authority baseline: `beyourlovercom/aicontrolcenter` main `69c8a7816d3a75a50b40eab11c8123eda0ae2e4a`.
Scope: isolate governance V3, DC supervised intent checks, feature-gated routing, Next-Step and Bridge STOP, legacy Claude runner retirement when opt-in enabled, tests, independent security review.
Environment: US Mac mini isolated worktree `/tmp/aicc-executor-dc-primary-v3-20261101`; branch `feat/aicc-executor-dc-primary-v3-20261101`.
Non-goals: production OAuth/Gateway/Agent changes, READY restart, R9 private policy reads, R10 real signer provisioning, R11 sealed backup/restore, R12 Git staging workaround, main merge or Stable release.

## Dev architecture
- V2 remains canonical outside this isolated candidate.
- V3 routing is explicit opt-in `AICC_EXECUTOR_GOVERNANCE_V3_ENABLED=1`, and is not enabled by this repo change.
- Default V3 CODE_CHANGE and TEST_ONLY intent = SELF_HOSTED_DC. Any V3 Codex route needs an explicit `SECURITY_REVIEW:` rationale.
- The new pure DC gate validates explicit Owner scope, exact SHA/branch, formal OAuth, device allowlist, and narrow typed read-only operation names. This gate is an authority preflight, NOT a remote executor.
- Existing automatic Bridge DC attempts fail before task creation; direct Claude attempts stop; Next-Step DC execution proposals become STOP_GATE.
- No automatic adapter, remote shell, hidden fallback, broad remote_call, or unverified invocation of Agent security-sensitive tools.

## Pending UAT and delivery
- Native tests and V3 focused adversarial tests.
- Single independent security-sensitive Codex read-only review under AICC governance.
- Distinct feature branch/Draft PR after checks, if permitted by actual Git security controls. Do not bypass a denial.
- Exact-head Owner approval required for merge or release. No Dev/Prod runtime activation without separate approval and rollback.
