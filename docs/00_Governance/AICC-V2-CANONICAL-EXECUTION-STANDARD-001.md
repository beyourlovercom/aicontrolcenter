# AICC V2 Canonical Execution Standard

- Document ID: `AICC-V2-CANONICAL-EXECUTION-STANDARD-001`
- Version: `1.2`
- Status: `APPROVED_BASELINE`

## Pass-through control plane

AICC execution entry points are transport adapters. They normalize input,
launch Codex, observe process truth, persist evidence, correlate runs, and
return results. They have zero pre-Codex semantic gates. Codex owns repository,
branch, HEAD, worktree, scope, feasibility, implementation, and task safety
reasoning.

`AICC_EXECUTION_V1` is an optional envelope. Parsing is strict when its marker
is present, but a non-empty raw task is passed through when no envelope is
supplied. AICC never turns a Codex task finding into an AICC runtime failure.

## Safety policy

The former AICC worktree, provenance, conflict, Formal WP, authorization lease,
and repository-global Writer Lock checks are historical v1.0/v1.1 behavior and
are deprecated as execution authority. They may remain as observational data,
but cannot block Codex launch. Independent runs have independent state and
evidence; AICC does not enforce one repository/one writer serialization.

Codex CLI sandbox/approval controls, OS protections, and Git protections remain
the safety authority. Removing duplicated AICC gates does not weaken them.

Terminal runtime states do not block a later valid run and Runtime COMPLETED
does not imply WP completion.

Permanent rule: new execution rules must be implemented inside an existing
canonical authority or be an explicit extension approved through baseline
change control.
