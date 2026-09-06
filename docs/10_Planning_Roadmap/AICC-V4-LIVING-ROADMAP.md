# AICC V4 Living Roadmap

Roadmap-Revision: 1
Updated-At: 2026-09-06
Status: `V4.0 ACTIVE / ROADMAP REBASELINE`
Authority-Base: `main@45d3862ef0e9ec0df98939363982a8a0346ea723`
V3-Runtime-Baseline: `8998f46805723e661e700e3c55695fd3095f5fa5`

## Current milestone

`V4.0 — Roadmap Rebaseline`

Current Work Package: `AICC-V4-ROADMAP-REBASELINE-001`
Current implementation phase: `V4.0.2 — Draft PR / exact-head CI gate`
Next gated Work Package: `AICC-CONTROL-LOOP-001B — OpenSpec Binding`
Next gate: `SEPARATE OWNER AUTHORIZATION REQUIRED`

## Inherited production baseline

AICC V3.0–V3.9 is `CLOSED / OWNER ACCEPTED / MERGED TO MAIN / RUNTIME CUTOVER PASS / PRODUCTION BASELINE SEALED`.
The CN Mac production runtime remains on `main`, the local service remains the V3 single-service runtime, and the Browser Bridge remains the accepted 3.8.12 baseline. V4 work starts in separate explicit Work Packages and must not rewrite V3 evidence.

Permanent architecture constraints:

```text
AICC_TRANSPORT_ONLY = 1
AICC_DISPLAY_ONLY = 1
AICC_DECISION_AUTHORITY = 0
AICC_PASS_FAIL_BLOCKED_AUTHORITY = CODEX
AICC_RESULT_REWRITE = 0
NO_SELF_AUTHORIZATION = 1
OWNER_GATES_REMAIN_EXPLICIT = 1
```

## V4 delivery sequence and effort budget

| Phase | Capability | Formal state | Engineering | CI/UAT/closure | Total |
| --- | --- | --- | ---: | ---: | ---: |
| V4.0 | Roadmap Rebaseline | ACTIVE / OWNER_AUTHORIZED | 2–3h | 1h | 3–4h |
| V4.1 | OpenSpec Binding / `AICC-CONTROL-LOOP-001B` | PLANNED / NOT_AUTHORIZED | 8–12h | 2–3h | 10–15h |
| V4.2 | Review + Exact-head CI Control Plane | PLANNED | 8–12h | 2–4h | 10–16h |
| V4.3 | Autonomous PR Delivery | PLANNED | 10–16h | 3–5h | 13–21h |
| V4.4 | WP Automatic Lifecycle | PLANNED | 10–14h | 2–4h | 12–18h |
| V4.5 | Evidence & Audit | PLANNED | 6–10h | 2–3h | 8–13h |
| V4.6 | Mobile Owner Console | PLANNED | 12–18h | 3–5h | 15–23h |
| V4.7 | Multi-project AICC | PLANNED | 14–22h | 4–6h | 18–28h |
| V4.8 | Self-development Real Run | PLANNED | 10–16h | 4–6h | 14–22h |

Engineering subtotal: `80–123h`.
CI/UAT/closure subtotal: `23–37h`.
Total V4 planning budget: `103–160h`.

Planning assumption: these are engineering-equivalent focused hours for the current Codex-assisted workflow. They include bounded regression/fix cycles but exclude passive waiting for external CI queues, outages, credentials, or unrelated environment failures. Each future phase requires its own named Work Package and Owner Gate before implementation.

## V4.0 — Roadmap Rebaseline

Goal: retire stale “M4.1 is current” declarations, establish one canonical V4 sequence, preserve V3 production evidence, and publish the effort baseline.
Exit: roadmap/WP documentation checks pass; runtime source is unchanged; V4.1 remains blocked until separate Owner authorization.

## V4.1 — OpenSpec Binding

Goal: bind one formal Work Package to its exact `proposal.md`, `design.md`, `tasks.md`, and capability specs through a typed read-only evidence model.
Required outcomes: complete/incomplete/malformed/ambiguous/dependency/authority/owner-gate states; traversal and absolute-path rejection; no Apply/Sync/Archive or self-authorization.
Formal package: `AICC-CONTROL-LOOP-001B` remains `PLANNED / NOT_AUTHORIZED` at V4.0 closure.

## V4.2 — Review + Exact-head CI Control Plane

Goal: make review, test, build, CI and exact-head facts durable first-class evidence attached to the exact Task/Run/commit, without AICC inventing semantic PASS/FAIL.
Exit: stale-head evidence cannot satisfy a current gate; failures identify the exact failing check and source SHA.

## V4.3 — Autonomous PR Delivery

Goal: progress an authorized implementation to a Draft PR and merge-ready evidence automatically after scoped tests/review/CI, while preserving an explicit Owner merge gate.
Exit: branch/commit/PR/check facts are exact-bound and retry-safe; no force operations or autonomous merge.

## V4.4 — WP Automatic Lifecycle

Goal: derive Task/WP lifecycle transitions from durable execution evidence instead of repeated manual status maintenance.
Exit: transitions are deterministic and auditable; authorization, Human UAT and merge gates cannot be self-satisfied.

## V4.5 — Evidence & Audit

Goal: expose one queryable chain from Owner instruction → WP → Task → Run → Result → commit → PR → CI → UAT → merge/closure.
Exit: every displayed state can link back to immutable source evidence and exact identity.

## V4.6 — Mobile Owner Console

Goal: allow mobile read/approval workflows for status, blockers, UAT and explicit Owner gates while execution remains on authorized runtimes.
Exit: mobile actions cannot bypass identity, authorization or same-project constraints.

## V4.7 — Multi-project AICC

Goal: manage multiple repositories/projects with strict project/worktree/state isolation and no latest/current fallback across projects.
Exit: concurrent project observation is safe; writers remain isolated and explicit.

## V4.8 — Self-development Real Run

Goal: prove AICC can read its own canonical roadmap, surface the next eligible WP, obtain Owner authorization, drive Codex delivery, collect CI/PR/UAT evidence and advance lifecycle without granting itself semantic or authorization authority.
Exit: one real AICC self-development WP completes end-to-end under the same gates used for other projects.

## Final target operating model

```text
Owner requirement / approval
        ↓
GPT planning + architecture
        ↓
AICC control plane + identity + evidence + lifecycle
        ↓
Codex execution
        ↓
Repository / tests / GitHub CI / PR
        ↓
Owner UAT / Merge Gate
        ↓
Audited closure + next eligible WP
```

V4 Definition of Done: AICC becomes an evidence-driven software development control plane that can manage the full governed lifecycle while Owner authorization and GPT/Codex semantic authority remain explicit and non-transferable.
