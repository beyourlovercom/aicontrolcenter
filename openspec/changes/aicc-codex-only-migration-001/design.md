# Design

## Evidence boundaries

The Living Roadmap and formal Work Package files define hierarchy and lifecycle. A persisted Owner authorization record supplements but never rewrites formal evidence. It is valid only while its Work Package ID, Authority SHA, branch, and worktree match current repository evidence.

## Runtime contract

The backend owns a managed `codex -p sol app-server` child process and its bidirectional JSONL stdin/stdout channel. It follows the locally generated App Server protocol through `initialize`, `thread/start`, and `turn/start`, and records only observed process, session, thread, turn, event, and exit evidence. Persisted runtime state is a durable observation cache, never liveness authority. The Owner UI accepts no shell text.

START and RETRY are supported. PAUSE, RESUME, and STOP_AFTER_CURRENT_STEP remain visible as bounded typed controls but are disabled and return `UNSUPPORTED_CONTROL` because the installed App Server contract has no equivalent operation. Every transition fails closed when authorization, repository bindings, process liveness, or protocol evidence drift.

## Delivery safety

Normal-risk delivery requires tests, independent review, exact-head CI, no unresolved blocker, and unchanged scope before squash merge. Production deploy, destructive database work, secrets, security architecture expansion, and irreversible external writes remain separate Owner gates.

## UAT

The existing main-push macOS workflow produces an unsigned/ad-hoc artifact tied to the merged main SHA. Human UAT remains pending after artifact creation.
