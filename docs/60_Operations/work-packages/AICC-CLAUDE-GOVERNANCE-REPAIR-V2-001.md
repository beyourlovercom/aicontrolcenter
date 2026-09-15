# AICC-CLAUDE-GOVERNANCE-REPAIR-V2-001

Status: `IMPLEMENTED / VALIDATED / DRAFT_DELIVERY_ALLOWED`

Owner authorization: explicit Owner instruction on `2026-09-15` to proceed with **Claude Governance Repair V2** so future projects automatically inherit global executor governance.

Authority base: `origin/main@ba223d2afeb0543352139a3279c699cb649121a6`

Branch: `governance/claude-governance-repair-v2`

## Goal

Restore account/machine-global executor governance after the expired August low-quota window caused Claude implementation routing to drift too far toward Codex and Claude usage telemetry stopped being reconciled.

## Scope

- Add the global canonical `AI Executor Governance V2` contract to GitHub.
- Make root agent governance inherit V2 automatically.
- Preserve subsystem-specific historical Codex-only runtimes without allowing them to redefine the global provider policy.
- Repair the US Mac Claude enforcement wrapper so tracked implementation is a normal governed Claude route rather than escalation-only.
- Restore machine-level execution usage logging and actually observed 5h/7d quota snapshots.
- Preserve model/session/concurrency/escalation/Owner gates.

## Explicitly out of scope

- No Production business-data writes.
- No Production deploy.
- No merge to `main` without the separate merge gate.
- No dependency/security upgrade unrelated to this WP.
- No rewrite of the frozen V3 Codex runtime into a multi-provider runtime in this WP.
- No fabricated Claude quota percentages when Anthropic returns no rate-limit payload.

## Machine evidence — US Mac

V2 enforcement files:

- `~/.aicc-remote/claude-governed`
- `~/.aicc-remote/AI_EXECUTOR_GOVERNANCE_V2.md`
- `~/.claude/statusline.sh`

Machine validation:

1. Missing routing metadata -> fail closed with exit `79` before model launch.
2. V2 `IMPLEMENTATION + CLAUDE_CODE` -> governed dry-run PASS.
3. `READ_ONLY_AUDIT` sent to Claude wrapper -> rejected with exit `79`.
4. Synthetic rate-limit payload in isolated HOME -> 5h/7d snapshot persistence PASS.
5. Wrapper/statusline shell syntax validation -> PASS.
6. No Claude model prompt was launched by these tests.

## Repository validation — CN Mac isolated worktree

- `npm test` -> PASS.
- `npm run build` -> PASS.
- `node scripts/verify-executor-governance-v2.mjs` -> PASS.
- `git diff --check` -> PASS.

`npm ci` reported one pre-existing high-severity dependency advisory. No `npm audit fix` was run because dependency remediation is outside this Work Package.

## Remaining architecture boundary

AICC `main` still contains a frozen V3 Codex-only executor runtime. V2 explicitly scopes that runtime as legacy/subsystem-specific; it is not the global provider default. A future separately scoped multi-provider transport WP is required if the AICC V3 runtime itself must directly launch the US Claude provider. Until then, canonical GPT -> governed-machine execution follows V2, while the frozen Codex-only runtime remains Codex-only by design.

## Delivery gate

This WP authorizes feature-branch commit/push and Draft PR creation. Ready-for-review, merge, and any deployment remain separate Owner gates.
