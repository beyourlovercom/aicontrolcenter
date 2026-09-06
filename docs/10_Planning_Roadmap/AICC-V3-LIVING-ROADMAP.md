# AICC V3 Living Roadmap

Roadmap-Revision: 28
Updated-At: 2026-09-06
Status: `CLOSED / PRODUCTION BASELINE SEALED`

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

## Production baseline closure

V3.0–V3.9 development is closed and merged. PR #12 merged to `main` as `8998f46805723e661e700e3c55695fd3095f5fa5`. The CN Mac canonical runtime was cut over to `main`, remained healthy, and passed the exact same-conversation smoke with `AICC_MAIN_CUTOVER_SMOKE_PASS`. Production baseline closure is sealed; future implementation work must start from `main` in a new explicit WP/version. No release/tag is implied by this closure.
