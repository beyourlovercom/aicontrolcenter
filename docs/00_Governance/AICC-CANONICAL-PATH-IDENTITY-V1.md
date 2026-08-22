# AICC Canonical Path Identity V1

- Document ID: `AICC_CANONICAL_PATH_IDENTITY_V1`
- Version: `1.0`
- Status: `OWNER_APPROVED_BASELINE`
- Effective: `2026-08-22`

## Purpose

AICC must not treat path spelling, path casing, symlink spelling, or configured display paths as repository identity. The pre-change repository audit found 49 hard-coded local-root references across 29 tracked files; most are configuration, fixtures, protocol examples, or historical evidence rather than identity authority.

## Canonical rules

1. Canonical project identity is `projectId + repositoryIdentity`.
2. `repositoryPath` is execution-location/evidence data and is not browser-side project identity authority.
3. Node/local-service filesystem identity uses `canonicalFilesystemPath()` / `sameCanonicalPath()` from `src/lib/canonicalPathIdentity.ts`.
4. Native Tauri filesystem identity uses `same_canonical_path()` and filesystem canonicalization.
5. Missing/unresolvable filesystem paths fail closed; no lowercase-string fallback is permitted.
6. Configured roots may retain their historical spelling. A configured path does not need to be renamed merely to match Git's returned casing.
7. Browser-delivered modules must not import Node filesystem identity helpers. Browser projections consume project identity and server-validated facts.

## Audit classification

The repository-wide pre-change scan of the two historical local-root casings produced this inventory:

- `49` tracked occurrences across `29` files.
- `38` occurrences across `21` test/fixture files.
- `3` occurrences across `2` governance/registry/history files.
- `1` extension README example.
- `7` occurrences in `5` production/config/default files; one of those seven is an inline Rust redaction-test literal in the native source file.
- Post-convergence known raw-path identity comparison patterns: `0`.

Hard-coded local paths are permitted when they are fixed local-service configuration, Project Registry configuration, protocol/test fixtures, documentation, or display metadata. They are forbidden as raw equality authorities for repository ownership, process ownership, authorization validity, runtime repository matching, or project scope binding.

The following identity surfaces are converged to this baseline: Project Registry validation, local-service port/PID ownership, execution authorization checks, execution-lease repository checks, runtime expected/stored authorization checks, Bridge authorization checks, local-service recovery classification, and Tauri production-root validation.

Legacy Layer 2 path-only evidence remains compatible only through Project Registry aliases validated by the server authority: configured `repositoryPath` plus emitted `canonicalRepositoryPath`. Arbitrary/unregistered paths fail closed; new records should use canonical `repositoryIdentity`.

## Regression requirement

`npm run test:canonical-path-identity` must pass. The guard rejects reintroduction of known raw-path equality forms and proves filesystem aliases converge through the canonical helper while distinct or missing paths do not.
