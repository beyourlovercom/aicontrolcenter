# AICC Global UI Preview First V1 — Cross-project Canonical

Policy-ID: `AICC-GLOBAL-UI-PREVIEW-FIRST-V1`
Policy-Version: `1`
Status: `ACTIVE`
Effective-After: `OWNER_APPROVED_MERGE`
Authority: `GitHub main in beyourlovercom/aicontrolcenter`

## Purpose and precedence

For UI design and interaction changes routed through the governed GPT → AICC workflow, obtain an interactive, Owner-reviewable prototype **before implementation**. This is a cross-project default, not a special rule for BYL ERP.

- GitHub is the only rule Source of Truth. Project rules may be stricter but cannot silently bypass this policy.
- GPT classifies the requested work and chooses a preview medium. AICC copies/transports the canonical policy, never guesses intent, grants permission, invents PASS, or rewrites executor Results.
- The Owner's explicit latest request, existing authorized Work Package scope, and higher-priority security/production gates continue to apply. Preview approval is **not** merge, deployment, data-write, or functional-UAT approval.
- This governance rule is effective only once approved and merged to canonical GitHub `main` and the consuming AICC runtime has picked it up. A GitHub document by itself cannot control arbitrary ChatGPT conversations outside AICC.

## Scope decision (by GPT, not AICC)

`PREVIEW_REQUIRED` when the requested work creates or materially changes a user-facing page, layout, navigation, major interaction, component composition, checkout flow or visual system.

`PREVIEW_NOT_REQUIRED` for pure backend/API/schema work, infrastructure or diagnostics, invisible refactoring, narrow bug fixes with a previously accepted design, and urgent safe remediation where preview would hinder recovery.

`PREVIEW_WAIVED_BY_OWNER` only when the Owner explicitly says to skip the prototype for this task, or explicitly approves using an existing visual design as the exact implementation baseline. Record the decision and scope in the associated GitHub Work Package / Issue / PR if tracked. Never infer a waiver from an assistant suggestion or past unrelated project.

Tasks with material UI changes must return to `PREVIEW_REQUIRED` when the previously approved design is materially superseded.

## Prototype quality

1. Prefer **in-conversation interactive HTML/CSS/JavaScript** using ChatGPT AppBlock when supported. It must be rendered and operable in the chat, not merely an HTML code fence or a static screenshot.
2. Reuse the correct project's GitHub/UI components, screenshots and visual identity; distinguish each project and deployment target. Do not conflate Website Dev with ERP Production.
3. Provide functional *prototype* interactions for the controls central to the request (e.g. search, sort, pagination, responsive layout, menus, configurable columns, tabs, dialogs); do not implement a mock feature that has no interactive behavior.
4. Use clearly labeled illustrative/demo data whenever real data was not actually read. Never claim a prototype is connected to Production or that demo inputs were persisted. No production writes, data synchronization, emails, orders, payments, or secrets changes for preview.
5. If AppBlock is unavailable or unsuitable in the client, show a genuinely interactive standalone preview in an allowed environment and state explicitly which capabilities are simulated. Do not invent a deployed preview URL or claim it was rendered without evidence.
6. Mobile-first verification for important/difficult views, using iPhone 14-sized review where appropriate.

## Owner evidence and separate gates

Use the following *evidence labels* in GitHub-tracked task records. These are evidence descriptions, **not** new AICC authorization tokens:

- `PREVIEW_REQUIRED`: UI changes need a preview; implementation of the visual change has not been approved by Owner yet.
- `PREVIEW_PRESENTED`: an actual render/artifact and limitations were shown; store a traceable link or reference.
- `OWNER_VISUAL_PASS`: only an explicit Owner PASS for this exact design and scope. Do not infer from CI, assistant clicks or silence.
- `IMPLEMENTATION_IN_PROGRESS`: only after existing authorization + applicable preview gate.
- `FUNCTIONAL_UAT_PASS`: separate evidence from actual app/runtime, not from the prototype.
- `MERGE_APPROVAL`, `DEPLOY_APPROVAL`: separate existing Owner gates; Visual PASS grants neither.

An approved new UI Work Package may prepare non-deployed implementation code while awaiting preview only if Owner specifically authorized that sequence; do not silently skip Owner visual confirmation. Existing authorizations for unrelated tasks remain unaffected.

## GPT Context Instruction

GLOBAL POLICY AICC-GLOBAL-UI-PREVIEW-FIRST-V1 (GitHub canonical; applies to all projects routed through AICC). Before a task with material UI/visual/interaction changes, GPT must first deliver an interactive, directly usable HTML/CSS/JavaScript prototype in the *current ChatGPT conversation* (prefer AppBlock if available), show the correct project's visual identity and core interactions, and identify any demo data and simulated behavior. Do not initiate new implementation of the material UI design until Owner explicitly responds with visual UAT PASS, unless Owner explicitly waives the preview or adopts an already-approved design. GPT alone decides whether the task needs preview; pure backend, urgent remediation and narrow fixes may skip with recorded reason. Distinguish OWNER_VISUAL_PASS from actual functional UAT, GitHub merge and Production deployment Owner Gates. Preview itself must never write Production data, claim real backend integration, or authorize any action. If in-chat preview is unavailable, offer a genuine interactive alternative; never pretend a screenshot or code fence is equivalent. Treat this as an instruction for GPT on the task, NOT authorization for AICC to classify, start work, mutate runtime, or rewrite canonical results.

## Implementation and inheritance

Canonical document: `docs/00_Governance/AICC-GLOBAL-UI-PREVIEW-FIRST-V1.md`.

The AICC GPT Context endpoint must read this file **from the canonical governance repository at a verified exact GitHub main SHA**, then embed the bounded `GPT Context Instruction`, rule ID, source repo/ref and content hash into the copied GPT context for *any* registered project. Missing/unavailable/invalid policy must fail closed with an explicit context error rather than silently omit the rule.

The Browser Bridge's immutable instruction and Result content may not be mutated to insert this rule after Owner submission. The policy belongs in pre-execution GPT context generation only; the Bridge transport remains unchanged. Standalone ChatGPT sessions that do not receive AICC context cannot be claimed to inherit this automatically.
