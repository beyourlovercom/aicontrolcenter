---
schema: aicc-work-package/v1
id: AICC-CODEX-ONLY-MIGRATION-001
title: Codex-Only Migration And Human UAT Delivery
status: AUTHORIZED
authority_sha: fcd41386fafd6ee2083e73cdee71bee68a3a1e09
openspec_change: aicc-codex-only-migration-001
dependencies:
  - id: AICC-CONTROL-LOOP-001A
    status: CLOSED
previous_run_status: HUMAN_UAT_FAIL
owner_authorization: AUTHORIZED_FOR_IMPLEMENTATION
authorization_scope:
  - Codex-only migration
  - repository-standard validation
  - independent review
  - scoped PR
  - exact-head CI
  - squash merge
  - main-bound Human UAT artifact
allowed_capabilities:
  - REPOSITORY_SCOPED_EDIT
  - STANDARD_VALIDATION
  - INDEPENDENT_REVIEW
  - SCOPED_PR
  - EXACT_HEAD_CI
  - SQUASH_MERGE
  - BUILD_UAT_ARTIFACT
forbidden_capabilities:
  - ARBITRARY_SHELL_UI
  - FORCE_PUSH
  - OPENSPEC_SYNC
  - PRODUCTION_DEPLOY
  - DESTRUCTIVE_DATABASE
  - SECRETS_MUTATION
  - HUMAN_UAT_SELF_PASS
---

# AICC-CODEX-ONLY-MIGRATION-001

The Owner instruction `EXECUTE_AICC_CODEX_ONLY_MIGRATION_TO_HUMAN_UAT` explicitly authorizes this bounded migration at Authority SHA `fcd41386fafd6ee2083e73cdee71bee68a3a1e09`.

## Scope

- Replace active OpenCode and OmO Slim architecture with Codex CLI using the configured `sol` profile.
- Add persisted Owner authorization bound to Work Package and repository evidence.
- Add a typed observable Codex runtime contract and bounded Owner controls.
- Preserve OpenSpec, Authority-first governance, Resolver gates, Writer Lock, independent review, exact-head CI, and Human UAT gates.
- Deliver through normal-risk remediation, Draft PR, independent review, exact-head CI, squash merge, main CI, and a SHA-bound unsigned/ad-hoc macOS UAT artifact.

## Allowed capabilities

- Read and modify only this repository within the named migration scope.
- Run repository-standard validation.
- Create commits, push the fixed feature branch, create and ready the scoped PR, monitor exact-head CI, and squash merge after all gates pass.
- Build and retrieve the main-bound Human UAT artifact.

## Forbidden capabilities

- Arbitrary shell input from the Owner UI.
- Force push, rebase, reset, automatic conflict resolution, OpenSpec Sync, Release, or Deploy.
- Production deployment, destructive database operations, secrets mutation, security architecture expansion, or irreversible external writes.
- Marking Human UAT PASS without human evidence.

## Exit

The package stops at `READY_FOR_HUMAN_UAT`. It is not `CLOSED` until Human UAT evidence exists.
