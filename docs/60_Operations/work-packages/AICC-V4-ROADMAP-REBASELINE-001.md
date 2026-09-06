# AICC-V4-ROADMAP-REBASELINE-001

Status: `OWNER_AUTHORIZED / IN PROGRESS`
Authority base: `main@45d3862ef0e9ec0df98939363982a8a0346ea723`
Source of Truth: `GitHub`

## Objective

Replace the incorrect OpenSpec/execution-control V4 plan with the Owner-approved GitHub-first architecture and accepted multi-project UI baseline.

## Authorized scope

- roadmap and governance documentation for V4;
- GitHub-first / GPT-orchestrated / AICC-advisory architecture;
- multi-project Project Switcher + All Projects direction;
- left collapsible Development Tree direction;
- corrected V4 effort budget.

## Explicitly not authorized

- merge PR #13;
- production deploy or release/tag;
- AICC execution authority;
- automatic branch switching or machine control from AICC;
- a second authoritative project-state database;
- OpenSpec in any V4 planning or execution path.

## Acceptance

- GitHub is the only project Source of Truth;
- GPT is the development orchestrator using GitHub + DC;
- AICC is aggregation / projection / recommendation / alerting / display only;
- V4 roadmap contains no OpenSpec successor phase;
- accepted Project Switcher + Development Tree UI is captured as the V4 visual baseline;
- V3 production runtime remains unchanged.

## Exit gate

Commit and push the corrected documentation to the existing Draft PR #13 and require exact-head CI. Stop before Ready-for-Review or merge unless the Owner separately authorizes it.
