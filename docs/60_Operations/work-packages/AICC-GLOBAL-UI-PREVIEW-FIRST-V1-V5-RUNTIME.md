# AICC Global UI Preview First V1 — V5 Runtime Compatibility

Status: `DRAFT PR / EXACT-HEAD CI / OWNER MERGE GATE`
Parent policy: `docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md`
Parent PR: `#63`, merged to GitHub main `340d0a33e14213ecd77126323e4d52a59d8109fb`
Authorization: Owner approved AICC running version update / Owner UAT after #63.

## Production discovery

Read-only verification on CN Mac (2026-10-14): actual port 1420 backend advertises `aicc.v3.health.v1` for `aicc-v5-workbench`; V5 backend runs `v3/server.mjs`, UI is V5 Svelte Vite preview. Exact production worktree HEAD was `1254732fa149173f09fe2b1b2d333fbd517c5dff`, not GitHub main. V4 `/api/projects/.../context` does not exist (404). Therefore deploying only V4 Copy GPT Context does NOT activate the rule in existing V5 Next-Step / GPT Planner, and replacing live V5 with V4 is forbidden without a separate migration.

## Bounded compatibility

- Read canonical global policy from the AICC GitHub default branch at a pinned exact commit through existing authenticated `gh api`.
- Freeze its identity, SHA-256 and full GPT instruction into **new** V5 Next-Step requests *before* the existing Next-Step prompt and SHA are finalized.
- Do not classify UI changes, infer Owner PASS, alter existing requests, add browser tabs, rewrite Bridge output, or touch executed result content.
- If GitHub authentication / policy lookup / content validation fails, reject new Next-Step creation explicitly with `NEXT_STEP_GLOBAL_UI_PREVIEW_POLICY_UNAVAILABLE`.
- Existing claims, pending requests and completed Results remain immutable.
- Run V3/V5 tests, root CI and Owner UAT. No AICC runtime change until exact-head CI, a separately approved merge, scope review, rollback evidence and safe controlled service update (no device restart).

## UAT evidence

1. Verify actual V5 Next-Step prompt contains the global rule, AppBlock preference, and provenance for the exact policy GitHub commit.
2. Verify an absent canonical policy causes clear 503 without new Next-Step intent.
3. Verify existing Next-Step isolation/claim/receipt/idempotency tests are unchanged.
4. Verify root and V4 global policy integration remain valid.
5. Owner visually confirms that UI tasks are preview-first; no automatic PASS or Production deploy.
