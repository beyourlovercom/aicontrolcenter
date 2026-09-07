# AICC V4.7 — GPT Context Snapshot + Suggested Next

Status: IMPLEMENTATION COMPLETE / DRAFT PR + EXACT-HEAD CI GATE
Source of Truth: `GitHub`
Work Package: `AICC-V4-GPT-CONTEXT-001`

## Goal

Provide a compact, copyable GPT execution-context snapshot for a selected project without turning AICC into project authority or an execution engine.

## Scope

- Read current project facts from GitHub at snapshot generation time.
- Include exact default-branch SHA, roadmap/WP/task, PR, default-branch CI, explicit Owner Gates and runtime observation evidence.
- Produce an explicitly advisory `Suggested Next` from a narrow evidence hierarchy.
- Provide a read-only context API and `Copy GPT Context` UI.
- Remind GPT to reconcile GitHub again before any action.

## Advisory hierarchy

1. Explicit Owner Gate.
2. Explicit Current Task.
3. Explicit Current Work Package.
4. Open PR requiring exact GitHub reconciliation when no explicit current pointer exists.
5. GitHub roadmap review.
6. Generic GitHub reconciliation when no narrower evidence exists.

## Boundaries

- GitHub remains the only project Source of Truth.
- Runtime remains ephemeral evidence only.
- AICC never approves, merges, deploys, switches branches, starts executors or controls machines.
- `Suggested Next` is not a decision and never creates Owner authorization.
- Open PR existence never implies merge readiness.
- Absence of explicit Owner Gates never proves absence of blockers.
