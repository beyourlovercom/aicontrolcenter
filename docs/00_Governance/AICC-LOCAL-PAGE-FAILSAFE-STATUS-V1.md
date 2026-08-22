# AICC Local Page Failsafe Status V1

- Document ID: `AICC_LOCAL_PAGE_FAILSAFE_STATUS_V1`
- Status: `OWNER_APPROVED_BASELINE`
- Effective date: `2026-08-22`
- Applies to: local AICC page served on `127.0.0.1:1420`

## Authority boundary

A failed or blank page render is not evidence that the AICC local service is dead or unhealthy.
`PAGE_RENDER_FAILED != LOCAL_SERVICE_FAILED` is a mandatory operational rule. Page-render state,
HTTP reachability, local-service health, supervisor state, repository availability, Codex
availability, and Git state remain separate factual dimensions.

The failsafe status surface has `AICC_DECISION_AUTHORITY = 0`. It may expose technical facts and
`NOT_AVAILABLE`; it must not generate diagnosis, failure reason, recommended action, governance
judgment, or business PASS/FAIL/BLOCKED conclusions.

## Runtime contract

Normal UI render keeps the failsafe status invisible. The static HTML shell starts a bounded
5-second frontend boot watchdog before loading the Svelte module. A successful usable Svelte mount
cancels the watchdog. A module-script error, unhandled boot rejection, boot timeout, or runtime
error that leaves the application root unusable replaces the page body with copyable plain text.

The plain-text protocol is `AICC_LOCAL_PAGE_STATUS_V1` and includes page-render/boot evidence,
port 1420 reachability/ownership, local-service health facts, supervisor PID/state/recovery facts,
repository and Codex availability, Git branch/HEAD/worktree, the captured frontend error when
available, and timestamp. Multiline evidence is normalized to one line; unavailable evidence is
reported as `NOT_AVAILABLE` rather than inferred.

`/api/aicc-local-page-status` is a Svelte-independent local HTTP status endpoint and returns
`text/plain; charset=utf-8` with `Cache-Control: no-store`. It reuses existing LocalServiceStatus,
supervisor, and repository facts rather than introducing a second health authority.

## Safety

The failsafe performs no restart, stop, retry loop, task execution, result mutation, conversation
mutation, or Git mutation. Seeing the failsafe must never itself trigger a service restart.
Existing `AICC-LOCAL-SERVICE-HEALTH-RECOVERY-V1` remains the authority for service recovery.

If port 1420 cannot serve the HTML shell at all, the browser may show its native network error;
this in-page failsafe cannot execute before HTML is delivered. That condition must be established
from independent port/HTTP evidence, not inferred from a blank UI.

## Acceptance

- Normal UI: no failsafe text is visible.
- Frontend boot failure with reachable 1420: plain-text protocol is visible and copyable.
- Status endpoint remains available when a Svelte module fails to compile or execute, provided the
  Vite/local HTTP service itself remains running.
- No page-render failure causes an automatic local-service restart.
