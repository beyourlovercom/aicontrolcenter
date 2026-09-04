# AICC V3 Canonical Result Contract

Contract-Version: 1
Status: `FROZEN / V3.6`

## Purpose

Define one durable canonical Result for one exact completed Codex Run without allowing AICC to rewrite executor semantics.

## Authority chain

`ProjectContext -> Task/WP -> Run -> append-only executor events -> canonical Result`

A Result is a deterministic projection of one exact executor-native final message. It is not an AICC judgment.

## Frozen semantic boundaries

`AICC_TRANSPORT_ONLY = 1`
`AICC_DISPLAY_ONLY = 1`
`AICC_DECISION_AUTHORITY = 0`
`AICC_RESULT_REWRITE = 0`

Result persistence must never create or infer PASS, FAIL, BLOCKED, approval, readiness, or engineering success.## Storage layout

State root remains `~/.aicc-v3` (or `AICC_V3_HOME`).

Each Result is stored inside its bound Run directory:

```text
projects/<project-key>/runs/<run-id>/result.v1.json
```

`result.v1.json` is immutable after successful creation.
There is no second Result file, revision chain, browser-owned copy, or legacy Result fallback in V3.6.

Exactly one Result may exist for one Run.
A duplicate materialization attempt must return the existing identical Result or fail closed on conflict; it must never overwrite the existing file.

## Result eligibility

V3.6 materializes a canonical Result only from a Run whose persisted transport state is exactly `EXITED`.

`STOPPED`, `ORPHANED`, `SPAWN_ERROR`, and all non-terminal Run states are not Result-eligible.
`exitCode` is preserved as a transport fact but is not a semantic gate: an `EXITED` Run with a non-zero code may still have an executor-native final message.## Deterministic source selection

The Result source is selected only from the Run's validated append-only `events.jsonl`.

Scan events in ascending `seq` order and consider only events where:

- `type = CODEX_STDOUT`;
- `source = CODEX`;
- `payload.raw` parses as JSON;
- parsed `type = item.completed`;
- parsed `item.type = agent_message`;
- parsed `item.text` is a string.

The canonical source is the highest-`seq` matching event that occurred before the persisted `PROCESS_EXITED` event.

The Result `content` is exactly parsed `item.text` from that source event.
AICC must not trim whitespace, normalize line endings, render Markdown into another form, summarize, translate, merge messages, or append its own conclusion.If no matching executor-native final message exists, materialization fails as `RESULT_SOURCE_NOT_FOUND`.
AICC must not fall back to stderr, exitCode, browser text, Task/WP status, or an earlier non-agent stdout line.

## Canonical Result schema

`result.v1.json` stores:

- `schema = aicc.v3.result.v1`;
- immutable `resultId` and exact `runId`;
- exact `taskId` and `workPackageId` copied from the Run;
- `projectId`, `repositoryIdentity`, and `repositoryPath`;
- `branchAtStart`, `headAtStart`, and `dirtyAtStart` copied from the Run;
- `runState = EXITED`, exact `exitCode`, and exact `codexSessionId` when present;
- `sourceEventSeq`, `sourceEventType = CODEX_STDOUT`, and `sourceRawSha256`;
- `content` and `contentSha256`;
- `createdAt` UTC timestamp.

No semantic `status`, `pass`, `fail`, `blocked`, or inferred outcome field exists in V3.6.## Binding and validation

A Result must validate against the current `ProjectContext` and its bound Run.

Project/repository/worktree identity must match by the same V3 filesystem identity rules used by Run storage; same repository name in a different worktree is not sufficient.

Every immutable binding copied from the Run must still match the persisted Run exactly when the Result is read.
A mismatched or corrupted Result fails closed and is never silently repaired.

## Materialization ownership

The V3.5 executor worker is the normal Result materializer after it has persisted the final `PROCESS_EXITED` event and the Run's `EXITED` transport projection.

Materialization uses one shared deterministic function and an atomic create-only write.
No browser code writes Results.
No public API accepts user-supplied Result content.

V3.6 may perform idempotent reconciliation of an eligible `EXITED` Run whose Result file is missing, but reconciliation must use only the frozen source-selection algorithm above.## Minimal API contract

V3.6 adds one read-only Result API:

`GET /api/runs/:id/result` -> one durable canonical Result for exactly that Run.

The endpoint must never return an implicit latest Result and must never accept a Result body from the browser.
If an eligible `EXITED` Run is missing a Result because of an interrupted materialization, the server may invoke the same deterministic idempotent reconciliation before returning.

V3.6 has no Result edit, delete, retry, resume, fork, PR, merge, release, or GPT-return API.

## Fail-closed errors

`RESULT_NOT_READY`
`RESULT_NOT_FOUND`
`RESULT_SOURCE_NOT_FOUND`
`RESULT_SOURCE_EVENT_INVALID`
`RESULT_PROJECT_MISMATCH`
`RESULT_RUN_MISMATCH`
`RESULT_INVALID`
`RESULT_CONFLICT`

Errors are transport/storage facts only and do not imply engineering PASS/FAIL.## V3.6 UI boundary

Any V3.6 Result UI is read-only.
It may display Result identity, Run binding, exact content, source event sequence, hashes, and transport metadata.
It must label the content as executor-provided and must not synthesize a success badge from `EXITED`, `exitCode`, or Result presence.

## V3.6 exclusions

The following remain outside this milestone:

- GPT Bridge / same-conversation auto return (`V3.8`);
- GitHub PR delivery (`V3.7`);
- result rewriting, summarization, approval, or semantic scoring;
- retry, resume, fork, or alternate executor selection;
- automatic commit, push, merge, release, or deployment.

## Acceptance gate for implementation

Implementation must prove one Run→one Result exclusivity, exact immutable binding, deterministic last executor-agent-message selection, exact content preservation, append-only source evidence linkage, project/worktree isolation, reload-safe retrieval, and fail-closed behavior when no valid source exists before any V3.6 Result UI is added.