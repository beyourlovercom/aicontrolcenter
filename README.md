# AI Control Center

AI Control Center is a macOS desktop control plane for governed AI-assisted software delivery.

The first release is a read-only, self-hosted visual application that displays this repository's Roadmap, Work Packages, Authority state, OpenSpec artifacts, Oh My OpenCode Slim configuration, and validation status.

## Safety baseline

- Remote authority is checked by read-only remote query; no `git fetch`.
- OpenSpec, Oh My OpenCode Slim, OpenCode sessions, runtime state, and agent output are non-authoritative.
- Arbitrary shell, automatic push, PR creation, merge, migration, deployment, and parallel writers are denied.
- The first visible release does not start OpenCode or agents and does not mutate a repository.

## Current release target

`v0.2.0-visible` — installable unsigned macOS application.
