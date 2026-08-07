## Context

The repository is already at accepted SHA `0daa089a7edc8d1852df949636a7f11d19bcecee`. Governance documents are the formal state boundary, while GitHub Actions provides the repeatable UAT build boundary.

## Decisions

- Keep the closeout Work Package `AUTHORIZED` and current while the SHA-bound artifact and Human UAT are pending; do not mark it `CLOSED` in this change.
- After the merged-main artifact exists and Human UAT explicitly passes, a separate bounded Post-UAT Closure updates the closeout Work Package to `CLOSED`.
- Keep 001B `PLANNED` with `NOT_AUTHORIZED`; its planning artifacts describe future behavior only and cannot trigger Apply, Sync, Archive, OpenCode start, or authorization.
- Trigger macOS builds only from `main` pushes or explicit `workflow_dispatch`.
- Capture `GITHUB_SHA`, a 12-character short SHA, the actual runner architecture, and a checked-out HEAD equality assertion before building. Include all identity fields in artifact names and evidence files.
- Build the app with `--no-sign`, then apply only an ad-hoc local signature for UAT verification. Produce `.app.zip`, `.dmg`, `SHA256SUMS.txt`, `codesign-details.txt`, and commit evidence; do not publish a Release or Deploy.

## Security Boundaries

Workflow permissions remain `contents: read`. No credentials are read or written, no arbitrary command input is accepted, and scans reject common secret markers and absolute local paths. The workflow has no push, release, deployment, migration, or PR action.

## Rollback

Rollback is a normal reviewed revert of this documentation/workflow diff. Do not reset, force, delete, archive, or mutate repository history as part of UAT.
