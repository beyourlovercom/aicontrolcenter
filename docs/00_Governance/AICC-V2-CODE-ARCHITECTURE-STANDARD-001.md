# AICC V2 Code / Architecture Standard

- Document ID: `AICC-V2-CODE-ARCHITECTURE-STANDARD-001`
- Version: `1.0`
- Status: `APPROVED_BASELINE`

## Dependency direction

`Canonical Core → Domain / Service → Adapters → Projection / UI`

Fast Execution owns execution foundation and canonical integration. Runtime
Manager owns runtime and Writer Lock. GPT Bridge Core is a protocol adapter.
Entity Context, Owner Action UI, Evidence, and Run Reports are projections.
Vite middleware is transport/orchestration only.

No UI, Evidence, Bridge, Run Report, or transport module may create domain
authority or parallel business rules.

## Scope and service rules

Every Work Package defines semantic File Scope. Changes are classified as
`IN_SCOPE`, `EXPECTED_IN_SCOPE_EVOLUTION`, `KNOWN_NON_CONFLICTING_EXTERNAL_WIP`,
or `OUT_OF_SCOPE`.

The canonical Local Control Service is singular. No second backend/runtime may
be introduced without a baseline change proposal. Exact frozen file lists are
not the sole semantic authorization scope.

## Runtime boundary

The runtime stack is ChatGPT Plus, AICC Web App, Codex/Codex CLI, Git, and
GitHub where applicable. OpenCode, OpenSpec, and OmO must not be added, invoked,
or used as runtime dependencies.
