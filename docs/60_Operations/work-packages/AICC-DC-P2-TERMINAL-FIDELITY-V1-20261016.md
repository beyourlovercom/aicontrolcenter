# AICC-DC-P2-TERMINAL-FIDELITY-V1-20261016 — isolated candidate

Status: `OFFLINE CANDIDATE / NOT UAT PASS`

Authority base: `afd646c3fcf2d4b79fba5c91e79ef8a3942f9b93`

Scope: exactly three new files on the isolated P2 Terminal branch. This work is CODEX ONLY, pure, opt-in, and has no process, filesystem, network, device, Agent, OAuth, key, Cloudflare, service, or production I/O. No commit or push is authorized.

## Upstream evidence boundary

The candidate follows the public Desktop Commander source evidence supplied for review:

- `wonderwhy-er/DesktopCommanderMCP/src/terminal-manager.ts`: `completedSession` has `exitCode: number | null` and `signal: NodeJS.Signals | null`; `readOutputPaginated` carries `result.signal`; `readFromLineBuffer()` removes only a phantom empty trailing line after a newline at lines 645–648. The local validator therefore preserves every supplied line, including intentional empty lines, and documents phantom-sentinel removal as an upstream responsibility.
- `wonderwhy-er/DesktopCommanderMCP/src/tools/improved-process-tools.ts:428-429`: exit signal is formatted when `exitCode === null`; otherwise the exit code is formatted. The candidate represents a null-code signal termination and a completed null-code/null-signal `unknown` state without inventing success or a signal.
- `wonderwhy-er/DesktopCommanderMCP/src/tools/schemas.ts:27-42`: the typed process surface includes `start_process` command/timeout_ms/shell and `read_process_output` pid/timeout_ms/offset/length. This candidate does not call those tools or infer absent page facts.

The supplied live Windows observation showed Unicode replacement characters under the default PowerShell path and restored Chinese in an isolated per-process test after assigning `[Console]::OutputEncoding` and `$OutputEncoding` to UTF-8. That observation is not a claim about all Windows devices. The helper emits those two assignments only when explicitly opted in for device IDs `windows` or `007windows` and shell exactly `powershell.exe` or `pwsh.exe` (case-insensitive). It never changes a system code page.

## Contract

`normalizeProcessStatus()` accepts a minimal trusted typed projection of upstream `{ state: 'running'|'completed', exitCode: number|null, signal: known NodeJS Signals|null, runtimeMs: number|null }`. Running status requires null code/signal and may have unknown runtime; completed status may have unknown code/signal and requires a numeric runtime when known. It returns `running`, `exited`, `signaled`, or `unknown`, rejects contradictions/malformed/missing data, and never parses stdout/stderr prose, guesses a signal, or synthesizes exit code `0`. Upstream records may carry additional fields; this projection does not claim to accept an unknown raw private-Agent schema.

`normalizeTerminalLinePage()` accepts a typed projection of an upstream `lines` array plus explicit `totalLines`, `readFrom`, `readCount`, `remaining`, `isComplete`, and integer `evictedLines` facts. `isComplete` means the process exited and is independent of unread output. It rejects only impossible geometry: invalid/negative values, a count different from `lines.length`, overrun when a nonzero page is read, remaining output larger than retained available lines, or nonzero reads/remaining when `readFrom` is past `totalLines`. `remaining` need not equal `totalLines-readFrom-readCount` because upstream readable end can differ for an incomplete last line. Eviction is preserved as the upstream count, including at `readFrom: 0`; no boolean is invented. Rendering code must not split lines or drop blank lines.

`optInPowerShellUtf8Command()` constructs data only. Opt-in is off by default. When enabled, it permits only a non-empty single-line command for Windows device IDs `windows` or `007windows` and shells exactly `powershell.exe` or `pwsh.exe`; leading comments/directives, scripts, here-strings, and empty/unsafe commands are rejected. The caller must authorize the complete returned command after construction; the helper never executes code, changes global settings, or mutates a post-policy approval. It preserves the original command suffix verbatim and leaves explicit caller code-page modifications unchanged when opt-in is off.

## Owner boundaries and UAT gate

This is not an integration, deployment, production rollout, live-device test, or Human/Owner UAT PASS. The adjacent chat retains exclusive ownership of OAuth/Core-5/port8797. Do not inspect or edit private Agent/OAuth/key/Cloudflare/runtime/service files, do not access READY devices, and do not execute the constructed command. Real UAT remains separately Owner-gated and requires human evidence.

## Deterministic verification

The new tests cover status variants including unknown runtime, nonzero exit, signal and unknown completion, contradictory/malicious shapes, accessor and Proxy traps mapped to stable terminal errors, plain and null-prototype own-data records, running with zero unread output, completed with unread output, past-end offsets, incomplete-last-line geometry, integer eviction at offset zero, intentional blank tails versus an upstream phantom sentinel, frozen cloned lines, UTF-8 opt-in/off, exact command suffix preservation, inherited/accessor/Proxy option rejection, minimal default-off command input, multiline comment/directive/script/here-string rejection, macOS/shell denial, and no override of explicit code-page text. They contain no stdout parsing and no live content.

Expected local checks, with dependencies already available, are:

```text
node --test scripts/byl-remote-mcp/p2-terminal-fidelity.test.mjs
node --check scripts/byl-remote-mcp/p2-terminal-fidelity.mjs
git diff --check
```

Existing official parity tests may be run only as offline local tests if dependencies are installed; their result cannot establish live Agent or production readiness.
