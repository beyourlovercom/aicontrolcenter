# AICC V2 Core Control Loop

Status: `OWNER_APPROVED_BASELINE`

## 1. Purpose

AICC V2 exists to reliably:

- RUN
- EXECUTE
- DISPLAY
- TRACK

a single-project Owner-gated development lifecycle.

The final V2 proof is not individual component PASS. The final proof is one
complete real Work Package moving from:

Owner requirement → GPT planning → Formal WP → PR delivery planning → Task
execution → Codex CLI → execution feedback → GPT next action → repeated
execution → Owner Human UAT → remediation if required → completion.

## 2. Canonical Control Loop

The only canonical high-frequency development loop is:

SOL GPT Web → AICC control instruction → AICC → Codex CLI Luna → execution
result → AICC durable result → AICC_FEEDBACK_V1 → AICC Bridge → SAME GPT
Conversation → SOL GPT Web → next control instruction → AICC → Codex Luna.

## 3. One WP / One GPT Conversation

`ONE_WP_ONE_GPT_CONVERSATION = TRUE`

A Formal Work Package must remain bound to one persistent GPT Web conversation
for its planning/control lifecycle.

That conversation retains:

- requirement discussion;
- architecture context;
- Formal WP context;
- PR planning context;
- Task history;
- Codex execution feedback;
- remediation reasoning;
- Owner UAT feedback;
- completion context.

AICC must not create a new Planner conversation per Task. AICC must not
repeatedly rebuild full historical context when the canonical GPT Conversation
already owns it.

## 4. GPT Web Authority

`GPT_WEB_ROLE = PLANNING + PR_DELIVERY_PLANNING + NEXT_ACTION + REMEDIATION + UAT_DECISION_REQUEST + COMPLETION_CONTROL`

GPT Web is the persistent reasoning/control authority for the Work Package
development conversation. AICC does not replace GPT planning authority.

## 5. Codex Runtime

`CODEX_DEFAULT_EXECUTOR = LUNA`

Codex CLI Luna is the default high-frequency execution runtime for planned
implementation Tasks.

Codex is responsible for:

- repository inspection;
- implementation;
- tests;
- build;
- remediation implementation;
- execution evidence;
- execution result.

The default V2 architecture must not invoke a second Planner Codex CLI after
every Task.

## 6. No Planner CLI Per Task

`NO_PLANNER_CLI_PER_TASK = TRUE`

`NO_AUTOMATIC_SOL_LUNA_PLANNER_SWITCHING = TRUE`

`NO_COMPLEX_LEVEL_ROUTING = TRUE`

The following default loop is forbidden and explicitly rejected for AICC V2:

Luna → Sol Planner CLI → Luna → Sol Planner CLI.

Reasons:

- duplicates reasoning cost;
- consumes unnecessary Codex quota;
- fragments context;
- creates model-switching ambiguity;
- introduces unnecessary routing decisions.

## 7. AICC Role

`AICC_ROLE = TRANSPORT + EXECUTION_CONTROL + DURABLE_STATE + BINDING + DISPLAY + TRACKING + RESULT_RETURN + NOTIFICATION`

`AICC_DECISION_AUTHORITY = 0`

AICC must not independently determine:

- product intent;
- architecture;
- PR decomposition quality;
- next semantic development action;
- remediation strategy;
- Human UAT PASS;
- Work Package completion semantics.

AICC may only execute explicit lifecycle/control contracts.

## 8. Canonical GPT Control Outputs

During automatic development control mode, GPT must return only one canonical
control contract:

- `AICC_EXECUTION_V1`
- `AICC_OWNER_UAT_V1`
- `AICC_WP_COMPLETE_V1`
- `AICC_BLOCKED_V1`

No conversational filler is required in automated control turns. The response
should contain only the information necessary for the next lifecycle action.

## 9. AICC Feedback Contract

Codex execution results must be persisted by AICC and returned to the bound GPT
Conversation using `AICC_FEEDBACK_V1`.

`AICC_FEEDBACK_V1` should contain only the current incremental execution context
required by GPT, including where applicable:

- Formal WP ID;
- PR identity;
- Task identity;
- Instruction ID;
- Execution ID;
- Run ID;
- runtime/model;
- execution result;
- validation result;
- changed evidence;
- blocker/failure information.

Do not resend the complete historical conversation on each iteration.

## 10. Owner Interruption Rule

`OWNER_INTERRUPTION = OWNER_UAT | BLOCKED | EXPLICIT_OWNER_DECISION_REQUIRED`

Normal successful Task progression must not require the Owner to sit at the
computer and manually relay every Codex result. AICC must continue transporting
the canonical control loop until a legitimate Owner interruption contract is
reached.

## 11. Human UAT

When GPT emits `AICC_OWNER_UAT_V1`, AICC must:

- stop automatic progression;
- persist `WAITING_OWNER_UAT`;
- display the UAT requirement;
- notify Owner;
- preserve exact WP / PR / Task / Run context.

Only Owner evidence can produce Human UAT PASS.

If Owner reports FAIL, the failure becomes durable evidence and returns to the
same GPT Conversation for remediation planning.

## 12. Work Package Completion

When GPT emits `AICC_WP_COMPLETE_V1`, AICC may project the completion request
and associated evidence.

AICC must not fabricate missing evidence or independently declare Human UAT
PASS.

## 13. Model Boundary

`SOL GPT WEB = persistent reasoning / planning / control conversation`

`CODEX LUNA = default implementation executor`

These are not alternating Codex Planner profiles. The GPT Web conversation
remains the stable planning context.

## 14. Quota Principle

AICC V2 must avoid unnecessary duplicate model execution.

High-frequency work should consume one Codex Luna execution per actual
implementation Task rather than one Luna execution plus one additional Planner
CLI execution per Task.

GPT Web handles the persistent planning/control conversation.

## 15. Source of Truth / Precedence

This document is the canonical AICC V2 control-loop baseline.

If future implementation behavior, generated instructions, runtime automation,
agent suggestions, Roadmap additions, Codex prompts, or prior documentation
conflict with this baseline:

`THIS BASELINE WINS`

unless explicitly changed by Owner.

Historical documents are not rewritten merely because their old architecture
differed. Where historical/current wording conflicts, it is superseded by this
baseline.

## 16. Canonical Task UI Interaction Reference

Canonical Task title, selection, and right-side Inspector interaction is
governed by `docs/00_Governance/AICC_CANONICAL_TASK_INTERACTION_CONTRACT.md`.
This document remains the execution and control-loop authority; the referenced
contract is the canonical Task UI interaction authority.
