## Context

The repository is already at accepted SHA `0daa089a7edc8d1852df949636a7f11d19bcecee`. Governance documents are the formal state boundary, while GitHub Actions provides the repeatable UAT build boundary.

## Decisions

- Use a closed closeout Work Package with the exact accepted SHA and keep `openspec/changes/aicc-control-loop-001a` unarchived.
- Keep 001B `PLANNED` with `NOT_AUTHORIZED`; its planning artifacts describe future behavior only and cannot trigger Apply, Sync, Archive, OpenCode start, or authorization.
- Trigger macOS builds only from `main` pushes or explicit `workflow_dispatch`.
- Capture `GITHUB_SHA`, a 12-character short SHA, and a checked-out HEAD equality assertion before building. Include both SHA forms in artifact names and evidence files.
- Build the app with `--no-sign`, then apply only an ad-hoc local signature for UAT verification. Produce `.app.zip`, `.dmg`, `SHA256SUMS.txt`, `codesign-details.txt`, and commit evidence; do not publish a Release or Deploy.

## Security Boundaries

Workflow permissions remain `contents: read`. No credentials are read or written, no arbitrary command input is accepted, and scans reject common secret markers and absolute local paths. The workflow has no push, release, deployment, migration, or PR action.

## Rollback

Rollback is a normal reviewed revert of this documentation/workflow diff. Do not reset, force, delete, archive, or mutate repository history as part of UAT.
