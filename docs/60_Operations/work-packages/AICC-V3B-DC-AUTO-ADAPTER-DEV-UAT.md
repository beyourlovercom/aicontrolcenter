# AICC V3-B — Owner Dev UAT (Mock-only)

Date: 2026-11-02 (Asia/Taipei). Scope: `beyourlovercom/aicontrolcenter`, V3-B typed DC adapter, independent of R9–R13 Stable.

## Source / execution binding
- Main baseline: `6cd4101e5e418388a145185022340140e1070aed`; PR #109 and #110 already merged and are **not** being re-developed.
- Dev branch: `feat/aicc-v3b-dc-auto-adapter-20261102`; exact candidate commit and Draft PR will be recorded after branch push.
- US Mac worktree: `/private/tmp/aicc-v3b-dc-auto-adapter-20261102`.
- Dedicated state: `/private/tmp/aicc-v3b-dc-auto-adapter-state-20261102`, private mode 0700. Do not touch existing 1420/1436/1437/8797 services.
- Dev port: `127.0.0.1:1438`, **localhost-only**. Nothing here is a remote-accessible or production approval endpoint.

## Visible Dev acceptance
1. GET `/api/health` reports AICC_V3, governance directRun STOP / automaticDcDispatch STOP.
2. GET `/api/dc-adapter/status` reports ISOLATED_DEV_MOCK, realDispatch STOP, ownerAuthorization NOT_AVAILABLE, productionEnabled false.
3. POST `/api/dc-adapter/dispatch` returns 404 (no dispatch API). POST `/api/runs` in V3 mode still returns 403.
4. Simulated Task -> typed operation -> synthetic independent authorization and synthetic health -> mock result -> audit readback. Only explicitly allowlisted labels and devices.
5. Missing/forged `ownerApproved`, expiry, lost health, HEAD/branch/dirty/path drift, bad operation and Claude/Codex selected as adapter provider must STOP without real device action.
6. Duplicate ID same plan returns same synthetic receipt; changed plan conflicts; duplicate nonce and concurrent project tasks STOP. Timeout/revocation/restart produce UNCERTAIN_STOP, no automatic retry.

## Tests and honest limitations
- Formal OAuth DC used for **supervised** US Mac read-only health and Dev engineering, not AICC automatic dispatch. READY is only a registration fact, not signed trusted health.
- Root `npm test`: PASS on US Mac; `npm --prefix v3 test`: 200/200 PASS on US Mac (184 prior V3 tests + 16 new adapter tests).
- Codex SECURITY_REVIEW runs in read-only sandbox and cannot rerun temporary-fixture tests there; host tests above provide those results.
- Symlink path control assumes a POSIX/macOS/Linux Dev host with sticky `/tmp` and a private, current-user-owned 0700 top-level directory. Another process under the **same OS user** remains outside this mock-only threat model. Production-grade race-resistant file handles and real signed authority are out of scope.

## Owner decisions strictly postponed
- Owner Dev UAT PASS and exact-head Ready for Review/main merge approval.
- Separate real dispatch Canary approval after signed operator authority, real device-health proof, scoped OAuth service delegation, live tool allowlist and revocation. No automatic true dispatch in this candidate.
- Separate Production V3/adapter enable approval, backups/rollback evidence and Stable R9–R13 ownership.

## Rollback
- Stop only 1438 isolated test server; turn off `AICC_DC_AUTO_ADAPTER_DEV_MOCK`; revert feature branch PR if needed. Existing main, 1420, 1436, 1437, 8797 and protected Agent/OAuth remain unchanged. Keep synthetic receipts available for audit; never port their state to live production.
