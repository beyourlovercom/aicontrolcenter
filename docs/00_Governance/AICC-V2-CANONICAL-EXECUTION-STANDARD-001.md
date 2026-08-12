# AICC V2 Canonical Execution Standard

- Document ID: `AICC-V2-CANONICAL-EXECUTION-STANDARD-001`
- Version: `1.0`
- Status: `APPROVED_BASELINE`

## One decision authority

Every execution entry—Owner Start, Retry, GPT Bridge, Autopilot, PR Runner,
or future runner—must consume the single `canonicalExecutionDecision()` in
`src/lib/fastExecution.ts`. The result family is:

`ALLOW | ALLOW_WITH_WARNING | OWNER_ACTION_REQUIRED | HARD_BLOCK`

It carries `decision`, `severity`, `reasonCode`, Chinese reason, and next
action. Consumers may not implement independent authorization, worktree, HEAD,
scope, Formal WP, runtime, or Writer Lock gates.

## Safety policy

Worktree states are `CLEAN`, `KNOWN_IN_SCOPE_DIRTY`,
`KNOWN_NON_CONFLICTING_DIRTY`, and `UNKNOWN_OR_CONFLICTING_DIRTY`; only the last
is a hard block. Scope evolution is expected, material expansion requires
Owner action, and out-of-scope expansion hard blocks.

IMPLEMENTATION and REMEDIATION require a valid Owner WP Execution Lease.
READ_ONLY_AUDIT with read-only sandbox and `requiresAuthorization=false` does
not require a lease, but still obeys repository, branch, Formal WP, scope,
runtime, Writer Lock, and repository-boundary safety.

Terminal runtime states do not block a later valid run and Runtime COMPLETED
does not imply WP completion.

Permanent rule: new execution rules must be implemented inside an existing
canonical authority or be an explicit extension approved through baseline
change control.
