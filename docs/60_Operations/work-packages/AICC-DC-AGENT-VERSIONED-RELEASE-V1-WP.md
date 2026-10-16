# AICC-DC-AGENT-VERSIONED-RELEASE-V1-WP — isolated release foundation

**Scope:** code-only, offline, no live services. This is a candidate PR work package, NOT deployment authorization.

- Source of truth `beyourlovercom/aicontrolcenter` GitHub main at review: `59352d3089c0a1e066150e9e63ed7541e3714c6d`.
- Historical macOS Agent source commit: `7606f5417f1bacf69611e1f839406dc03f1cf008`. SHA-256 of the five historical source files was matched to earlier historical audit, but the current executing Agent release remains unverified.
- US Mac agent is supervised by `com.byl.remote-mcp-us-agent`; historical launchd process identity is not persistent proof of running build bytes.
- Code-only files in this PR: `agent-versioned-release.mjs`, corresponding tests, this work package and the pull-request-only offline CI workflow.
- Do not include live Agent source, private network addresses, machine paths, tokens, credentials, launchd configuration, OAuth changes, installation scripts, production listeners or auto-restart hooks.
- The generator packages **reviewed sanitized source only** into a *new* isolated output directory, computes deterministic content SHA-256 with exact GitHub source/review commit fields and verifies integrity. It rejects symlink source files, extra files, overwrites, obvious embedded secrets/topology and unsupported device identifiers.
- Commit IDs passed to the tool are **claims**. An independently approved CI checkout and signed immutable artifact are required before release. No user-provided boolean or offline signature stands in for running process identity.
- Generated manifest is always `UNSIGNED_LOCAL_CANDIDATE`, `UNVERIFIED` process and rollback, `deployPermission=NONE`. The code contains no production deploy or rollback execution functions.
- Real service owner must separately prove actual running Agent byte mapping, publish a signed release/deployment receipt, retain a recoverable Agent-only rollback build with independent recovery proof, and obtain explicit authorized merge and release approvals before US Mac canary.
- Preserve PR #77–#80 as merged code; do not duplicate existing P2 logic. Do not alter current OAuth 8797 or any READY device.

**Gate:** offline Node tests only; successful CI permits code review, never Production/UAT claims.
