# AICC-V3-CLEAN-BOOTSTRAP-001

Status: `ACTIVE / OWNER_AUTHORIZED`

## Objective

Freeze V2 and establish a clean AICC V3 foundation with one service, one state root, and one active ProjectContext.

## In scope

- V2 freeze record.
- `rebuild/aicc-v3-clean` branch and isolated worktree.
- `~/.aicc-v3` state root.
- zero-dependency V3 HTTP server.
- `/api/health` and `/api/project`.
- minimal static UI showing Project / Repository / Branch / HEAD / Dirty.
- V3-only tests and CI.
- isolated development-port runtime verification.

## Out of scope

- V2 bug remediation.
- Roadmap parsing beyond the V3 roadmap document.
- WP/Task runtime behavior.
- Codex execution.
- GPT Bridge.
- PR creation or merge.
- production cutover to port 1420.
- Human UAT PASS.
## Acceptance criteria

- Original China Mac V2 dirty worktree remains untouched.
- PR #11 remains Draft / open / not merged.
- V3 branch is based directly on GitHub main at rebuild start.
- V3 source has no legacy V2 runtime/application imports.
- Missing project config fails closed.
- Repository branch / HEAD / dirty derive from one ProjectContext.
- One Node server can render the UI and expose health/project APIs.
- Browser DOM contains V3 authority facts and no V2 fallback facts.
- V3-specific CI passes on the exact pushed head.

## Current machine evidence

- local tests: 4/4 PASS.
- isolated runtime: `127.0.0.1:1430` HTTP PASS.
- `/api/health`: `AICC_V3`, project available.
- `/api/project`: branch `rebuild/aicc-v3-clean`, repository `beyourlovercom/aicontrolcenter`.
- browser DOM precheck: Project / Branch / HEAD / ONE PROJECT CONTEXT PASS; legacy V2 markers absent.

## Next exact gate

Commit and push the V3 bootstrap exact head, then require V3-specific GitHub Node-22 CI PASS. Stop before PR creation, port-1420 cutover, `aicc.b` cutover, or Human UAT.