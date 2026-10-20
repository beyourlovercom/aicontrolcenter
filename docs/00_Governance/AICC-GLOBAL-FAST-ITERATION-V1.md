# AICC Global Fast Iteration V1 — Cross-project Canonical

Policy-ID: `AICC-GLOBAL-FAST-ITERATION-V1`
Policy-Version: `1`
Status: `ACTIVE`
Effective-After: `OWNER_APPROVED_MERGE`
Authority: `GitHub main in beyourlovercom/aicontrolcenter`

## Purpose, scope and authority

Use the shortest **safe** feedback loop for small, low-risk, reversible changes, instead of making minor WordPress admin/UI adjustments follow the full ceremony of a large feature launch.

- GitHub canonical `main` and its exact SHA remain the sole versioned code and policy source. A test ZIP or installed Dev runtime is evidence, **not** source-of-truth code.
- This policy governs work classification and suggested iteration rhythm across AICC-routed projects; it does not authorize execution, a provider, a work package, GitHub merge, deployment, or data writes.
- AICC transports verified context and evidence, but GPT classifies risk, selects an appropriate feedback loop, reviews test results, and enforces STOP gates.
- Do not claim independent ChatGPT windows, external AI tools, or unconnected projects automatically inherit this policy. Effective inheritance requires their governed project context / agent entrypoint to actually receive the canonical rule.
- This document is effective only after explicit Owner-authorized merge into canonical GitHub main and integration at the relevant consuming runtime. A Draft PR does not activate it in existing production systems.

## Classification and precedence

**FAST_ITERATION_ELIGIBLE** when all apply:

1. The task has a narrow, Owner-approved outcome and existing feature/component ownership is understood.
2. The proposed change is low-risk, non-destructive and readily reversible (e.g. display-only column, admin CSS, noncritical wording, small plugin view).
3. Testing can be isolated to an approved Dev/Local UAT environment without real order/payment/customer/financial writes, public-site exposure or irreversible side effects.
4. A proportionate automated check (such as syntax lint, focused regression and relevant CI) can be run without concealing failures.
5. The test package can be deactivated/uninstalled cleanly or the changed files restored without harming unrelated functionality.

**STANDARD_GATED_FLOW** for materially new designs not yet approved, changes with complex dependencies, storage or query architecture changes, performance uncertainty, new permissions, checkout/shipping/payment/discount behavior, email delivery, external integrations, infrastructure, privacy/security controls, DB changes or other medium/high-risk work. A small-looking code diff is not automatically low-risk.

**STOP_OWNER_GATE** for Production/WWW deploy; main merge without exact-head authorization; real payments, external emails, real customer/order/financial data writes; destructive schema/data changes; credential/secret/2FA/account access; changing security architecture or business rules; or any Owner-only UAT decision.

Precedence: platform/security constraints and scoped Owner authorization > Executor Governance V2 and existing STOP gates > Global UI Preview First V1 and per-project native/functionality requirements > this speed-oriented process. A project may tighten gates but never weaken them.

**Global UI Preview First remains mandatory for material UI/visual/interaction changes:** show a functional interactive design and obtain Owner Visual PASS before implementing the new design, unless Owner expressly waives preview or adopts an already-approved baseline. Narrow styling/bug fixes with an approved design can use Fast Iteration with the classification reason recorded. Visual approval is not functional UAT.

## Fast-loop SOP

1. **Reuse before work.** Inspect the current GitHub source, existing branch/PR, accepted design and past UAT evidence. Do not rebuild previously accepted portions or open a duplicate development line.
2. **Build a minimum isolated change.** Implement within the owning plugin/theme/module in a scoped feature branch or Draft PR; when appropriate, create a temporary installable Dev-only ZIP (small add-on or patch) solely for Owner preview. Do not add a permanent plugin for a one-column feature.
3. **Lightweight preflight.** Perform focused PHP/JS lint, required safety/permission checks, and relevant CI. A failed or missing check is **not PASS**. Verify the exact test ZIP contents and source provenance; verify target environment before any write and retain a simple rollback path.
4. **Fast Dev/Local UAT.** Provide a directly installable file or approved preview path and 1–3 concrete checks. Owner installs or authorizes bounded Dev-only install, confirms actual on-screen and functional results. For trivial changes, **aim** for 3–5 minutes of first visible feedback, not a guaranteed SLA; troubleshoot only when there is a real problem.
5. **Branch by outcome:**
   - `OWNER_PASS`: Record exact scope, evidence and package/code SHA; finish the relevant UAT gate; prepare to merge the accepted implementation into its proper existing module.
   - `MINOR_TWEAK`: Revise that same temporary test package and Draft PR, increment test build, repeat only impacted checks and targeted UAT.
   - `FAIL_FIXABLE`: Diagnose and fix the specific failure, repeat relevant tests; preserve known-good runtime.
   - `NOT_VIABLE`: Stop that implementation without fabricating PASS, record why, disable/remove the disposable test package when authorized, and propose the next viable design.
6. **Integrate cleanly.** Once accepted, reconcile exact GitHub HEAD and CI, seek any required separate Owner exact-head merge authorization, then integrate into the *existing* canonical plugin/theme/project. Do not independently publish a permanent temporary UAT add-on. Retire test add-ons after successful controlled integration and deployment.
7. **Close concisely.** Report work performed, exact branch/PR SHA, tests, Dev UAT result, rollback, open gates, and whether any Production site was touched.

Do not spend time on repeated reviews of an unchanged accepted UI, repeated packaging of unchanged code, unrelated optimization, or speculative troubleshooting. Do not promise background execution unless a real automation exists.

## Dev safety and functional evidence

- Dev-only and Local-first targets are **project-specific**; BYL Website V3 uses `dev.beyourlover.com` as its long-lived integration/UAT environment, while other sites may use a different approved sandbox.
- Installation onto any environment requires verified target + exact source/package + applicable approved scope. Backup or reversible replacement of touched assets and a post-install health check remain required even for fast-loop tasks; reduce ceremony, not safety.
- Preserve native WordPress/WooCommerce authority and buttons; synthetic visual demos, PHP lint or CI alone are not real WordPress Dev UAT. Important functional UI surfaces still require native-control checks and applicable mobile/desktop UAT.
- Simple visual changes should not introduce new tables, queries or heavy JS by default; verify performance if touching loaded admin tables, lists or checkout surfaces.
- Prefer one narrow Owner-visible ZIP for small Dev experiments; version and replace it on the next test iteration, avoid long-lived extra plugins.
- If a remote tool is rate-limited, blocked, offline, or unsafe, report that exact blocker and offer the shortest legitimate manual route. Do not restart READY devices, reconnect blindly, route around safety blocks, or claim deployment happened.
- Never duplicate a runtime callback owned by both a disposable Dev plugin and the final integrated module. Disable the temporary add-on at the correct release/cutover gate.

## Evidence and status

Record only actually observed facts:

- `SOURCE_READY` — code committed, not necessarily validated.
- `FOCUSED_CHECKS_PASS` — the cited checks passed at an exact SHA.
- `DEV_UAT_PENDING` — Dev install or human review is outstanding.
- `DEV_UAT_FAIL` — observed malfunction, distinguish from environment blocker.
- `OWNER_PASS` — explicit Owner acceptance of the particular Dev result/design scope.
- `ALTERNATIVE_REQUIRED` — current route is not viable and stopped.
- `MERGE_GATE_PENDING` / `DEPLOY_GATE_PENDING` — approval is **not** implicitly granted.

No unattended Owner UAT pass, permission escalation, branch auto-merge, production deploy, order creation, payment, or email send is allowed by this policy.

## GPT Context Instruction

GLOBAL POLICY AICC-GLOBAL-FAST-ITERATION-V1 (canonical GitHub policy; applies to governed AICC projects only after merged and loaded). GPT shall classify narrow, low-risk, reversible work separately from material/high-risk work. For eligible work: reuse accepted source/design and prior UAT; work in scoped GitHub branch/Draft PR; run proportionate safety/CI checks; offer a minimal Dev-only test ZIP or equivalent quick legitimate UAT; Owner checks the actual Dev result; on FAIL fix and retest, on MINOR_TWEAK revise the same test package, on NOT_VIABLE stop and suggest a different approach, and on explicit OWNER_PASS prepare integration into the owning existing module. Speed is a preference, not an authority bypass: Global UI Preview First still governs new material visual changes; native functional UAT and site-specific Dev gates still apply; Owner exact-head merge, WWW/Production deployment, real orders, payments, external email, DB or secrets writes always keep their separate permission gates. Never claim CI or mock data is live Dev PASS; never silently merge or deploy. AICC may pass this rule with an exact verified GitHub main SHA but may not classify tasks, self-authorize, modify Bridge Results, or override user/platform safety.

## Implementation and rollout

1. Canonical document: `docs/00_Governance/AICC-GLOBAL-FAST-ITERATION-V1.md`; a scoped `AGENTS.md` reference in AICC is a governance index, not deployment authorization.
2. AICC V4 GPT Context and V5 Next-Step must independently read the policy from the exact canonical GitHub `main` SHA and include its bounded instruction, policy ID and content hash before generated context/request is finalized. Missing policy or invalid SHA must fail closed for any newly policy-required context. Do not mutate existing requests/results.
3. Cross-project `AGENTS.md` files may link to the canonical rule while keeping their site-specific safeguards. Rollout requires separate implementation/test/Owner gates; a link alone is not evidence a runtime consumed the rule.
4. Standalone ChatGPT conversations cannot be governed by GitHub rules until the relevant project context is explicitly supplied or user-level custom instructions are set by the user.
5. The canonical rule must not require a new permanent plugin, force a specific executor, or conflict with AICC's provider routing policy.

## Owner acceptance boundary

Owner approved preparing a GitHub Draft PR for this policy on 2026-10-20. **No merge, production service update, cross-project rollout, automatic plugin deployment or change of any existing Owner gate was approved.**
