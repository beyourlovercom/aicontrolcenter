## Why

The merged 001A implementation needs a formal closeout at the accepted main SHA and a reproducible human-UAT artifact. The roadmap must also record that 001B remains planned rather than allowing documentation or CI state to imply authorization.

## What Changes

- Close AICC-CONTROL-LOOP-001A at `0daa089a7edc8d1852df949636a7f11d19bcecee` without archiving its OpenSpec change.
- Update the Living Roadmap and add formal closeout and 001B Work Package contracts.
- Build an unsigned/ad-hoc macOS UAT package from `main` or manual dispatch using `npm ci` and exact full/short commit SHA names and evidence.
- Add deterministic OpenSpec, secret, and absolute-path CI checks.

## Explicit Exclusions

No product runtime Rust/TypeScript/Svelte changes, OpenSpec Apply/Sync/Archive, OpenCode start, self-authorization, Release, Deploy, push, PR, merge, migration, or production action is included.

## Capabilities

### New Capabilities

- `post-merge-uat-closeout`: Formal closeout and reproducible UAT artifact evidence.

### Modified Capabilities

- `repository-control-loop`: Roadmap and Work Package state records 001A as closed while preserving the 001B/001C/001D sequence.
