# AICC Local Service Health Recovery V1

- Document ID: `AICC-LOCAL-SERVICE-HEALTH-RECOVERY-V1`
- Instruction ID: `aicc-local-健康体检v1-20260817`
- Status: `OWNER_TASK_CANONICAL_BASELINE`
- Applies to: `AICC_LOCAL_SERVICE_HEALTH_RECOVERY_V1`
- Effective date: `2026-08-17`

## Authority

This document records the Owner instruction for distinguishing local-service
process liveness from service health and for recovering the AICC local service.
The supervisor/service manager is the authoritative source for managed PID,
health state, consecutive health failures, last factual health failure,
recovery epoch, recovery attempts, and transition timestamps.

The PID-exists condition is never equivalent to a healthy AICC service. A
foreign process on the service port is not an AICC-managed process and must
fail closed without termination.

## Canonical states

The implementation preserves these states:

```text
PROCESS_DEAD
PROCESS_ALIVE_HEALTHY
PROCESS_ALIVE_HEALTH_DEGRADED
RESTARTING
RECOVERED
RECOVERY_FAILED
```

`SERVICE_UNHEALTHY` is the bounded-recovery transition between degraded health
and restarting. It is not a claim that the process is dead.

## Health evidence

Every failed health probe records and logs a factual reason where available,
including `ECONNREFUSED`, `ETIMEDOUT`, `HTTP_500`, `HTTP_404`,
`INVALID_HEALTH_RESPONSE`, `CONNECTION_RESET`, `PROCESS_EXITED`, or `UNKNOWN`.
The implementation must not fabricate a reason; the last reason and available
diagnostic detail remain observable after recovery attempts fail.

## Bounded recovery

Consecutive health failures increment only on failed health checks and reset to
zero only after a real successful health check. Starting a timer, recreating a
polling loop, rereading state, or starting recovery does not reset the counter.
Recovery epochs and their counters remain observable.

The health-failure threshold and maximum recovery attempts are named,
configurable policy values with deterministic defaults. Before the threshold,
the supervisor performs bounded health probing. At the threshold it declares
`SERVICE_UNHEALTHY`, verifies ownership of the managed PID, terminates the
stale process gracefully first, confirms exit, starts the official AICC local
service, and requires a successful health probe before reporting `RECOVERED`.

Recovery attempts are bounded. `RECOVERY_FAILED` stops autonomous restart
looping, preserves the last factual error, exposes the failure, and leaves the
existing Owner `重启本地服务` operation available. Manual restart starts a new
recovery epoch while retaining the prior failure evidence.

## Safety and compatibility

Termination is PID-specific and fail-closed. The supervisor must prove the PID
belongs to the AICC-managed local service using the existing repository/canonical
process identity mechanism. Graceful termination precedes any conventionally
allowed escalation. Foreign port owners are never terminated.

The existing official service start/restart mechanism and manual restart action
remain in use. Local-service recovery must not alter conversation binding,
execution binding, result binding, GPT return state, auto-loop state, Roadmap,
PR navigation, Task behavior, runtime history, or persistent AICC data.

The existing visual design and top-header placement remain unchanged. UI state
projection must not show `正常` solely because a PID exists; degraded,
restarting, disconnected, and recovery-failed states remain truthful.

## Owner UAT

Owner UAT covers a healthy service, process-dead recovery, process-alive but
unhealthy recovery, bounded recovery failure, manual restart after failure, and
survival of PR snapshot, Roadmap cache, and Task/runtime history.
