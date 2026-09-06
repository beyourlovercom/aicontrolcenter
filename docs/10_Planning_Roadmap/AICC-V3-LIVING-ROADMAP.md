# AICC V3 Living Roadmap

Roadmap-Revision: 27
Updated-At: 2026-09-06
Status: `CLOSED / DEVELOPMENT COMPLETE`

## Current milestone

`V3.9 — Human UAT + Hardening — CLOSED / ACCEPTED`

Current Work Package: `AICC-V3-HUMAN-UAT-HARDENING-001`
Current implementation phase: `V3.9.2 — CLOSED / OWNER ACCEPTED`

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

V3.8 disposition: `CLOSED / ACCEPTED` after the privileged Browser Bridge implementation, exact-head CI, and controlled Owner UAT evidence recorded in the final handoff.
V3.9 status: `CLOSED / OWNER ACCEPTED`.

Total implementation budget: `55–70h` including bounded rework.

## Post-V3.9 merge gate

V3.0–V3.9 development is closed after deterministic restart/isolation hardening, exact-head CI success, and explicit Owner acceptance on 2026-09-06. PR #12 remains Draft / Open and is now the only next gate. Merge, release, deployment, or PR readiness changes require separate explicit Owner authorization.
