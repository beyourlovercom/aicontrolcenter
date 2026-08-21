# AI Control Center Agent Contract

## Authority

`origin/main` exact SHA and formal governance documents are authoritative.

OpenSpec, Codex sessions, runtime state, dashboards, local workspaces, caches, and agent output are non-authoritative.

No tool, agent, artifact, task checkbox, local session, or application state may authorize its own execution.

## GitHub-Reviewed Development Loop Authority

`AICC_GITHUB_REVIEW_LOOP_V1 = FROZEN`

`CODE_IMPLEMENTATION_EXECUTOR = OWNER_ASSIGNED_EXECUTOR`
`SUPPORTED_IMPLEMENTATION_EXECUTORS = CODEX | CLAUDE`
`ACTIVE_IMPLEMENTATION_EXECUTOR_PER_WORKTREE = ONE`
`CONCURRENT_SAME_WORKTREE_IMPLEMENTATION_EXECUTORS = FORBIDDEN`
`CODE_REVIEW_SOURCE = GITHUB`
`GPT_CODE_REVIEW_AUTHORITY = GITHUB_COMMIT`
`NEXT_STEP_PLANNING_AUTHORITY = GPT`
`OWNER_UAT_AUTHORITY = OWNER`

`UNPUSHED_CODE_REVIEWABLE = NO`
`CODEX_SELF_ADVANCE = NO`
`CODEX_ARCHITECTURE_SELF_APPROVAL = NO`

Standard loop:

`GPT instruction`
→ `AICC`
→ `Owner-assigned Implementation Executor`
→ `machine validation`
→ `git commit`
→ `git push`
→ `GPT reviews exact GitHub commit`
→ `GPT issues next implementation / remediation / Owner UAT`

Implementation Executor responsibilities are limited to:

`IMPLEMENT`
`TEST`
`COMMIT`
`PUSH`

Implementation Executor must not:

- approve its own architecture;
- enter the next Phase automatically based on its own PASS;
- execute a remediation loop continuously on its own;
- treat unpushed code as GPT-reviewed code;
- repeat the same implementation after `CODE_MODIFIED=NO` and `BLOCKER!=NONE`.

Every code review must bind:

`repository`
`branch`
`exact BASE_SHA`
`exact COMMIT_SHA`

A Work Package uses one continuous development branch by default.

`FAILED_IMPLEMENTATION_WITH_CODE_CHANGES = CHECKPOINT_COMMIT_REQUIRED`
`FAILED_CHECKPOINT_IS_IMPLEMENTATION_PASS = NO`
`FAILED_CHECKPOINT_PURPOSE = GPT_GITHUB_REVIEW`
`CODEX_REMEDIATION_BEFORE_GPT_REVIEW = FORBIDDEN`
`IMPLEMENTATION_EXECUTOR_REMEDIATION_BEFORE_GPT_REVIEW = FORBIDDEN`

`ONE_ACTIVE_IMPLEMENTATION_EXECUTOR_PER_WORKTREE = TRUE`
`CODEX_AND_CLAUDE_SAME_WORKTREE_CONCURRENT_EDIT = FORBIDDEN`
`EXECUTOR_HANDOFF_REQUIRES_GITHUB_REVIEWED_SHA = TRUE`
`EXECUTOR_HANDOFF_REQUIRES_CLEAN_WORKTREE = TRUE`

Executor handoff must fetch or pull the exact reviewed branch state, check out
the exact reviewed commit or branch, and verify a clean worktree. Uncommitted
workspace handoff by rsync is forbidden.

`EXECUTOR_MACHINE_LOCAL_RUNTIME_STATE = NON_AUTHORITATIVE`

`~/.aicc-v2`, `node_modules`, `.env*`, and runtime PID/PTY/session state must
not be synchronized between executor machines. GitHub commits are the
cross-machine code handoff authority.

If `CODE_MODIFIED = NO` and `BLOCKER != NONE`, stop without creating a meaningless commit and hand the result to GPT review.

GitHub is code-review truth, not runtime truth:

`CODE_REVIEW_TRUTH = GITHUB`
`RUNTIME_TRUTH = ACTUAL_RUNTIME`
`CODEX_CWD_TRUTH = ACTUAL_PROCESS_RUNTIME`
`REMOTE_CLAUDE_TRUTH = REMOTE_RUNNER_RUNTIME`
`REAL_BROWSER_UAT = REAL_BROWSER_EVIDENCE / OWNER`

Git safety:

`FORCE_PUSH = FORBIDDEN`
`MAIN_DIRECT_WRITE = FORBIDDEN`
`AUTOMATIC_REBASE = FORBIDDEN`
`AUTOMATIC_RESET = FORBIDDEN`
`AUTOMATIC_CLEAN = FORBIDDEN`

PR creation and merge require explicit authorization.

## GPT ↔ Claude Iterative Execution Authority

`AICC_GPT_CLAUDE_ITERATIVE_EXECUTION_V1 = FROZEN`
`GPT_CLAUDE_ITERATIVE_MODE = REQUIRED`

This profile applies whenever Claude is the Owner-assigned Implementation
Executor unless the Owner explicitly overrides it for a named task. GPT owns
analysis and control; Claude is the implementation executor. Quota optimization
must never transfer analysis authority to Claude.

### Hard rules

`GPT_ANALYSIS_AUTHORITY = GPT`
`GPT_DIAGNOSIS_AUTHORITY = GPT`
`GPT_DECOMPOSITION_AUTHORITY = GPT`
`GPT_CODE_REVIEW_AUTHORITY = GITHUB_EXACT_SHA`
`CLAUDE_EXECUTION_ROLE = IMPLEMENTATION_ONLY`
`CLAUDE_SELF_ADVANCE = FORBIDDEN`
`CLAUDE_AUTONOMOUS_REMEDIATION = FORBIDDEN`
`CLAUDE_BROAD_CODEBASE_EXPLORATION = FORBIDDEN_BY_DEFAULT`
`CLAUDE_SUBAGENTS = FORBIDDEN_BY_DEFAULT`
`FULL_TEST_LOG_IN_CONTEXT = FORBIDDEN_BY_DEFAULT`
`GITHUB_EXACT_SHA_REVIEW_BETWEEN_LOGICAL_CLOSURES = REQUIRED`

Required loop:

`GPT analyzes exact evidence`
→ `GPT selects Claude model and gives a concrete implementation instruction`
→ `Claude implements and validates only that instruction`
→ `Claude commits/pushes or returns blocker/checkpoint`
→ `GPT reads the result and exact GitHub commit`
→ `GPT analyzes, decomposes, and issues the next instruction`
→ repeat until Owner UAT or completion.

Claude may perform only local reasoning necessary to execute the supplied
instruction. Ambiguity, unexpected structure, new dependency, or material scope
expansion must return to GPT with exact evidence instead of triggering Claude-led
forensics, architecture redesign, or self-generated remediation.

### Soft targets

These are optimization targets, not correctness gates:

`PROMPT_TARGET = AS_SHORT_AS_PRACTICAL_BUT_COMPLETENESS_FIRST`
`RUNTIME_TARGET = USUALLY_5_TO_20_MINUTES`
`FILE_COUNT_LIMIT = NONE`
`ONE_EXECUTION_LOGICAL_CONCERN = ONE`
`GPT_REVIEWED_NEXT_TASK_FRESH_SESSION = DEFAULT`
`SAME_EXACT_REMEDIATION_SESSION_RESUME = ALLOWED_BY_GPT`
`BUDGET = MONITORING_SIGNAL_NOT_HARD_CUTOFF`

Do not split a coherent fix merely to satisfy a line, time, or file-count target.
Prompt completeness and one independently reviewable logical concern take
priority. Unexpectedly high turns, context growth, cache reads, subagent use, or
scope growth are signals to stop and return evidence to GPT.

### Highest Claude model-routing rule

`CLAUDE_MODEL_ASSIGNMENT_AUTHORITY = GPT_PLUS_WEB`
`CLAUDE_SELF_SELECT_MODEL = FORBIDDEN`
`CLAUDE_MODEL_ROUTING_PRECEDENCE = HIGHEST_CLAUDE_DISPATCH_RULE`
`CLAUDE_MODEL_ROUTING_REMOTE_MIRROR = /Users/a/.aicc-remote/CLAUDE_MODEL_ROUTING_V1.md`
`SELECT_LOWEST_TIER_ADEQUATE_FOR_RELIABLE_COMPLETION = REQUIRED`

GPT Plus Web must classify every Claude dispatch before launch:

- Tier 1 — Haiku 4.5 (`claude-haiku-4-5`): pure audit, grep/search,
  classification, simple fixture work, mechanical edits, repetitive
  low-complexity changes.
- Tier 2 — Sonnet 4.6 (`claude-sonnet-4-6`): ordinary implementation,
  clear-plan implementation, medium-complexity changes.
- Tier 3 — Sonnet 5 (`claude-sonnet-5`): complex architecture implementation,
  difficult remediation, cross-module migration, hard-to-localize failures.

Cost saving alone must not downgrade below the capability GPT judges necessary.
Claude cannot promote or demote itself. A failed lower-tier implementation
returns to GPT; only GPT may select a different tier for the next execution.

### Thinking policy

`CLAUDE_THINKING_DEFAULT = DISABLED`
`CLAUDE_THINKING_EXCEPTION_AUTHORITY = GPT_PLUS_WEB`
`CLAUDE_SELF_ENABLE_THINKING = FORBIDDEN`
`THINKING_EXCEPTION_SCOPE = ONE_NAMED_EXECUTION`
`SILENT_THINKING_MODE_CHANGE = FORBIDDEN`
`THINKING_POLICY_VERIFICATION = REQUIRED`

Normal Claude dispatches must set `CLAUDE_CODE_DISABLE_THINKING=1`. GPT may
explicitly authorize thinking for one named execution when the returned evidence
shows that deeper local reasoning is justified, including repeated failure on
the same logical concern, difficult remediation, or a hard-to-localize failure.
That exception does not persist to the next execution.

For a GPT-authorized thinking execution, the launcher must deliberately omit or
disable the no-thinking environment control and report `THINKING=ENABLED` in
the dispatch. Runtime telemetry must be reported when available. Claude may not
enable thinking by itself, silently keep it enabled, or use thinking as authority
to self-remediate or self-advance.

Effort is separate from thinking. Current dispatch defaults are:

- Haiku 4.5: omit unsupported effort override;
- Sonnet 4.6: `low`;
- Sonnet 5: `medium` by default for complex implementation.

GPT may change effort and may authorize thinking before a named execution. After
that execution, thinking returns to disabled-by-default unless GPT explicitly
authorizes another exception.

### Repeated-failure escalation and Owner gate

`SAME_LOGICAL_CONCERN_FAILURE_TRACKING = REQUIRED`
`THINKING_ESCALATION_ON_REPEATED_FAILURE = GPT_DISCRETION`
`OWNER_REVIEW_GATE_AFTER_FAILURE_COUNT = 3`
`FOURTH_ATTEMPT_BEFORE_OWNER_REVIEW = FORBIDDEN`
`FAILURE_COUNTER_RENAME_BYPASS = FORBIDDEN`

GPT must track consecutive substantive failures for the same logical concern.
After any failed Claude execution, control returns to GPT for exact evidence
review. GPT may keep thinking disabled, enable thinking for the next named run,
change model tier, change effort, or narrow/reframe the implementation based on
the evidence. None of these escalations may be performed autonomously by Claude.

When the same logical concern reaches three substantive failed implementation or
remediation attempts, stop before a fourth attempt and notify the Owner for
manual review. The Owner gate must include the three failure summaries, exact
GitHub SHAs/checkpoints when present, current blocker, selected models/thinking
modes, and GPT's recommended options.

Count task-relevant implementation/review/test failures and recurring blockers.
Do not increment this logical-failure counter for infrastructure-only events such
as HTTP 429/session quota, network/transport failure, remote tool outage, or an
unrelated known baseline failure. The counter resets only after GPT exact-SHA
review passes the logical concern or GPT explicitly determines that a genuinely
different logical concern has begun.

### Quota-conscious execution

- inspect named targets first;
- prefer targeted `Read`/`Grep`/`Glob` over unrelated broad scans;
- do not spawn Explore/Agent/subagents unless GPT explicitly requests them;
- redirect long test/build output to machine-local logs;
- return concise PASS summaries or bounded failure evidence;
- do not increase model, effort, scope, or subagent allowance without explicit
  GPT/Owner instruction.

`FAILED_LOG_FIRST_READ = BOUNDED_TAIL_OR_MATCH`
`QUOTA_OPTIMIZATION_MUST_NOT_MOVE_ANALYSIS_TO_CLAUDE = TRUE`

### Validation and terminal behavior

Required focused tests, TypeScript, build, and `git diff --check` remain
mandatory when applicable. One implementation attempt produces at most one
terminal implementation/checkpoint commit before returning control to GPT.

`IMPLEMENT -> FOCUSED_TEST -> TYPESCRIPT -> BUILD -> GIT_DIFF_CHECK -> COMMIT -> PUSH -> STOP`

`CLAUDE_ONE_TERMINAL_COMMIT_PER_EXECUTION = TRUE`
`CLAUDE_REMEDIATION_BEFORE_GPT_REVIEW = FORBIDDEN`
`CLAUDE_NEXT_TASK_BEFORE_GPT_REVIEW = FORBIDDEN`

HTTP 429/session-limit must stop the run. Automatic retry, model escalation,
effort escalation, or autonomous continuation is forbidden. If code changed,
preserve it through the governed checkpoint flow and return control to GPT.

`CLAUDE_429_AUTO_RETRY = FORBIDDEN`
`CLAUDE_QUOTA_FAILURE_ESCALATION = FORBIDDEN`
`ITERATIVE_EXECUTION_RELAXES_EXISTING_GOVERNANCE = NO`

## AICC V2 Core Control Loop Authority

Canonical baseline: `docs/00_Governance/AICC_V2_CORE_CONTROL_LOOP.md`

All V2 Codex and Agent execution must preserve:

- `ONE_WP_ONE_GPT_CONVERSATION = TRUE`
- `CODEX_DEFAULT_EXECUTOR = LUNA`
- `NO_PLANNER_CLI_PER_TASK = TRUE`
- `NO_AUTOMATIC_SOL_LUNA_PLANNER_SWITCHING = TRUE`
- `AICC_DECISION_AUTHORITY = 0`

The canonical baseline wins over conflicting current or historical runtime
wording unless explicitly changed by Owner.

## Zero Output Decision Authority

`AICC_ZERO_OUTPUT_DECISION_AUTHORITY_V1 = FROZEN`

`AICC_INPUT_DECISION_AUTHORITY = 0`
`AICC_OUTPUT_DECISION_AUTHORITY = 0`
`AICC_DECISION_AUTHORITY = 0`
`CODEX_RESULT_AUTHORITY = CODEX`
`CANONICAL_RESULT_SOURCE = EXACT_CODEX_RESULT_PAYLOAD`
`IF_CODEX_RESULT_ABSENT = NOT_AVAILABLE`
`RUNTIME_FACTS_TO_SEMANTIC_STATUS_INFERENCE = FORBIDDEN`
`CANONICAL_RESULT_GATED_BY_AICC_RUN_STATUS = FORBIDDEN`

AICC may bind, persist, display, and relay exact Codex result payloads, but
must not parse them into semantic outcomes, rewrite them, or suppress them
because of Run state, process exit, exit code, timeout, or close observation.
Runtime facts remain technical evidence only.

## Canonical Task Interaction Authority

Canonical baseline: `docs/00_Governance/AICC_CANONICAL_TASK_INTERACTION_CONTRACT.md`

Mandatory hierarchy: Task data → canonical `task_id` → Shared Task Title
Primitive → Global Task Selection Authority → Existing Selected Task Detail
Inspector.

Any current or future UI surface representing a resolvable canonical Task as
an inspectable identity must use the shared trigger authority. Page-specific
Task Detail implementations, competing selection authorities, duplicate
Inspectors, inert inspectable canonical Task titles, and fabricated identity
from unknown, unmapped, or arbitrary text are forbidden.

`NEW_TASK_SURFACE_REUSES_SHARED_TASK_TRIGGER = TRUE`

## Unified Canonical Task Feed Authority

Canonical baseline: `docs/00_Governance/AICC_UNIFIED_CANONICAL_TASK_FEED_UI_CONTRACT.md`

Mandatory invariants:

- `ONE_CANONICAL_TASK_FEED_PER_WORKSPACE = TRUE`
- `TASK_SOURCE_IS_METADATA_NOT_NAVIGATION = TRUE`
- `TASK_SOURCE_MUST_NOT_CREATE_SEPARATE_TASK_LIST = TRUE`
- `NEW_TASK_COLLECTION_REUSES_CANONICAL_TASK_FEED = TRUE`

## Top-Level UI Interaction Authority

Before changing AICC Roadmap, left navigation, Current Context, selection,
locking, locating, fold behavior, progress, status, hierarchy, or entity
projection, read and comply with the frozen canonical baseline:
`docs/00_Governance/AICC-V2-UI-INTERACTION-STANDARD-001.md`.

This requirement also applies before changing manual Roadmap sync, revision or
hash source selection, Roadmap projection rebuild/swap, or Roadmap UI
performance behavior. The canonical standard is the only authority for these
surfaces; do not duplicate or silently override it.

Affected UI must not silently override this baseline; material changes require
Owner approval and canonical baseline change control.

## Permanent denials

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

## AICC Global Short Feedback Rule V1

`AICC_GLOBAL_SHORT_FEEDBACK_RULE_V1`

- `GLOBAL_COMMAND_INPUT = GLOBAL_COMPOSER`
- `GLOBAL_SHORT_FEEDBACK_SURFACE = GLOBAL_FEEDBACK_ISLAND`
- `SHORT_ACTION_FEEDBACK = GLOBAL_FEEDBACK_ISLAND`
- `SHORT_OPERATIONAL_STATUS = GLOBAL_FEEDBACK_ISLAND`
- `GLOBAL_FEEDBACK_RENDERER_COUNT = 1`
- `GLOBAL_FEEDBACK_ISLAND_CLICK = COPY_FULL_FEEDBACK_TEXT`
- `FEEDBACK_COPY_SOURCE = CANONICAL_FEEDBACK_STATE`
- `VISUAL_TRUNCATION_AFFECTS_COPY = NO`
- `COPY_SUCCESS_FEEDBACK = GLOBAL_FEEDBACK_ISLAND`
- `COPY_SUCCESS_COPYABLE = NO`
- `COPY_SUCCESS_IS_TRANSIENT_OVERLAY = YES`
- `ACTIVE_RUNNING_FEEDBACK_AFTER_COPY = RESTORE`
- `MODULE_LOCAL_TOAST = FORBIDDEN`
- `MODULE_LOCAL_SNACKBAR = FORBIDDEN`
- `MODULE_LOCAL_SHORT_NOTICE = FORBIDDEN`
- `CANONICAL_DETAILED_OUTPUT = WORKSPACE / RUNTIME / EVIDENCE`
- `EXPLICIT_BUTTON_ACTION_FEEDBACK = REQUIRED`
- `SIDE_EFFECT_ACTION_FEEDBACK = REQUIRED`
- `ASYNC_ACTION_FEEDBACK = REQUIRED`
- `FAILABLE_ACTION_FEEDBACK = REQUIRED`
- `ROW_SELECTION_FEEDBACK = OPTIONAL`
- `TAB_SWITCH_FEEDBACK = OPTIONAL`
- `PASSIVE_HOVER_FEEDBACK = NO`
- `COLLAPSE_EXPAND_BUTTON_FEEDBACK = REQUIRED`

Any short, immediate, human-readable action feedback or operational status
that does not require a persistent dedicated workspace surface must use the
Global Feedback Island. Do not create local notification UI in any module.

Every explicit user-triggered visible button or control whose completed result
has a short human-readable message must publish through Global Feedback
Island. This includes collapse and expand controls; passive responsive layout
changes do not publish feedback. Ordinary row selection, tab switching, and
passive hover feedback remain optional or disallowed as specified above.

Classification is fixed: `SHORT + TRANSIENT + HUMAN FEEDBACK` and `SHORT +
CURRENT OPERATIONAL STATUS` go to `GLOBAL_FEEDBACK_ISLAND`; `DETAILED +
PERSISTENT + EVIDENCE-BEARING` remains in `WORKSPACE / RUNTIME / EVIDENCE`.

Before implementing a short notification or status UI in Blueprint, WP, PR,
Task, Runtime, Composer, or any future AICC module: determine whether it is
short and transient; if so, publish it to Global Feedback Island. Retain or
create a dedicated surface only when content is persistent, detailed,
interactive, or evidence-bearing. The Feedback Island is presentation only;
lifecycle authority remains the existing canonical lifecycle resolver.

Clicking a copyable Global Feedback Island copies the complete human-readable
feedback from canonical feedback state, not DOM text, ellipsis-rendered text,
or any visually truncated representation. The copy payload is the primary
message plus an optional newline and secondary message, with intentional
human-readable metadata only when it is part of the canonical feedback.

Copy success is a temporary, non-copyable Global Feedback Island overlay with
primary `复制成功` and secondary `完整提醒内容已复制到剪贴板`. It must not create a
copy-success loop. When it overlays persistent active feedback such as
`RUNNING` or `SUBMITTING`, restore the exact prior feedback and run binding
after the temporary confirmation; modules must not implement their own
feedback-copy UI.

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

## Permanent feedback correlation rules

`EXECUTION_COMPLETED != FEEDBACK_DELIVERED != CONTROL_LOOP_COMPLETED`

`CONTROL_LOOP_CONTINUATION REQUIRES EXACT FEEDBACK TURN CORRELATION`

`AUTO_LOOP_SILENT_PAUSE = FORBIDDEN`

`OWNER_UAT_GATE REQUIRES ACTUAL AICC_OWNER_UAT_V1 CONTRACT`

## Parallel Bug Governance — AICC_PARALLEL_BUG_GOVERNANCE_V1

This rule is frozen and applies to all AICC development work.

### Core Principle

Mainline development and Bug Backlog operate in parallel.

Discovering a Bug does NOT automatically authorize interruption of the current
Work Package or development objective. Non-critical Bugs must not repeatedly
derail active development.

### Severity

Use the governed Bug severity model:

- `P0` — production down, data loss, secret exposure, or equivalent
  catastrophic technical failure.
- `P1` — major workflow blocked.
- `P2` — important defect with a viable workaround or which does not block the
  current authorized scope.
- `P3` — minor defect, visual defect, cleanup, polish, or low-impact
  regression.

### Interruption Policy

`P0`:

- immediately report;
- interrupt the current mainline;
- remediation takes priority.

`P1`:

- immediately report;
- if it blocks the current authorized Work Package, UAT, or required execution
  path, interrupt and remediate;
- if it does not block the current scope, record it and continue unless Owner
  explicitly reprioritizes it.

`P2`:

- record in Deferred Bug Backlog;
- do not interrupt current development;
- do not proactively expand discussion;
- do not fix opportunistically.

`P3`:

- record in Deferred Bug Backlog;
- continue current development;
- do not interrupt;
- defer to final project Bug Sweep unless Owner explicitly promotes it.

### No Opportunistic Fixes

Unrelated opportunistic Bug fixes are forbidden. A Codex run, agent, or
implementation task must not broaden its scope because it notices an unrelated
defect.

Unless severity is explicitly `P0`, or explicitly `P1` and blocks the current
authorized scope, the required behavior is:

`LOG_BUG = YES`
`FIX_NOW = NO`
`CONTINUE_CURRENT_WORK = YES`

### Deferred Bug Backlog

Every deferred Bug must remain recoverable for later review. Minimum record:

- BUG_ID
- TITLE
- SEVERITY
- STATUS
- DISCOVERED_AT
- DISCOVERED_BY
- AFFECTED_MODULE
- ENVIRONMENT
- COMMIT_SHA when available
- EXPECTED
- ACTUAL
- REPRODUCTION when available
- EVIDENCE
- BLOCKS_CURRENT_SCOPE
- DEFERRED_REASON
- TARGET_REMEDIATION_PHASE when known

Bug lifecycle:

`Reported` → `Triage` → `Accepted` → `Fixed` → `Verified` → `Closed`

### Final Bug Sweep

Before final project closure, retrieve all unresolved P2/P3 Bugs; review them
individually; repair, explicitly accept, reclassify, or close each one; and do
not silently discard deferred Bugs.

`FINAL_PROJECT_BUG_SWEEP = REQUIRED`

### Authority Boundary

AICC decision authority remains zero.

`AICC_DECISION_AUTHORITY = 0`

AICC itself must NOT semantically decide whether an observation is a Bug, Bug
severity, whether a Bug is P0/P1/P2/P3, or whether a Bug should override Owner
priorities. Severity and judgment authority belongs to explicit Owner direction,
GPT control instruction, or Codex result when that task explicitly has
diagnosis/triage authority.

Once severity and routing are explicitly provided, AICC may mechanically
persist and project them.

`BUG_DISCOVERY_DOES_NOT_INTERRUPT_MAINLINE = TRUE`
`P0 = IMMEDIATE_INTERRUPT`
`P1_BLOCKING_CURRENT_SCOPE = INTERRUPT`
`P1_NON_BLOCKING = LOG_AND_CONTINUE`
`P2 = LOG_AND_DEFER`
`P3 = LOG_AND_DEFER`

`P2_P3_NORMAL_DEVELOPMENT_INTERRUPTION = FORBIDDEN`
`UNRELATED_OPPORTUNISTIC_FIX = FORBIDDEN`

`DEFERRED_BUG_BACKLOG = REQUIRED`
`FINAL_PROJECT_BUG_SWEEP = REQUIRED`

`AICC_SEVERITY_JUDGMENT = NO`
`AICC_DECISION_AUTHORITY = 0`

### Canonical Bug Registry

`CANONICAL_BUG_REGISTRY = docs/80_Bug_Record/01_bug_record.md`

- All deferred AICC Bugs must be recorded there.
- Do not maintain competing Bug lists as authority.
- New evidence for an existing Bug updates the existing record.
- P2/P3 Bug recording must not interrupt the current Work Package.
- Untriaged non-blocking defects may be recorded as `UNTRIAGED`.
- Final Project Bug Sweep must use this registry as its source.
- Closing a Bug requires explicit Fixed → Verified → Closed evidence.
- Never silently delete historical Bug records.

## GPT Bug Capture Bridge — AICC_GPT_BUG_CAPTURE_BRIDGE_V1

`GPT_BUG_CAPTURE_PROTOCOL = AICC_BUG_CAPTURE_V1`

`GPT_BUG_CAPTURE_REGISTRY = docs/80_Bug_Record/01_bug_record.md`

- GPT → AICC → Registry capture requires a complete explicit `AICC_BUG_CAPTURE_V1` protocol block; ordinary chat prose is never classified as a Bug.
- AICC persists `CAPTURE_ID + SOURCE_CONVERSATION + SOURCE_MESSAGE` and reconciles it exactly once before Registry mutation.
- AICC performs no semantic Bug classification, severity judgment, blocking judgment, or remediation judgment.
- A capture may create, update, or return `NEEDS_TRIAGE`; duplicate protection must preserve evidence and never silently create a second Bug record.
- Bug capture does not authorize an automatic Task, Work Package, Codex remediation, test change, or other fix.
- If the GPT conversation is not connected through a working AICC Bridge, report `NOT_CONNECTED`; never claim the Registry was written without an AICC capture result.

## GPT GitHub Bug Registry — AICC_GPT_GITHUB_BUG_REGISTRY_V1

Status: FROZEN

Canonical Registry: `docs/80_Bug_Record/01_bug_record.md`

- GPT may directly persist confirmed Bug records to the canonical GitHub Registry; Local Codex is not required solely for Bug recording.
- Direct GPT GitHub writes are limited to Bug Registry governance and bookkeeping; Bug recording does not authorize remediation, application-code changes, or test-code changes.
- Before every GitHub Registry write, read the latest remote file and blob SHA. Never overwrite a newer remote Registry version.
- Reconcile existing Bug IDs before allocating a new ID. Never renumber or silently delete historical Bug records.
- The same underlying defect updates its existing record and appends evidence. If identity is uncertain, do not force a duplicate match.
- AICC does not decide severity; GPT must use `UNTRIAGED` when governed severity is not established.
- Non-blocking Bug recording must not interrupt active mainline work.

`AICC_GPT_GITHUB_BUG_REGISTRY_V1 = FROZEN`
`GPT_CHAT_DIRECT_GITHUB_WRITE = YES`
`LOCAL_CODEX_REQUIRED_FOR_BUG_RECORDING = NO`

`CANONICAL_BUG_REGISTRY = docs/80_Bug_Record/01_bug_record.md`

`BUG_RECORDING_ONLY = YES`
`BUG_RECORDING_AUTHORIZES_FIX = NO`

`AICC_SEVERITY_JUDGMENT = NO`
`AICC_DECISION_AUTHORITY = 0`

## Bug Registry Enforcement — AICC_BUG_REGISTRY_ENFORCEMENT_V1

`AICC_BUG_REGISTRY_ENFORCEMENT_V1 = FROZEN`

This is the mandatory execution layer for
`AICC_PARALLEL_BUG_GOVERNANCE_V1` and `AICC_CANONICAL_BUG_REGISTRY_V1`.
Repository governance is authoritative for this behavior; chat or runtime
state is not.

### Every Codex Run Precheck

Every governed AICC Codex development Run must perform the following precheck
on every Run:

`BUG_GOVERNANCE_PRECHECK = REQUIRED`

1. Read the repository `AGENTS.md`.
2. Resolve and read the canonical Bug Registry pointer.
3. Read `docs/80_Bug_Record/01_bug_record.md`.
4. Apply `AICC_PARALLEL_BUG_GOVERNANCE_V1`.
5. Apply `AICC_BUG_REGISTRY_ENFORCEMENT_V1`.

`EVERY_CODEX_RUN_PRECHECK = REQUIRED`
`AGENTS_MD_READ_REQUIRED = PASS`
`CANONICAL_BUG_REGISTRY_READ_REQUIRED = PASS`

The Run must not rely on previous ChatGPT conversation memory, previous Codex
session memory, previous terminal state, or undocumented assumptions.

### During-Run Bug Recording

If a confirmed non-blocking defect is discovered during an authorized Work
Package, do not immediately fix it. First search this canonical registry for
the same underlying defect and determine whether a stable Bug ID already
represents it.

`DURING_EXECUTION_BUG_CAPTURE = REQUIRED`
`SEARCH_EXISTING_BUGS = REQUIRED`

If an existing stable Bug ID represents the underlying defect:

`UPDATE_EXISTING_BUG = YES`
`APPEND_NEW_EVIDENCE = YES`

If the defect is genuinely new, create a record with the next stable
`AICC-BUG-XXX` ID. The same root defect observed in another Task, Run, browser
session, test, commit, or component does not automatically create another Bug
record.

`CREATE_DUPLICATE_BUG = NO`
`DUPLICATE_PROTECTION = PASS`

Bug recording must not broaden the authorized implementation scope:

`LOG_BUG = YES`
`CONTINUE_CURRENT_WORK = YES`
`BUG_RECORDING_AUTHORIZES_FIX = NO`
`UNRELATED_OPPORTUNISTIC_FIX = FORBIDDEN`

For non-blocking P2 and P3 Bugs:

`FIX_NOW = NO`
`INTERRUPT_MAINLINE = NO`

For non-blocking UNTRIAGED defects:

`SEVERITY = UNTRIAGED`
`STATUS = Reported`
`FIX_NOW = NO`
`INTERRUPT_MAINLINE = NO`

The frozen interruption rules remain authoritative: P0 interrupts; a P1
interrupts only when it blocks the current scope; non-blocking P1 is recorded
and continued unless the Owner reprioritizes; P2, P3, and non-blocking
UNTRIAGED defects are recorded and deferred. AICC must not invent severity.

`AICC_SEVERITY_JUDGMENT = NO`
`AICC_DECISION_AUTHORITY = 0`

### End-of-Run Reconciliation

Every governed Codex development Run must complete Bug reconciliation before
reporting final completion:

`BUG_DISCOVERY_RECONCILIATION = REQUIRED`
`END_OF_RUN_BUG_REPORTING = REQUIRED`

If no confirmed Bugs were discovered, the final result must explicitly report:

`NEW_BUGS_RECORDED = 0`
`UPDATED_BUG_RECORDS = 0`

If Bugs were discovered, the final result must explicitly list
`NEW_OR_UPDATED_BUG_RECORDS = <AICC-BUG-XXX, ...>` and report `CREATED` or
`UPDATED` for each listed Bug.

### Authority and Preservation

`CHAT_MEMORY_AS_BUG_GOVERNANCE_AUTHORITY = NO`

The system must remain correct across new or unavailable ChatGPT conversation
history, new Codex sessions, context compaction, and supported model changes.
The persistent authority is this `AGENTS.md` section together with
`docs/80_Bug_Record/01_bug_record.md`.

`PARALLEL_BUG_GOVERNANCE_PRESERVED = PASS`
`CANONICAL_BUG_REGISTRY_PRESERVED = PASS`

## Permanent Roadmap Global State Architecture

Roadmap follows the permanent Layer 1 → Layer 2 → Layer 3 global state
architecture. The canonical Markdown is the sole write authority; the generated
JSON is a local, read-only UI projection and has no Git or write-back authority.

`ROADMAP_CANONICAL_SOURCE = docs/10_Planning_Roadmap/01_LIVING_ROADMAP.md`

`ROADMAP_READ_MODEL = docs/10_Planning_Roadmap/02_AICC_ROADMAP_READ_MODEL.json`

`ROADMAP_UI_DIRECT_SOURCE_READ = FORBIDDEN`

`ROADMAP_READ_MODEL_IS_PROJECTION = TRUE`

`LEGACY_ROADMAP_PROJECTION_PATH = ~/.aicc-v2/roadmap-projection.json`

`LEGACY_ROADMAP_PROJECTION_AUTHORITY = NONE`

### Frozen Roadmap Hierarchy Semantics V2

`AICC_ROADMAP_HIERARCHY_SEMANTICS_V2 = FROZEN`

The only canonical Roadmap entity hierarchy is:

`MILESTONE -> WORK_PACKAGE -> PR -> TASK -> RUN`

`M# = MILESTONE`

`#.# = ROADMAP_SUBSECTION`

Roadmap subsections are presentation-only display groupings. They are not
business entities, canonical entities, Global State entities, Read Model
entities, lifecycle owners, execution owners, authorization owners, or write
authorities.

`ROADMAP_SUBSECTION_IS_DISPLAY_GROUPING_ONLY = TRUE`
`ROADMAP_SUBSECTION_IS_ENTITY = FALSE`
`ROADMAP_SUBSECTION_IS_CANONICAL_ENTITY = FALSE`
`ROADMAP_SUBSECTION_IS_GLOBAL_STATE_ENTITY = FALSE`
`ROADMAP_SUBSECTION_IS_READ_MODEL_ENTITY = FALSE`
`ROADMAP_SUBSECTION_LIFECYCLE_AUTHORITY = NONE`
`ROADMAP_SUBSECTION_EXECUTION_AUTHORITY = NONE`
`ROADMAP_SUBSECTION_AUTHORIZATION_AUTHORITY = NONE`
`ROADMAP_SUBSECTION_WRITE_AUTHORITY = NONE`
`ROADMAP_SUBSECTION_PHASE_AUTHORITY = NONE`

Read models project `milestones[] -> work_packages[]`; an optional
`roadmap_group_number` / `roadmap_group_title` is presentation metadata only.
No Track entity is used.

`TRACK_ENTITY = NOT_USED`

## Permanent AICC Planning Data Persistence

All independent persistent lists, read models, registries, indexes, summaries,
and statistical files created and maintained by AICC for long-term planning,
state inspection, reconciliation, reporting, or human audit must live under
`docs/10_Planning_Roadmap/`. This is the single governed directory for
AICC-created persistent planning data files.

`AICC_PERSISTED_PLANNING_DATA_DIRECTORY = docs/10_Planning_Roadmap/`
`SCATTERED_PERSISTED_AICC_LIST_FILES = FORBIDDEN`
`SCATTERED_PERSISTED_AICC_STAT_FILES = FORBIDDEN`

### File scope

This rule applies to independently persisted AICC-created entity Read Models,
persistent entity lists, planning/state-projection registries and indexes,
aggregate summaries, statistics, reconciliation snapshots intended for
long-term inspection, and other human-auditable persistent planning datasets.

Examples include `*_READ_MODEL.json`, `*_SUMMARY.json`, `*_REGISTRY.json`,
`*_INDEX.json`, and `*_STATISTICS.json`. These files must not be scattered
across `.aicc-v2/`, `src/`, temporary runtime folders, component folders, or
arbitrary documentation folders.

### Runtime-state exception

`.aicc-v2/` remains reserved for transient or operational technical state:
process state, locks, temporary runtime state, ephemeral caches, runtime
transport state, and technical coordination state. It must not become the
permanent home of independent AICC planning lists or statistical datasets.

`RUNTIME_TRANSIENT_STATE_DIRECTORY = .aicc-v2/`
`RUNTIME_DIRECTORY_AS_PLANNING_DATA_DIRECTORY = FORBIDDEN`

Moving a persistent Read Model into `docs/10_Planning_Roadmap/` does not make
it Layer 1 canonical authority. Existing Layer 1 / Layer 2 authority rules
remain unchanged.

### Numbering and naming contract

Persistent planning-data files use a stable two-digit numeric prefix:
`NN_FILE_NAME.ext`, such as `01_LIVING_ROADMAP.md` and
`03_AICC_PR_READ_MODEL.json`.

1. Existing formal file numbers retain their identity.
2. New independent files use the next appropriate available governed number.
3. A file is not renumbered merely because implementation is refactored.
4. Numbers are not reused for a different file identity.
5. Do not create placeholder files merely to reserve future numbers.
6. Do not mechanically create future files before their model exists.

`AICC_PLANNING_DATA_NUMBERING = STABLE_TWO_DIGIT_PREFIX`
`AICC_PLANNING_DATA_FILE_IDENTITY_STABLE = TRUE`
`PLANNING_DATA_PLACEHOLDER_FILES = FORBIDDEN`
`PLANNING_DATA_NUMBER_REUSE = FORBIDDEN`

Use semantic suffixes consistently: `*_READ_MODEL.json` for independently
persisted rebuildable Read Models, `*_SUMMARY.json` for aggregate summaries or
statistics, `*_REGISTRY.json` for governed registries, and `*_INDEX.json` for
persistent lookup/indexes. Markdown remains appropriate for Roadmap,
governance, definitions, and human-readable planning documents.

### Single persistence path and authority preservation

An independently persisted AICC dataset has exactly one active governed
persistence path. Migration must not leave two active copies that can both be
interpreted as current truth; historical files may remain only as explicitly
non-active evidence and must not participate in reads, writes, reconciliation,
or authority resolution.

`AICC_PERSISTED_DATASET_ACTIVE_PATH_COUNT = 1`
`DUAL_ACTIVE_READ_MODEL_PERSISTENCE = FORBIDDEN`
`FALLBACK_TO_OBSOLETE_PERSISTENCE_PATH = FORBIDDEN`
`PERSISTENCE_LOCATION_IMPLIES_CANONICAL_AUTHORITY = FALSE`

A rebuildable Read Model remains rebuildable from its actual canonical source;
a stale persisted Read Model must never override newer canonical truth.

### PR Read Model frozen path

The governed persistent local PR Read Model path is
`docs/10_Planning_Roadmap/03_AICC_PR_READ_MODEL.json`.

`PR_CANONICAL_SOURCE = GITHUB`
`PR_LOCAL_READ_MODEL_FILE = docs/10_Planning_Roadmap/03_AICC_PR_READ_MODEL.json`
`PR_LOCAL_READ_MODEL_AUTHORITY = PERSISTED_READ_MODEL_ONLY`
`OLD_PR_NAVIGATION_SNAPSHOT_ACTIVE = NO`

The obsolete `.aicc-v2/pr-navigation-snapshot.json` path must not be an active
PR persistence source, and dual active PR persistence is forbidden.

### Future-file rule

Before AICC creates a new independent persistent list, Read Model, or
statistics file: inspect `docs/10_Planning_Roadmap/`; determine whether an
existing governed file owns the dataset; reuse it when identity is the same;
otherwise allocate the next appropriate stable number; define its semantic type
and canonical source; define whether it is canonical, derived, or rebuildable;
and prevent duplicate active persistence elsewhere.

`NEW_AICC_PERSISTED_DATA_FILE_PRECHECK = REQUIRED`
`DUPLICATE_PERSISTED_DATASET = FORBIDDEN`

## AICC_BRIDGE_ACTION_REGISTRY_V1

- Bridge primary actions use one canonical registry.
- Rendering, identity, enabled state, disabled reason, and handler derive from the same registry.
- A visible action without a handler is forbidden.
- Action binding by display text or ordinal is forbidden.
- Capability remains visible when unavailable and is disabled with a truthful reason.
- The AICC action registry has zero semantic decision authority.
