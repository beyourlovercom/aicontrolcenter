# AI Control Center Agent Contract

## Authority

`origin/main` exact SHA and formal governance documents are authoritative.

OpenSpec, Oh My OpenCode Slim, OpenCode sessions, runtime state, dashboards, local workspaces, caches, and agent output are non-authoritative.

No tool, agent, artifact, task checkbox, local session, or application state may authorize its own execution.

## Permanent denials

- Arbitrary shell strings from the application UI or runtime.
- OpenSpec Sync.
- Self-authorization or automatic authorization.
- Automatically starting, applying, or executing the next Work Package.
- Silently selecting one of multiple authorized Work Packages.
- Parallel writers.
- Force push.
- `git reset --hard`.
- `git clean`.
- Automatic conflict resolution.
- Automatic rebase.
- Product-runtime Push, PR creation, merge, migration, deployment, or release.
- Treating unavailable or unknown Authority as verified.

## Governed development automation

Repository development automation may create commits, push a feature branch, and create or update a Draft PR only when all of the following are true:

- the Owner explicitly authorized the named Work Package;
- the branch and Authority SHA are fixed;
- the changes remain inside the authorized scope;
- no force operation is used;
- Ready for Review and Merge remain separate Owner Gates.

AICC-CONTROL-LOOP-001A already has this whole-Work-Package authorization.

## Governed repository commands

AICC-CONTROL-LOOP-001A may implement only fixed typed repository commands.

Authority Check:

- may execute `git ls-remote origin refs/heads/main`;
- must not fetch or mutate local refs;
- must fail closed.

Owner-triggered Workspace Sync:

- may execute only `git fetch origin main`, `git switch main`, and `git merge --ff-only origin/main`;
- requires clean worktree and all execution guards to pass;
- requires explicit Owner action and confirmation;
- must revalidate immediately before execution;
- must not reset, clean, rebase, force, resolve conflicts, push, or merge a PR.

## Work Package Resolver

The resolver may calculate and display `START_ALLOWED` or one or more explicit blocker codes.

The resolver must not:

- authorize a Work Package;
- modify its status;
- run OpenSpec Apply;
- start OpenCode;
- start an OmO Slim agent;
- acquire a real Writer Lock;
- execute implementation.

## Current implementation phase

Current milestone: `M2 — Authority And Workspace Control`

Current Work Package: `AICC-CONTROL-LOOP-001A`

Authority base: `dc6d20ec9fb9d33683ad43148d10a5cb5c667552`

This Work Package may introduce:

- fixed typed Git process execution;
- read-only remote Authority checks;
- guarded Owner-triggered Workspace Sync;
- machine-readable Work Package parsing;
- next authorized Work Package resolution;
- corresponding read and control UI.

This Work Package must not introduce:

- arbitrary command execution;
- OpenCode Runtime control;
- product OmO Slim execution;
- OpenSpec Sync;
- automatic Apply;
- automatic Work Package start;
- product Push, PR, Merge, migration, deployment, or release.
