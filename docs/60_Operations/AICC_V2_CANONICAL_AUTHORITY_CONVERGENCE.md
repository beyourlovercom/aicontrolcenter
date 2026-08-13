# AICC V2 Canonical Authority Convergence

This document defines the authority boundary for local execution. It is an
architecture rule, not a second runtime or lifecycle store.

| Concern | Canonical authority | Consumers |
| --- | --- | --- |
| Formal Work Package | `docs/60_Operations/work-packages/*.md`, validated by `controlService` | project snapshot, Entity Context, execution contract |
| Repository facts | `readRepository()` in `src/lib/controlService.ts` | authorization, preflight, runtime, evidence |
| Execution policy | `resolveCodexExecutionPolicy()` in `src/lib/codexExecutionPolicy.ts` | runtime command and sandbox |
| Authorization / lease | authorization store in `controlService`; execution lease store in `fastExecution` | Owner actions, runtime, Bridge |
| Task transport | Bridge/runtime adapters | Owner Start, Retry, Bridge, service APIs |
| Codex execution decision | Codex CLI plus OS/Git protections | every launched Codex run |
| Runtime observation | `runtimeManager.ts` | Runtime Monitor and evidence projections |

The pass-through control plane has zero AICC pre-Codex semantic admission
gates. UI action eligibility, Entity Context, Evidence, Run Report, and Bridge
Inbox/Outbox are projections and must not introduce a safety gate. Execution
adapters normalize transport data, launch Codex, observe process truth, and
persist evidence; they do not decide repository, worktree, scope, authorization,
or implementation feasibility.

`AICC_EXECUTION_V1` remains an optional structured envelope. A non-empty raw
task may be passed through without it, while an incomplete envelope remains
invalid. Codex CLI sandbox/approval protections remain in force. Human UAT is
still explicitly Owner-controlled and Runtime COMPLETED never implies WP
completion.
