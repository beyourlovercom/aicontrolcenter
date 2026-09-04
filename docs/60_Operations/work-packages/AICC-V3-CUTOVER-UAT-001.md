# AICC-V3-CUTOVER-UAT-001

Status: `ACTIVE / OWNER_AUTHORIZED`

## Objective

Cut over the China Mac local AICC entry point from frozen V2 to the clean V3 single-service runtime and present the minimal V3 surface for Owner Human UAT.

## In scope

- retire the running V2 listener from port 1420 without deleting V2 state or worktrees;
- start exactly one V3 server on port 1420;
- make `aicc.b` resolve only to the V3 port-1420 runtime;
- verify `/api/health`, `/api/project`, listener ownership, and rendered DOM;
- verify V3 branch / HEAD / CLEAN facts all come from the one ProjectContext;
- present the minimal page to the Owner for explicit Human UAT.

## Out of scope

- V2 remediation or migration;
- V2 state import;
- Roadmap feature implementation;
- WP / Task / Codex / GPT Bridge behavior;
- PR creation or merge;
- Human UAT PASS without explicit Owner `pass`.
## Acceptance criteria

- port 1420 has exactly one listener and it is the V3 Node server;
- no V2 process is serving port 1420;
- `aicc.b` returns the V3 page without fallback to 1422 or legacy V2;
- `/api/health` reports `AICC_V3` and project available;
- `/api/project` reports `rebuild/aicc-v3-clean`, the exact pushed HEAD, and truthful CLEAN/DIRTY;
- browser DOM shows V3 authority facts and contains no V2 fallback markers;
- original V2 dirty worktree remains untouched;
- PR #11 remains Draft / open / not merged.

## Rollback boundary

If V3 cannot own port 1420 cleanly, stop V3 and restore the prior V2 service process without modifying V2 repository state. Do not run both services on 1420.

## Next exact gate

Commit/push this cutover WP and Roadmap authority update; require V3-specific CI PASS on the exact head; then perform the local 1420 + `aicc.b` cutover and stop at Owner Human UAT.