# AICC V3 Living Roadmap

Roadmap-Revision: 20
Updated-At: 2026-09-04
Status: `ACTIVE`

## Current milestone

`V3.7 — PR Delivery`

Current Work Package: `AICC-V3-PR-DELIVERY-001`
Current implementation phase: `V3.7.3 — exact-head CI and Owner UAT`

## Milestones

### V3.0 — Freeze & Bootstrap
Goal: freeze V2 and establish isolated V3 governance, branch, worktree, and state root.
Estimate: 2–3h.

### V3.1 — Single Server Skeleton
Goal: `aicc.b` opens one server with `/api/health` and no fallback.
Estimate: 3–4h.

### V3.2 — Single Project Authority
Goal: one typed ProjectContext owns repository, branch, HEAD, and dirty state.
Estimate: 5–6h.

### V3.3 — Canonical Roadmap
Goal: read-only canonical Roadmap; no UI inference.
Estimate: 4–5h.
### V3.4 — WP + Task Core
Goal: minimal durable WP/Task model and explicit binding.
Estimate: 6–8h.

### V3.5 — Codex Execution
Goal: one executor lease, one Run identity, start/stop, event stream.
Estimate: 7–9h.

### V3.6 — Canonical Result Return
Goal: exact Run → Result persistence and reload-safe retrieval.
Estimate: 5–7h.

### V3.7 — PR Delivery
Goal: GitHub PR facts, Draft PR, exact-head CI. No automatic merge.
Estimate: 5–6h.

### V3.8 — GPT Bridge / Auto Return
Goal: GPT → AICC → Codex → canonical Result → same GPT conversation.
Estimate: 7–10h.

### V3.9 — Human UAT + Hardening
Goal: restart recovery, isolation regression, real Owner UAT, handoff.
Estimate: 5–7h.

Total implementation budget: `55–70h` including bounded rework.

## Next exact gate

Commit and push the V3.7.2 minimal PR Delivery UI checkpoint, require exact-head V3 CI PASS, deploy that exact head to CN Mac `aicc.b`, and stop for Human Owner UAT. Owner may explicitly create one Draft PR during UAT; AICC must expose no merge, close, edit, ready, approve, release, or deploy action.
