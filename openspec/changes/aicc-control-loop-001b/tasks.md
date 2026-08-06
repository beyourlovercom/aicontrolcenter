## 1. Contract

- [ ] 1.1 Obtain a separate explicit Owner authorization for 001B.
- [ ] 1.2 Define typed binding input, evidence, and blocker variants.
- [ ] 1.3 Preserve `PLANNED` / `NOT_AUTHORIZED` until the Owner Gate changes it.

## 2. Read-Only Adapter

- [ ] 2.1 Parse Work Package front matter with unknown-field rejection.
- [ ] 2.2 Resolve only canonical, named OpenSpec artifact paths.
- [ ] 2.3 Report complete, incomplete, malformed, ambiguous, dependency, authority, and owner-gate states.
- [ ] 2.4 Ensure no Apply, Sync, Archive, OpenCode start, shell, or self-authorization path exists.

## 3. Verification

- [ ] 3.1 Add unit tests for every binding and blocker variant.
- [ ] 3.2 Add isolated filesystem integration tests for traversal and missing artifacts.
- [ ] 3.3 Add one end-to-end read-only evidence scenario.
- [ ] 3.4 Run typecheck, frontend tests, Rust tests, and repository scans after authorization.

## 4. Explicit Stop

- [ ] 4.1 Stop before implementation if Owner authorization is absent.
- [ ] 4.2 Do not run OpenSpec Apply, Sync, Archive, or start OpenCode from this change.
