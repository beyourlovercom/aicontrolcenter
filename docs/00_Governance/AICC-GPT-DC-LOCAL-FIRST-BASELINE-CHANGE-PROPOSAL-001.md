# AICC GPT + Desktop Commander Local-First Baseline Change Proposal

- Proposal ID: `AICC-GPT-DC-LOCAL-FIRST-BASELINE-CHANGE-PROPOSAL-001`
- Target: `AICC-V2-PROJECT-CONSTITUTION-001`
- Current version: `1.2`
- Proposed version: `1.3`
- Status: `OWNER_APPROVED / APPLIED`
- Owner approval: explicit in GPT conversation on `2026-08-24`

## Reason

Repository development through repeated GPT ↔ GitHub file operations is slower than direct work on the local repository and unnecessarily places GitHub inside the implementation loop. Investigation and validation also need not consume Codex or Claude quota.

## Approved change

Make GPT → Desktop Commander → Owner-selected machine → local repository the default development/control path. GPT retains analysis and diagnosis authority. Direct DC repository forensics and validation are preferred before coding-agent escalation.

Use exactly one Owner-assigned coding agent when implementation autonomy is materially useful. GitHub remains delivery, exact-SHA review, PR, merge, and cross-machine handoff authority rather than the default live editor.

Current Owner-declared topology assigns the China machine as the direct local repository/DC host and Claude execution to the remote US machine.

## Impact / migration

This changes the development workflow for the AICC repository. It does not alter the AICC product's canonical Task/Run/Result runtime contract. Existing AICC execution and UI baselines remain valid when AICC is used.

## Test impact

Governance/documentation-only change. Validate exact version/registry alignment, required rule presence, `git diff --check`, and preservation of existing product-runtime authority statements.

## Rollback

Revert the v1.3 constitution/registry/Agent Contract additions and restore the v1.2 development-loop wording. No runtime data migration is required.
