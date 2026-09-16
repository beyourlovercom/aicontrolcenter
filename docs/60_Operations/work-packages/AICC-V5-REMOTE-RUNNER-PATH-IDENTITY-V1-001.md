# AICC-V5-REMOTE-RUNNER-PATH-IDENTITY-V1-001

Status: IMPLEMENTATION_COMPLETE — PENDING_POST_MERGE_CANARY

Base: `main@1b5a31b6177ba3fd3aa605c1287c4a96697de2c0`
Branch: `fix/aicc-v5-remote-runner-path-identity-v1`
Authority: Owner authorized continued execution through Human UAT.

## Problem

On the US Mac, the same physical Git worktree can be addressed as `.../AI/...` or `.../ai/...`. `realpathSync()` preserves caller casing, so Remote Runner's string-equality worktree check rejects the same inode as `REMOTE_RUNNER_NOT_GIT_WORKTREE`.

## Scope

- Preserve exact repository identity, branch, HEAD, and allowed-root gates.
- Compare repository root and Git top by filesystem identity (`dev` + `ino`), not path spelling.
- Validate allowed-root containment by filesystem ancestry identity, not case-sensitive string prefix.
- Keep path escape fail-closed.
- Add regression tests, including Darwin case-variant coverage when supported.

## Gates

No Production deploy or business-data writes. Merge is covered by the Owner's continuing authorization; stop at Human UAT.