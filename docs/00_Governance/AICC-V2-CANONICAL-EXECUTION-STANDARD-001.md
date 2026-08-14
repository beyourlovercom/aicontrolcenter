# AICC V2 Canonical Execution Standard

- Document ID: `AICC-V2-CANONICAL-EXECUTION-STANDARD-001`
- Version: `1.3`
- Status: `APPROVED_BASELINE`
- Effective: `2026-08-14`

## Highest execution rule

`AICC = transport + status + display + result return.`

AICC is not an execution decision engine. It has no business, governance,
permission, readiness, feasibility, or task-safety judgment authority.

```text
AICC_DECISION_AUTHORITY = 0
AICC_PRE_CODEX_SEMANTIC_GATES = 0
AICC_PASS_FAIL_BLOCKED_AUTHORITY = CODEX
AICC_RESULT_REWRITE = 0
```

This rule inherits directly from `AICC-V2-PROJECT-CONSTITUTION-001` and has
higher precedence than any execution implementation, Work Package, UI flow,
Bridge behavior, API adapter, shortcut, or future automation.

## Pass-through control plane

AICC execution entry points are transport adapters. They accept input, create
and correlate durable execution identity, launch Codex, observe process truth,
persist evidence, display state, and return results exactly once. They have zero
pre-Codex semantic gates. Codex owns repository, branch, HEAD, worktree, Work
Package, governance, permission, scope, feasibility, implementation, task
safety, testing, and execution reasoning.

`AICC_EXECUTION_V1` is an optional transport envelope. Parsing/transport code
may identify a malformed transport payload, but it may not convert semantic
repository or task findings into an AICC block. A usable raw task remains
executable when the envelope is absent. AICC never turns a Codex task finding
into an AICC runtime failure.

## Allowed AICC checks

AICC may perform only infrastructure checks required to establish transport
truth, for example:

- whether an instruction payload exists to send;
- whether a durable execution identity can be created;
- whether the Codex runtime can be reached/launched;
- whether the same durable execution/result is being delivered twice;
- whether the originating conversation/message can be correlated for return.

These checks may produce an AICC transport/runtime error such as
`DELIVERY_FAILED`; they may not produce a semantic task `BLOCKED` result.

## Forbidden AICC checks

AICC must not block Codex launch because of its own interpretation of:

- repository, branch, HEAD, worktree, or Git state;
- Formal Work Package presence, content, scope, or lifecycle;
- Owner authorization or governance state;
- allowed/forbidden file mutation, commit, push, PR, merge, deploy, or other
  task actions;
- dependency readiness, test sufficiency, implementation feasibility, review
  state, or business correctness;
- any equivalent rule renamed as preflight, readiness, policy, safety,
  validation, authorization, governance, repository, or conflict gate.

If any of those conditions matter, Codex evaluates them using repository-local
rules and returns the explicit result/reason.

## Status ownership

AICC transport/runtime state and Codex task outcome are separate canonical
facts and must never be collapsed into one ambiguous `STATUS` field.

```text
AICC_STATUS:
QUEUED | SENT | RUNNING | RESULT_RECEIVED | RETURNED_TO_GPT | DELIVERY_FAILED

CODEX_RESULT:
PASS | FAIL | BLOCKED | CANCELLED | NOT_STARTED

CODEX_REASON:
owned and returned by Codex
```

Examples:

```text
AICC_STATUS: RESULT_RECEIVED
CODEX_RESULT: BLOCKED
CODEX_REASON: FORMAL_WORK_PACKAGE_MISSING
```

means AICC succeeded as a transport/control surface and Codex independently
blocked the task with an explicit reason.

```text
AICC_STATUS: DELIVERY_FAILED
CODEX_RESULT: NOT_STARTED
AICC_ERROR: CODEX_RUNTIME_UNREACHABLE
```

means the transport/runtime path itself failed before Codex could start.

## Result preservation

AICC stores and displays Codex output without semantic reinterpretation.
Exactly-once return, result hashing, deduplication, conversation/message
binding, formatting for display, and durable persistence are allowed because
they preserve transport integrity rather than decide task semantics.

AICC may not upgrade, downgrade, replace, hide, or invent `PASS`, `FAIL`,
`BLOCKED`, `CANCELLED`, or `CODEX_REASON`.

## Safety policy

The former AICC worktree, provenance, conflict, Formal WP, authorization lease,
and repository-global Writer Lock checks are historical v1.0/v1.1 behavior and
are deprecated as execution authority. They may remain as observational data,
but cannot block Codex launch. Independent runs have independent state and
evidence; AICC does not enforce one repository/one writer serialization.

Codex CLI sandbox/approval controls, repository-local rules, OS protections,
and Git protections remain the execution safety authority. Removing duplicated
AICC gates does not remove those protections; it removes only duplicate and
opaque AICC judgment.

Terminal runtime states do not block a later valid run and Runtime COMPLETED
does not imply WP completion.

Permanent rule: no new semantic execution rule may be implemented inside AICC.
A new task rule belongs to Codex/repository-local authority or requires an
explicit Owner-approved constitutional baseline change.
