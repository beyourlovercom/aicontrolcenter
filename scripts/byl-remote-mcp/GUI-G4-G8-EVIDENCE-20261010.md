# GUI Control G4–G8 — isolated verification

## Verified results
- G4: independent stdio MCP Server registers `gui_dev_inspect` and `gui_fixture_action`. Standard MCP Client -> Stdio transport -> Server verified.
- G5: exact local fixture AX window/URL verified. MCP action calls native CGEvent mouse click and keyboard typing; readback confirms actual page title change.
- G6: exclusive O_EXCL filesystem lock added to handler; reentrancy and cleanup tests PASS. Foreground PID guard fails closed if a competitor steals focus. Cross-app arbitration **not** established.
- G7: offline browser fixture, isolated Chrome profile PID 82632: MCP inspect success; click response `ok=true, executed=true, verified=true`; type response `ok=true, executed=true, verified=true`; exit 0.
- G8: 48/48 automated tests PASS, native Swift typecheck PASS, git diff check PASS. Server tool name/action mismatch rejects, production host and real checkout rejected.

## Outstanding boundaries, before deployment or Owner UAT
1. **No deployed connector integration.** This is a standalone stdio MCP server exercised on China Mac through the existing remote terminal. ChatGPT cannot yet invoke these as first-class hosted tools.
2. **No real dev.beyourlover.com page tested.** G7 is isolated `file://` fixture only; `expectedHost` request field is an allowlist marker, not proof that a dev web origin was opened. Actual AX identity is a fixed local file path.
3. Security/operability work: provision SDK as project dependency instead of machine-specific absolute import, enforce real cross-client desktop arbitration, screenshot evidence/cleanup retention, robust accessible element targeting across Chrome versions, security review.
4. Never use the fixture tool for payments, real website forms, secrets, production, or customer data.
5. Do not merge PR #52 or deploy/restart the live MCP, switch DNS, change access controls, or alter US primary MCP from this artifact.

## Conclusion
**G4–G8 isolated prototype E2E PASS; integrated Dev website and deployed remote MCP UAT NOT DONE.** Next gate is integration engineering and Owner review when actual Dev MCP can be tested safely.
