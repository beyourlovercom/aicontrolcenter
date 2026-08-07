## 1. Governance Closeout

- [x] 1.1 Close 001A at the exact accepted SHA.
- [x] 1.2 Update roadmap authority, closed packages, and ordered future packages.
- [x] 1.3 Add closeout and non-authorizing 001B Work Package contracts.

## 2. UAT Build

- [x] 2.1 Enable `workflow_dispatch` and `main` push triggers.
- [x] 2.2 Use `npm ci` and assert explicit full/short commit identity.
- [x] 2.3 Produce commit-addressed `.app.zip`, `.dmg`, `SHA256SUMS.txt`, `codesign-details.txt`, and SHA evidence.
- [x] 2.4 Keep the workflow unsigned/ad-hoc UAT-only with no Release or Deploy action.

## 3. Verification

- [x] 3.1 Add strict OpenSpec validation to CI.
- [x] 3.2 Add deterministic secret and absolute-path scans to CI.
- [x] 3.3 Run local and CI OpenSpec/repository verification.
- [ ] 3.4 Complete Human macOS UAT against the SHA-bound main artifact.
