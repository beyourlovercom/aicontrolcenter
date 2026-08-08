# AI Control Center

AI Control Center is a macOS desktop control plane for governed AI-assisted software delivery.

The current release is a Codex-only, self-hosted visual application that displays this repository's Roadmap, Work Packages, Authority state, OpenSpec artifacts, Owner authorization, Codex runtime evidence, and validation status.

## Safety baseline

- Remote authority is checked by read-only remote query; no `git fetch`.
- OpenSpec, Codex sessions, runtime state, and agent output are non-authoritative.
- Arbitrary shell, force operations, unscoped mutation, production deployment, and parallel writers are denied.
- Owner authorization is persisted and bound to formal Work Package and repository evidence before a governed Codex run can start.
- Normal-risk delivery may advance through independent review, exact-head CI, squash merge, and a SHA-bound UAT artifact only when the named Work Package grants those capabilities.

## Current release target

`v0.3.0-codex-uat` — installable unsigned/ad-hoc macOS Human UAT application.
