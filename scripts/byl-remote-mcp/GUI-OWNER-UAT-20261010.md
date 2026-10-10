# BYL Remote MCP GUI Control — Owner UAT Gate (2026-10-10)

## Scope
Isolated China Mac implementation only. No changes to Production, payments, main MCP, Windows Backup MCP, or Chrome security settings.

## Evidence from isolated Chrome profile
- Native AX inspection isolated visible Chrome PID and AXButton `Click test only` at (90,321,205,75).
- Actual native mouse events were posted at (192,355), then visible window title changed from `BYL GUI TEST READY` to `BYL GUI CLICK PASS`.
- Native AX targeted text input `GUI text test` and sent `UATPASS`; title readback `BYL GUI TYPE UATPASS`, exit 0.
- The earlier coordinate-guess attempt returned `EVENT_SENT_BUT_NOT_VERIFIED`; this is intentionally not a PASS.
- Focus theft by UURemote caused fail-closed behavior. An isolated single-process keyboard test passed.
- On the latest main worktree, local automated tests 18/18 PASS.

## Dev-only remote handler follow-up
- Added `gui-remote-handler.mjs` with request validation, PID + title binding, and read-only inspect output.
- Rejects wrong PID, missing target, Production host, and all remote GUI mutations until authenticated target URL and state verification are integrated.
- Latest isolated branch regression: 32/32 tests PASS.
- No live MCP registration or service deployment was performed.

## Existing gaps (not yet a production-ready MCP GUI tool)
1. Existing MCP agent has not been modified or restarted, and the GUI functions have not yet been exposed as a dedicated remote_call tool.
2. Window/PID matching must be bound to a trusted URL/profile and supported by a stable, authenticated MCP invocation; current demo relies on local fixture and explicit PID.
3. Cross-client desktop arbitration is incomplete: the local lock does not govern other independent desktop automation clients.
4. Screenshot and document-state verification should be returned as a single operation result; current generic controller always marks `verified:false`.
5. Typing via command-line arguments should not be used for secrets or Production input. Restrict sensitive fields in final integration.

## Owner UAT gate
Review this proof-of-concept and explicitly decide whether to authorize integration of a scoped GUI tool into the existing MCP agent in Dev-only mode. Do not merge or deploy as production-ready functionality.

## Guardrails
No live payments, no G2 enablement, no Production writes, no main MCP restart, no automatic DNS/Tunnel/OAuth changes.
