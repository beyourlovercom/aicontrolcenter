# Design

## Evidence boundaries

The Living Roadmap and formal Work Package files define hierarchy and lifecycle. A persisted Owner authorization record supplements but never rewrites formal evidence. It is valid only while its Work Package ID, Authority SHA, branch, and worktree match current repository evidence.

## Runtime contract

The backend exposes typed authorization and Codex runtime commands. Runtime state is persisted in the operating-system application data directory and records only observed or explicitly requested state. The Owner UI accepts no shell text.

The configured execution engine is Codex CLI with profile `sol`. Allowed runtime controls are START, PAUSE, RESUME, STOP_AFTER_CURRENT_STEP, and RETRY. Every transition fails closed when authorization or repository bindings drift.

## Delivery safety

Normal-risk delivery requires tests, independent review, exact-head CI, no unresolved blocker, and unchanged scope before squash merge. Production deploy, destructive database work, secrets, security architecture expansion, and irreversible external writes remain separate Owner gates.

## UAT

The existing main-push macOS workflow produces an unsigned/ad-hoc artifact tied to the merged main SHA. Human UAT remains pending after artifact creation.
