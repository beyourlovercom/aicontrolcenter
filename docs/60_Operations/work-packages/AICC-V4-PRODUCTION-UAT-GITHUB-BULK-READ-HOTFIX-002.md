# AICC V4 Production UAT — GitHub Bulk Read Hotfix 002

Status: IMPLEMENTATION COMPLETE / DRAFT PR + EXACT-HEAD CI GATE
Source of Truth: `GitHub`
Work Package: `AICC-V4-PRODUCTION-UAT-GITHUB-BULK-READ-HOTFIX-002`
Authority Base: `main@c5a1c438c4d16d41930101a0bbcac9f02008ff3b`

## Trigger

Production UAT on CN Mac reproduced a second latency failure after PR #22: all five project views degraded to `GITHUB_API_TIMEOUT` because one All Projects refresh still spawned enough REST `gh api` subprocesses to self-contend around the 10-second per-call timeout.

Direct measurements showed a single GitHub REST read at ~2s, but 8–12 concurrent reads materially increased latency. Concurrency limiting alone reduced self-contention but required too many sequential network waves and could still exceed interactive refresh expectations.

## Fix

- Use one GitHub GraphQL aggregate query for the All Projects projection across all unique repositories.
- Retrieve repository identity, default branch, default-branch commit OID, open PRs, check-run facts and configured roadmap blobs in that aggregate request.
- Re-verify each unique repository with `commits/HEAD` after the GraphQL response; reject the affected repository if the exact SHA moved during refresh.
- Preserve separate AICC project identities when multiple project views share one repository.
- Keep single-project GPT Context and Freshness on the existing exact REST path.
- Keep REST request-scoped de-duplication / bounded concurrency as a fallback for injected clients without GraphQL support.

## Real UAT evidence

- Four-repository GraphQL aggregate query: ~1.64s in CN Mac verification.
- Three consecutive `/api/projects` runs on hotfix runtime: 3.40s / 2.87s / 2.61s.
- 5/5 project views available with exact GitHub SHA.
- Andy-Core and YBY-Core shared-repository identity remained isolated.
- GPT Context still reports GitHub as the only Source of Truth and exact main SHA.
- V3 remains healthy on port 1420.

## Boundary

This hotfix does not deploy or cut over V4. Port 1420 remains V3 production. Port 1421 remains the main-based UAT runtime and port 1422 is temporary hotfix verification only. V3 → V4 production cutover remains a separate Owner authorization gate after merge and a fresh main-based UAT pass.
