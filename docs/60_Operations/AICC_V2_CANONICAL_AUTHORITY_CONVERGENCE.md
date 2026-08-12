# AICC V2 Canonical Authority Convergence

This document defines the authority boundary for local execution. It is an
architecture rule, not a second runtime or lifecycle store.

| Concern | Canonical authority | Consumers |
| --- | --- | --- |
| Formal Work Package | `docs/60_Operations/work-packages/*.md`, validated by `controlService` | project snapshot, Entity Context, execution contract |
| Repository facts | `readRepository()` in `src/lib/controlService.ts` | authorization, preflight, runtime, evidence |
| Execution policy | `resolveCodexExecutionPolicy()` in `src/lib/codexExecutionPolicy.ts` | runtime command and sandbox |
| Authorization / lease | authorization store in `controlService`; execution lease store in `fastExecution` | Owner actions, runtime, Bridge |
| Scope / worktree | `fastExecution.ts` | every execution entry point |
| Execution decision | `canonicalExecutionDecision()` in `fastExecution.ts` | Owner Start, Retry, Bridge, service APIs |
| Runtime / Writer Lock | `runtimeManager.ts` | Runtime Monitor and evidence projections |

The canonical execution decision is the only admission decision. UI action
eligibility, Entity Context, Evidence, Run Report, and Bridge Inbox/Outbox are
projections and must not introduce an independent safety gate. New execution
entry points must call `canonicalExecutionDecision()` and consume its complete
snapshot (`decision`, `severity`, `provenance`, `lease`, reason, and next
action). A new gate is not allowed in a component, API adapter, or report
projection.

`READ_ONLY_AUDIT` may use a scoped synthetic read-only authority only when the
instruction explicitly requests it and no write operation is possible. All
write-capable execution still requires the current Owner authorization and
lease. Historical Bridge 001A remains partial until a real canonical launch
and report prove completion.
