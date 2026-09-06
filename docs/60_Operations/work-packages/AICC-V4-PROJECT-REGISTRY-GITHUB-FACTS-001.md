---
schema: aicc-v4-work-package/v1
id: AICC-V4-PROJECT-REGISTRY-GITHUB-FACTS-001
title: Project Registry + GitHub Project Facts
status: READY_FOR_REVIEW
authority_sha: e4c353e414657403421564e24c53186bb3f1264b
owner_authorization: AUTHORIZED_FOR_IMPLEMENTATION
---

# AICC-V4-PROJECT-REGISTRY-GITHUB-FACTS-001

## Objective

Create the V4 multi-project foundation without creating a second project truth database.
The registry stores project locators only; GitHub supplies default branch, head SHA,
roadmap content, PR facts and CI check facts at refresh time.

## Acceptance

- multiple project IDs may point at the same GitHub repository;
- registry cannot persist branch/SHA/status/progress/WP/Task/PR/CI facts;
- GitHub reads are read-only and carry repository + exact SHA provenance;
- roadmap WP/Task references are extracted only from explicit labels, never inferred;
- a failed project refresh is visible and cannot contaminate other projects;
- V3 production runtime and its single-project contract remain unchanged;
- no execution, merge, deploy, release, or machine-control action is added.

## Verification evidence

- V4 contract/API tests: `8/8 PASS`.
- V3 full regression: `63/63 PASS`; `/v3` has no changed files.
- Real GitHub smoke: five registered project views resolved from GitHub with exact default-branch SHA provenance.
- AICC and YBY-Core demonstrate separate project identity from repository identity; Andy-Core and YBY-Core may share one repository.
- Temporary V4 service health returned `AICC_V4` with five registered projects; the read API exposes no mutation path.
