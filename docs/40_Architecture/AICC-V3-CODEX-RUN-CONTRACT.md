# AICC V3 Codex Run Contract

Contract-Version: 1
Status: `FROZEN / V3.5`

## Purpose

Define the smallest trustworthy Codex execution runtime for AICC V3.
AICC transports instructions, process state, and raw executor events; it does not decide semantic PASS/FAIL.

## Authority chain

`ProjectContext -> Task binding -> Executor Lease -> Run -> Codex process -> raw events`

Every start re-loads the active `ProjectContext` and the project-scoped Work Store.
A Run must bind to an existing Task and its immutable Work Package binding.
Task lifecycle status is recorded but is not a pre-Codex semantic gate.

## Frozen semantic boundaries

`AICC_TRANSPORT_ONLY = 1`
`AICC_DISPLAY_ONLY = 1`
`AICC_DECISION_AUTHORITY = 0`
`AICC_RESULT_REWRITE = 0`
`PRE_CODEX_SEMANTIC_GATE_COUNT = 0`
## Storage layout

State root remains `~/.aicc-v3` (or `AICC_V3_HOME`).
Each active project uses the same deterministic project-key as the V3.4 Work Store.

```text
projects/<project-key>/executor/lease.v1.json
projects/<project-key>/runs/<run-id>/run.v1.json
projects/<project-key>/runs/<run-id>/instruction.txt
projects/<project-key>/runs/<run-id>/events.jsonl
```

`instruction.txt` is immutable after Run creation.
`run.v1.json` is an atomically replaced transport-state projection.
`events.jsonl` is append-only and is never rewritten, compacted, reordered, or semantically summarized in V3.5.

The active lease file is created atomically and may exist for only one Run per project.
A second start while a valid lease exists fails as `EXECUTOR_LEASE_ACTIVE`.
A stale lease must be reconciled explicitly; it is never silently reused by another Run.

## Run binding

Each Run records immutable start facts:

- `runId`, `taskId`, `workPackageId`;
- `projectId`, `repositoryIdentity`, `repositoryPath`;
- `branchAtStart`, `headAtStart`, `dirtyAtStart`;
- exact instruction SHA-256 and instruction file path;
- executor path, Codex CLI version, detected model, and auth mode when available.
## Transport state model

Allowed Run states are transport/process facts only:

`CREATED | STARTING | RUNNING | STOPPING | EXITED | STOPPED | ORPHANED | SPAWN_ERROR`

`EXITED` means the Codex process exited and carries its exit code; it does not mean semantic PASS.
`STOPPED` means the exact active Run was explicitly stopped.
`ORPHANED` means persisted active state could no longer be proven to belong to a live matching worker.
`SPAWN_ERROR` is an infrastructure/process-launch failure.

Terminal transport states:

`EXITED | STOPPED | ORPHANED | SPAWN_ERROR`

AICC must never translate any of these states into engineering PASS/FAIL/BLOCKED.

## Executor worker ownership

The AICC server launches one detached V3 executor worker with the `runId` in its argv.
The worker owns the Codex child process and is the single active writer of Run events after launch.
The worker command line is part of restart reconciliation so PID reuse alone is never sufficient proof of identity.

The worker launches Codex directly, without a shell, from the active `ProjectContext.repository.path`.
The server does not discover or substitute another working directory.
## Codex invocation baseline

V3.5 freezes the initial non-interactive invocation shape to:

```text
codex exec
--json
--strict-config
-C <ProjectContext.repository.path>
-s workspace-write
--disable multi_agent
-
```

The exact instruction is supplied on stdin.
`--dangerously-bypass-approvals-and-sandbox` is forbidden.
AICC does not mutate the user's global Codex config to satisfy a Run.

Before start, AICC performs a non-agent transport preflight equivalent to `codex doctor --json`.
The preflight must prove Codex installation/auth/runtime readiness and records available executor metadata.
A required preflight failure returns `EXECUTOR_PREFLIGHT_FAILED` and no Run is started.
Missing non-required telemetry is recorded as `null` / `UNKNOWN`; it is never guessed.

## Codex session identity

`codexSessionId` starts as `null`.
If the raw Codex JSONL stream emits a session/thread identity, the worker may copy that exact identifier into `run.v1.json`.
The raw source event remains preserved in `events.jsonl`.
V3.5 does not fabricate a session ID and does not expose a resume action.
## Append-only event contract

Each line in `events.jsonl` is one JSON object with:

```text
schema = aicc.v3.run-event.v1
seq = monotonically increasing integer starting at 1
at = UTC ISO-8601 timestamp
runId = exact Run ID
type = event type
source = AICC | EXECUTOR_WORKER | CODEX
payload = event-specific object
```

Minimum event types:

`RUN_CREATED | WORKER_STARTED | CODEX_STDOUT | CODEX_STDERR | CODEX_SESSION_IDENTIFIED | STOP_REQUESTED | PROCESS_EXITED | PROCESS_STOPPED | RUN_ORPHANED | SPAWN_ERROR`

For Codex stdout/stderr, `payload.raw` preserves the complete raw line exactly as received.
AICC may project transport metadata from a raw JSONL event but may not rewrite or replace the raw event.

## Restart reconciliation

A persisted active lease is valid only when all of these still match:

- active ProjectContext project/repository binding;
- lease Run ID and Run snapshot;
- live worker PID;
- worker command identity containing the exact Run ID.

If identity cannot be proven, the Run becomes `ORPHANED`, an append-only event is written, and the stale lease is released before another Run may start.
## Explicit stop contract

Stop always targets one exact `runId`.
The active lease must belong to that Run and the current project binding before any signal is sent.
The worker receives the stop request and terminates only its owned Codex process group.

A stop request for a different, missing, or terminal Run fails closed.
No "stop latest" or implicit global stop action exists in V3.5.

## Minimal API contract

`GET /api/executor` -> Codex readiness, active lease, and latest Run transport projection.
`POST /api/runs` -> create/start one Run from explicit `taskId` + exact `instruction`.
`GET /api/runs/:id` -> one durable Run transport snapshot.
`GET /api/runs/:id/events?after=<seq>` -> append-only events after a sequence number.
`POST /api/runs/:id/stop` -> explicitly stop exactly that active Run.

V3.5 has no resume, retry, fork, result-rewrite, semantic PASS/FAIL, PR, or GPT-return API.

## Fail-closed errors

`EXECUTOR_NOT_READY`
`EXECUTOR_PREFLIGHT_FAILED`
`EXECUTOR_LEASE_ACTIVE`
`EXECUTOR_LEASE_MISMATCH`
`RUN_NOT_FOUND`
`RUN_PROJECT_MISMATCH`
`RUN_TASK_NOT_FOUND`
`RUN_INSTRUCTION_INVALID`
`RUN_ALREADY_TERMINAL`
`RUN_STOP_TARGET_MISMATCH`
`RUN_EVENT_STREAM_INVALID`
## Governance alignment

This contract preserves the Owner's cross-project executor governance:

- GPT scopes/reviews; Codex is the preferred governed implementation runtime when supported;
- Codex execution remains bound to repository, worktree, branch, HEAD, WP/Task, and run/session identity;
- UI state alone is never success evidence;
- diff, tests, runtime evidence, and exact-head CI remain downstream review evidence where required.

V3.5 does not add Claude execution and does not consume Claude quota.

## V3.5 implementation exclusions

The following remain out of scope until their declared milestones:

- canonical final Result semantics and exactly-once return (`V3.6`);
- GitHub PR delivery (`V3.7`);
- GPT Bridge / auto return (`V3.8`);
- multi-executor scheduling;
- automatic retry or semantic escalation;
- automatic commit, push, merge, release, or deployment.

## Acceptance gate for implementation

The runtime/API layer must prove lease exclusivity, exact cwd binding, durable Run identity, restart reconciliation, exact stop targeting, append-only events, and no semantic result inference before any V3.5 execution UI is added.
