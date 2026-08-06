## Why

The visible application cannot currently establish whether its local repository is the governed repository, whether `origin/main` matches the accepted authority, or which authorized Work Package may be considered next. A fixed authority and sync boundary is required before later runtime controls can be introduced safely.

## What Changes

- Add typed repository identity, remote authority, workspace evaluation, Owner-triggered sync, and Work Package resolver services.
- Enforce canonical path validation, fixed Git argument allowlists, bounded execution, timeout handling, and credential redaction.
- Parse strict YAML front matter and bind each Work Package to its named OpenSpec Change.
- Replace demonstration authority and resolver UI state with real command-backed state.
- Keep OpenSpec Sync, runtime control, automatic authorization, and product Push/PR/Merge outside scope.

## Capabilities

### New Capabilities

- `repository-control-loop`: Establishes repository identity, remote authority, guarded workspace sync, and next authorized Work Package decisions.

### Modified Capabilities

- None.

## Impact

This affects the Rust Tauri command boundary, Svelte state and tests, governance documents, CI, and the existing read model. It adds no external runtime or remote service dependency.
