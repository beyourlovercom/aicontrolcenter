# AI Control Center Agent Contract

## Authority

`origin/main` exact SHA and formal governance documents are authoritative.

OpenSpec, Codex sessions, runtime state, dashboards, local workspaces, caches, and agent output are non-authoritative.

No tool, agent, artifact, task checkbox, local session, or application state may authorize its own execution.

## P0 — Self-hosted BYL DC routing (highest priority for remote access)

`AICC_SELF_HOSTED_DC_ROUTING_P0 = REQUIRED` — effective 2026-10-23.

This is the highest-priority **DC connection selection and outage diagnosis** rule for all AICC/GPT remote desktop, terminal, filesystem, browser, GUI and device operations. It does not override Owner gates, canonical GitHub authority, provider governance, security controls or production-write restrictions.

1. **Default and preferred remote execution path:** use the BYL-owned self-hosted OAuth MCP service `https://mcp.beyourlover.com`, selecting the ChatGPT connection named **`正式 OAuth MCP`**. Select the actual service/connector, not an account nickname or whichever similarly named tool appears first. Do not default to the separate official `Remote Desktop Commander` cloud connector at `mcp.desktopcommander.app`.
2. **Official quota is not self-hosted quota:** `remote_calls_left_pct`, official monthly call allowances, payment plans, or exhausted official cloud usage apply to the official connector only. Never attribute an official quota/error to the self-hosted service without direct self-hosted evidence. Device online/READY state and remote tool executability are separate observations.
3. **Verify the intended path first:** when remote execution is requested, query the self-hosted device inventory, identify the target device, and use the least-invasive relevant read-only tool/hostname self-test when connectivity is in doubt. Record the exact endpoint/connection and observed error before declaring self-hosted DC unavailable. Do not treat an official-connector result as a self-hosted result.
4. **Failure isolation:** troubleshoot the self-hosted OAuth connection, credential/session expiry, gateway/routing, device heartbeat, tool allowlist and permissions, network reachability, and actual tool result in that order as appropriate. Do not silently fall back to an official quota-bound connector, suggest paying for official DC, or block unrelated GitHub-only work because the official connector is exhausted. Escalate a confirmed self-hosted blocker with evidence.
5. **Preserve READY devices:** no restart, reinstall, disconnect/reconnect, replacement of sessions, Chrome profile/browser restart, or changes to an already-READY agent merely to recheck status or work around official quota. Any genuinely necessary disruptive recovery requires explicit Owner authorization and a specific diagnosis.
6. **Scope and controls remain binding:** all commands/writes require applicable Work Package authorization, least privilege, exact-target confirmation, secrets hygiene, GitHub source-of-truth rules and existing UAT/merge/deploy/financial gates. Self-hosted connectivity is transport capability, not permission for an action.

## Global Executor Governance V2

Canonical contract: `docs/00_Governance/AI-EXECUTOR-GOVERNANCE-V2.md`.

`AI_EXECUTOR_GOVERNANCE_V2 = REQUIRED`

- GPT owns task classification, provider routing, decomposition, review, escalation, and STOP gates.
- Governed US Claude is the default provider for tracked implementation/code-change/remediation/focused implementation regression.
- Governed Codex is the default provider for deterministic verification, exact-SHA checks, read-only audit/review/analysis, and bounded test-only work.
- AICC may transport explicit provider intent but must not infer provider choice from free-form task text.
- Project rules may tighten this contract but may not weaken or bypass it.
- Historical or subsystem-specific `Codex-only` runtime contracts remain scoped to those exact runtimes and do not override the global provider policy.


## Global Fast Iteration V1

Canonical contract: `docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md`.

`AICC_GLOBAL_FAST_ITERATION_V1 = REQUIRED` for governed AICC work **only after** Owner-approved merge to canonical GitHub main and verified runtime context adoption.

- GPT distinguishes small, low-risk, reversible changes from material/high-risk changes; AICC does not auto-classify intent or grant authority.
- For eligible work, reuse accepted results, prepare the smallest Dev-only ZIP or isolated preview, run proportional focused checks, obtain real Owner Dev UAT, then fix / tweak / change approach / prepare integration according to the observed outcome.
- Keep approved design baselines, native functional requirements and site-specific Dev safety. Major UI changes continue to require Global UI Preview First.
- Successful Dev Owner PASS does not itself permit main merge, Stable release, WWW deploy or real financial/order/customer/database/email writes. Follow exact-head Owner gates.
- Do not leave a disposable proof-of-concept plugin as a third permanent production plugin; consolidate accepted changes into their intended canonical module.
- Runtime context inheritance must be demonstrated by exact-SHA canonical policy read and evidence; a GitHub reference alone does not make all standalone chats or devices compliant.

## Global UI Preview First V1

Canonical contract: `docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md`.

`AICC_GLOBAL_UI_PREVIEW_FIRST_V1 = REQUIRED` for governed GPT → AICC UI work after the policy is merged to canonical GitHub main.

- GPT classifies whether a task materially changes UI, navigation, layouts or interactions; AICC does not infer task semantics.
- Before new implementation of a material UI design, prefer a directly interactive in-chat HTML/CSS/JavaScript prototype (ChatGPT AppBlock when available); present real limitations and clearly label mock data.
- Require explicit Owner Visual UAT PASS for the scoped design unless Owner explicitly waives preview or approves an existing design baseline.
- Narrow bug fixes, pure backend/infrastructure work and urgent remediation may skip preview with a recorded GPT reason.
- Visual PASS is not functional UAT, GitHub merge approval, Production deployment authorization, or business data write authority.
- AICC V4 must read the policy at an exact canonical GitHub main SHA and include it in project-independent Copy GPT Context output; fail closed if missing, never mutate Bridge request/Result content to insert it.
- Project-specific rules can tighten but not silently bypass this cross-project default.

- Arbitrary shell strings from the application UI or runtime.
- OpenSpec Sync.
- Self-authorization or automatic authorization.
- Automatically starting, applying, or executing the next Work Package.
- Silently selecting one of multiple authorized Work Packages.
- Parallel writers.
- Force push.
- `git reset --hard`.
- `git clean`.
- Automatic conflict resolution.
- Automatic rebase.
- Production deployment, destructive database operations, secrets mutation, security architecture changes, and irreversible external writes without a separate Owner Gate.
- Treating unavailable or unknown Authority as verified.

## Governed development automation

Repository development automation may create commits, push a feature branch, and create or update a Draft PR only when all of the following are true:

- the Owner explicitly authorized the named Work Package;
- the branch and Authority SHA are fixed;
- the changes remain inside the authorized scope;
- no force operation is used;
- Ready for Review and Merge remain separate Owner Gates unless a named Work Package explicitly authorizes normal-risk autonomous delivery through exact-head CI and squash merge.

AICC-CONTROL-LOOP-001A already has this whole-Work-Package authorization.

## Governed repository commands

AICC-CONTROL-LOOP-001A may implement only fixed typed repository commands.

Authority Check:

- may execute `git ls-remote origin refs/heads/main`;
- must not fetch or mutate local refs;
- must fail closed.

Owner-triggered Workspace Sync:

- may execute only `git fetch origin main`, `git switch main`, and `git merge --ff-only origin/main`;
- requires clean worktree and all execution guards to pass;
- requires explicit Owner action and confirmation;
- must revalidate immediately before execution;
- must not reset, clean, rebase, force, resolve conflicts, push, or merge a PR.

## Work Package Resolver And Codex Runtime

The resolver may calculate and display `START_ALLOWED` or one or more explicit blocker codes.

The resolver must not:

- authorize a Work Package;
- modify its status;
- run OpenSpec Apply without the named Work Package capability;
- start Codex without a matching persisted Owner authorization;
- acquire a real Writer Lock;
- execute implementation.

The governed Codex runtime may expose only typed operations. It must bind Owner authorization to the Work Package ID, Authority SHA, branch, worktree, scope, allowed capabilities, forbidden capabilities, and timestamp. It must never accept arbitrary shell input from the Owner UI.

## Current implementation phase

Current milestone: `M2 — Authority And Workspace Control`

Current Work Package: `AICC-CODEX-ONLY-MIGRATION-001`

Authority base: `fcd41386fafd6ee2083e73cdee71bee68a3a1e09`

This Work Package may introduce:

- Codex-only roadmap and application architecture;
- persisted, evidence-bound Owner authorization;
- typed Codex runtime state and bounded controls;
- Codex CLI execution contracts using the configured `sol` profile;
- independent review, PR, exact-head CI, squash merge, and UAT artifact phases for normal-risk scoped delivery;
- corresponding Chinese-first Owner UI and tests.

This Work Package must not introduce:

- arbitrary command execution;
- OpenSpec Sync;
- automatic Work Package authorization;
- production deployment, destructive database operations, secrets mutation, security architecture changes, or irreversible external writes;
- Human UAT PASS without human evidence.
