# Formal GUI deployment preflight — 2026-10-10
- User authorized formal deployment and use of legacy Desktop Commander as backup.
- China Mac live agent verified: PID 9918, `/opt/homebrew/bin/node /Users/a/AI/007/worktrees/byl-remote-mcp-china/scripts/byl-remote-mcp/dc-agent.mjs`, TCP `100.102.15.40:8791`.
- Agent's `/v1/tools` and `/v1/call` dynamically list and call its nested Desktop Commander SDK tools; it does not register separate GUI commands. Editing source alone does not modify the running process.
- The repository `gateway.mjs` forwards `/v1/executions` to device backends and has no GUI registration path. Connector's live plugin registration is a separate deployment surface.
- Legacy DC lists China and Windows online, US Mac mini offline in *legacy* inventory; self-built Operator UAT lists all three READY. Inventories differ and must not be conflated.
- PR #52's action implementation is fixture-only; it demands exact `/tmp/byl-gui-owner-uat-20261010.html` and only `UATPASS`. It cannot manipulate ordinary Dev website elements.
- A production declaration is **BLOCKED**, not passed. Need connector server code/registration, generic yet strictly scoped Dev AX action implementation, end-to-end auth and origin binding, canary, rollback. A restart/cutover with three READY devices must not be improvised.
- No live service was restarted or modified during this preflight.
