## Why

Human UAT failed against the merged-main artifact because sync confirmation was not reliable in Tauri, the left roadmap was static rather than evidence-driven, and valid planned Work Packages were rejected as schema-invalid.

## What Changes

- Add explicit in-app sync confirmation and visible loading, cancellation, success, and failure states.
- Build the visible roadmap from the Living Roadmap and formal Work Package evidence.
- Parse valid `PLANNED` / `NOT_AUTHORIZED` Work Packages while keeping execution blocked.
- Add regression tests for the three findings and existing sync safety sequence.

## Explicit Exclusions

This change does not archive OpenSpec, deploy, release, authorize or implement 001B, change the original closeout from `AUTHORIZED` / `CURRENT`, or mark Human UAT as passed.
