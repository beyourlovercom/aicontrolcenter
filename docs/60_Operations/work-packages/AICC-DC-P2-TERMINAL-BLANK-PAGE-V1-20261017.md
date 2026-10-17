# AICC DC P2 — Terminal Blank-Only Page Presentation V1

## Scope and source baseline

Owner authorized proceeding from the P2 four-device read-only findings on 2026-10-17. GitHub main is canonical. This change is a **pure typed-facts presentation helper** added to existing `p2-terminal-fidelity.mjs`, plus tests and a PR-only offline workflow. No installed Agent runtime, OAuth/Gateway, protected legacy source, startup service, device, terminal manager or upstream dependency is modified.

Predecessor: [GitHub #67 P2 four-device live UAT and upstream source comparison](https://github.com/beyourlovercom/aicontrolcenter/issues/67#issuecomment-6230617887).

## Observed live differences (do not reclassify as PASS)

- On all four OAuth-connected devices, 22 numbered Chinese lines + 2 real interior blank lines produced **25 reported total lines**, with the extra last page showing `(No output in requested range)`. Positive absolute offsets and explicit nonzero exit code 7 behaved correctly.
- Re-reading completed processes with offset=0 repeated the first page on Windows and US Mac. It is a **live discrepancy**, not proof of a particular installed source commit.
- Current official `wonderwhy-er/DesktopCommanderMCP` public main pinned at `f508e524469c26f6366e17dbfd3ee5a69d112127` already retains completed-session read position and removes **one** phantom empty terminal line in `src/terminal-manager.ts`. Both are upstream fixes to reuse at a future **authorized versioned Agent/runtime integration**, NOT patch or emulate in this public-only helper.
- The pinned upstream `src/tools/improved-process-tools.ts` still renders `output || '(No output in requested range)'`; therefore an actual lone blank line (`lines=['']`) becomes indistinguishable from zero read lines in textual presentation.

## Smallest new code contract

`presentTerminalLinePage(page)` calls existing `normalizeTerminalLinePage(page)` to accept only trusted typed facts. It **never** parses or scrapes CLI response prose, infers the source process version or changes the upstream line array.

Returns frozen `{rawText,displayText,hasOutput,blankOnly,lineCount}`:

- `lines=[]`, `readCount=0` -> `hasOutput=false`; explicit `(No output in requested range)` display label.
- `lines=['']`, `readCount=1` -> `hasOutput=true`, `blankOnly=true`; display `(Blank output: 1 line)`, retaining `rawText=''`.
- `lines=['','']` -> `hasOutput=true`; display `(Blank output: 2 lines)`, `rawText='\\n'` (one newline separator).
- Mixed `lines=['alpha','']` -> display/raw `alpha\\n`, preserving trailing real blank as part of raw content. Multi-line content is unchanged; explicit readCount remains available to consumers.
- Invalid/malicious typed pages still fail closed under the existing validator. A result is only a **presentation fact**, not a raw data or transport repair.

The explicit `displayText` label is intended for human-readable output, while `rawText` is the precise user-output content. Consumers must not use `rawText || 'No output'` to infer whether lines exist. This helper **has no live adapter wiring** and cannot change the four-device problem until a separately authorized integration.

## Verification and gates

- Dedicated PR-only `.github/workflows/dc-p2-terminal-blank-page-v1.yml` runs Node 22 syntax, the existing complete terminal fidelity test suite with five additional tests, and a forbidden process/file/network-I/O invariant.
- Existing general GitHub CI is independent; an offline test PASS does **not** prove a live terminal Agent version, endpoint registration or full P2 UAT.
- Acceptance after tests: pure presentation behavior CODE PASS if focused CI PASS; **P2 LIVE TERMINAL FIDELITY=OPEN/FAIL**, `list_processes` still fails, R2-A real protected legacy Agent-only backup **NO**, R2-B isolated restore **NOT AUTHORIZED**, Agent/OAuth Canary **STOP**.
- Draft PR only; separate exact-head Owner approval required before merge. No deployment, private file read, release, Agent process manipulation or READY restart.
