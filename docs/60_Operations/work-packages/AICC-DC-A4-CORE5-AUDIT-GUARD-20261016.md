# AICC-DC-A4-CORE5-AUDIT-GUARD-20261016

## Owner-approved isolated scope

This work package is the smallest A4.1 Core-5 audit-integrity remediation toward Owner UAT. It is limited to the shared `auditedAuthorize` guard and its regression tests. It does not change P1 CLOSED code, production services, private configuration, permissions, tools, deployment state, PR #72, or any other source, lockfile, or Git configuration.

## Authority and route

- Fixed GitHub `main` authority SHA: `10faa9791d4c286bdede5f19ecab70129be7fdc3`
- Isolated branch: `feature/aicc-dc-a4-core5-audit-guard-v1-20261016`
- Provider route: CODEX ONLY, with deterministic local verification.
- No commit or push is authorized by this work package.

## Remediation

Before an `allow` audit receipt, `auditedAuthorize` now requires the authorization result to contain the requested operation name and a non-null, non-array object in `arguments`. A malformed result receives a best-effort `deny` audit and cannot reach delegation. Valid grants, denied/throwing authorization, audit acknowledgement ordering, and sanitized downstream errors remain unchanged.

## Verification

The scoped test file covers every Core-5 delegated named tool (`dc_read_file`, `dc_list_directory`, `dc_get_file_info`, `dc_list_sessions`, and `dc_list_processes`) for wrong operation names, absent arguments, array arguments, no delegation, and no false `allow` audit, plus valid grants and audit-before-delegate ordering. Required checks are the scoped Node test, syntax checking, `git diff --check`, and final file-allowlist/status review.

## Hard STOP

STOP after implementation and local verification. Do not merge a PR, deploy, restart services, modify private configuration, alter P1 CLOSED code, commit, push, or claim production/live completion. Owner UAT and all later release or deployment gates remain separate.
