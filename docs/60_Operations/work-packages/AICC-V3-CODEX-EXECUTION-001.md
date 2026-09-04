# AICC-V3-CODEX-EXECUTION-001

Status: `ACTIVE / OWNER_AUTHORIZED`

## Objective

Add the smallest trustworthy Codex execution core to AICC V3 while preserving ProjectContext as the single repository authority.

## Authority

- Active project and repository come only from `ProjectContext`.
- AICC remains transport/display only and has no semantic pass/fail authority.
- Codex remains the semantic implementation authority for its run.
- Exactly one active executor lease may exist per active project in V3.5.

## In scope

- one executor lease;
- one durable Run identity;
- explicit start and stop commands;
- ProjectContext-bound working directory;
- append-only run event/stdout stream;
- reload-safe run status projection;
- focused tests, minimal UI only after runtime/API gate passes;
- exact-head V3 CI and Owner UAT.

## Out of scope

- canonical Result return semantics (V3.6);
- GPT Bridge / auto return (V3.8);
- PR creation or merge (V3.7);
- multi-executor scheduling;
- Claude execution;
- V2 runtime/state migration or fallback.

## Hard semantic boundaries

`AICC_TRANSPORT_ONLY = 1`
`AICC_DISPLAY_ONLY = 1`
`AICC_DECISION_AUTHORITY = 0`
`AICC_RESULT_REWRITE = 0`
`PRE_CODEX_SEMANTIC_GATE_COUNT = 0`

## Acceptance criteria

- execution cwd is always the active `ProjectContext.repository.path`;
- stale or mismatched project/run identity fails closed;
- concurrent second start is rejected while a lease is active;
- Run ID survives page reload and service restart;
- stop targets exactly the active Run;
- event history is append-only and reload-safe;
- no UI inference of execution state;
- exact-head V3 CI passes before Owner UAT.

## Frozen V3.5 contract

- Authority: `docs/40_Architecture/AICC-V3-CODEX-RUN-CONTRACT.md`.
- One project-scoped executor lease; second concurrent start is rejected.
- One durable Run ID bound to ProjectContext + existing Task/WP.
- Codex cwd comes only from `ProjectContext.repository.path`.
- Initial invocation: `codex exec --json --strict-config -C <repo> -s workspace-write --disable multi_agent -`.
- Dangerous sandbox/approval bypass is forbidden.
- Detached AICC executor worker owns Codex and append-only events.
- Run transport states never imply semantic PASS/FAIL/BLOCKED.
- V3.5 has no resume/retry/result rewrite/PR/GPT-return behavior.

## Runtime preflight evidence

- CN Mac Codex path: `/opt/homebrew/bin/codex`.
- Codex CLI: `0.149.0`.
- `codex login status`: ChatGPT login present.
- `codex doctor --json`: overall status `ok`; provider and WebSocket reachability `ok`.
- `codex exec --json`, explicit `-C`, `workspace-write`, feature disable, and session resume are supported by this CLI.

## V3.5.1 checkpoint

- Detached executor worker, durable Run/Lease store, append-only events, and five frozen runtime APIs implemented.
- Worker launches only its bound executor from the Run snapshot and owns exact stop handling.
- Runtime/API suite uses fake Codex only; no real Codex implementation Run was started.
- CN Mac Node 22 suite: `25/25 PASS`.
- Restart reconciliation and same-repo/different-worktree isolation are covered.

## Next exact gate

Commit/push this V3.5.1 runtime/API checkpoint and require exact-head V3 CI PASS. Then add only the minimal execution UI over these frozen APIs; no resume/retry/result rewrite/PR/GPT-return behavior.
