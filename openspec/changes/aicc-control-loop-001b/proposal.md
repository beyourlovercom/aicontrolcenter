## Why

The control plane needs a future, typed read-only binding between formal Work Packages and their complete OpenSpec planning artifacts. The binding must expose evidence without turning local planning files into authorization.

## What Changes

- Define a typed, read-only OpenSpec binding contract for proposal, design, tasks, and capability specs.
- Define dependency, authority, completeness, ambiguity, and owner-gate outcomes.
- Define evidence suitable for a future resolver and UI without executing any OpenSpec or OpenCode operation.

## Explicit Exclusions

This is planning only. It does not authorize or implement OpenSpec Apply, Sync, Archive, OpenCode start, self-authorization, agent execution, repository mutation, or Work Package selection.

## Capabilities

### New Capabilities

- `openspec-binding`: Future read-only binding and evidence model.
