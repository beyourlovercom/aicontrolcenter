# AI Executor Governance V2 — Global Canonical

Status: `ACTIVE`

Effective date: `2026-09-15`

Scope: account / machine / cross-project executor governance.

## Authority and precedence

GitHub is the canonical source for this governance contract. Project-local rules may add stricter constraints but must not weaken or bypass this contract.

This contract supersedes the expired temporary Claude low-quota routing window dated `2026-08-22` through `2026-08-31`.

Historical or subsystem-specific `Codex-only` contracts remain authoritative only for the exact legacy runtime they describe. They do not make Codex the account-wide implementation default.

## Roles

`GPT_PLUS_WEB`

- architecture, diagnosis, decomposition, Work Package definition;
- provider selection and routing reason;
- exact-result / exact-SHA review;
- escalation, STOP gates, and Owner-gate detection.

`CLAUDE_CODE_US`

- default governed implementation provider for tracked code changes;
- implementation remediation;
- focused regression work that directly proves an implementation;
- default model `claude-sonnet-4-6`, default effort `low`;
- Sonnet 5, non-low effort, and subagents require explicit GPT escalation evidence.

`CODEX_GOVERNED`

- deterministic verification and exact-SHA checks;
- read-only audit / review / analysis when explicitly routed;
- bounded test-only work when GPT determines no tracked implementation mutation is required;
- legacy runtimes that are explicitly frozen as Codex-only.

## Routing contract

Provider selection is a GPT decision carried as structured intent. AICC transports and enforces that intent; AICC must not infer semantic task complexity from free-form task text.

Default routing when GPT has classified the task:

- `IMPLEMENTATION`, `CODE_CHANGE`, `REMEDIATION`, `FOCUSED_REGRESSION`, `OWNER_AUTHORIZED_GIT_DELIVERY` -> `CLAUDE_CODE` unless GPT explicitly records a narrower supported provider reason.
- `READ_ONLY_AUDIT`, `REVIEW`, `ANALYSIS`, exact-SHA verification, deterministic verification, and bounded `TEST_ONLY` -> `CODEX` by default.

The routing goal is reliable completion, not quota consumption. Claude quota being available does not justify sending audit/search/review work to Claude.

## Claude machine enforcement

Canonical US-Mac entrypoint:

`/opt/homebrew/bin/claude -> ~/.aicc-remote/claude-governed`

Every governed Claude implementation launch requires:

- `AICC_WORK_PACKAGE_ID`
- `AICC_PROVIDER_ROUTING_DECISION=CLAUDE_CODE`
- `AICC_EXECUTION_CLASS`
- `AICC_PROVIDER_ROUTING_REASON`

Missing or unsupported routing identity fails closed before model launch.

One active Claude implementation is allowed at a time. One Work Package is bound to one registered Claude session, worktree, and branch identity unless an explicit governance migration is approved.

## Quota telemetry

Claude usage is shared account capacity and is monitored globally, not per project.

Canonical machine evidence:

- dispatch audit: `~/.aicc-remote/CLAUDE_MODEL_DISPATCH_AUDIT.jsonl`
- raw execution usage: `~/.aicc-remote/CLAUDE_USAGE_CYCLE_BUFFER.jsonl`
- latest actually observed quota snapshot: `~/.aicc-remote/CLAUDE_QUOTA_SNAPSHOT.json`

Unknown quota values remain unknown. V2 forbids inventing or estimating missing 5h / 7d percentages as facts.

## Owner gates preserved

Executor routing never grants authority for:

- merge / Ready for Review;
- Production deploy;
- Production data writes or `--apply`;
- destructive database operations;
- credential / secret mutation;
- Human UAT PASS;
- irreversible external actions.

Those remain governed by the existing exact Owner gates.

## Inheritance

Any new project driven through the canonical GPT -> AICC / governed-machine workflow inherits this contract automatically. A project does not need to redefine Claude/Codex roles.

A separate standalone Claude or Codex installation that bypasses the governed machine entrypoint is not compliant and must not be treated as a canonical executor.
