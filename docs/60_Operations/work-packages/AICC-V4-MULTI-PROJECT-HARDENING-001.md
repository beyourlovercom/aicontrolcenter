# AICC V4.8 — Multi-project Real-use Hardening

Status: IMPLEMENTATION COMPLETE / DRAFT PR + EXACT-HEAD CI GATE
Source of Truth: `GitHub`
Work Package: `AICC-V4-MULTI-PROJECT-HARDENING-001`

## Goal

Harden AICC for daily use while multiple real projects are active, without adding execution authority or a second project truth store.

## Real-use scope

- Validate AICC / BYL ERP / Family Plan / Andy-Core / YBY-Core simultaneously.
- Preserve project identity when multiple AICC views share one GitHub repository.
- Prevent repeated refresh races from replacing newer UI state with older responses.
- Bound GitHub CLI read latency so one stalled read cannot hang the dashboard indefinitely.
- Coalesce duplicate GitHub reads within one All Projects refresh.
- Coalesce concurrent All Projects requests while one GitHub refresh is already in flight.
- Preserve stale runtime semantics and the read-only mutation gate.

## Verified real-use findings

- Five registered project views resolve from current GitHub main facts.
- Andy-Core and YBY-Core share `beyourlovercom/YBY-Core` but keep distinct AICC project IDs and context snapshots.
- V4.8 local branch never replaces the AICC project facts projected from GitHub `main` before merge.
- Four concurrent All Projects requests complete from one in-flight GitHub refresh instead of four independent refreshes.
- Stale Remote Desktop Commander observation remains `STALE_OBSERVATION`; old ONLINE values are not presented as current online.
- POST mutation requests remain rejected with HTTP 405.

## Reliability changes

- `gh api` reads fail closed on a bounded timeout.
- Same-path GitHub reads are request-scoped and de-duplicated.
- Concurrent `/api/projects` requests share only the current in-flight promise; there is no persistent AICC fact cache.
- UI refresh uses a monotonic epoch and disables the refresh control while the current request is active.

## Boundaries

- GitHub remains the only project Source of Truth.
- Coalescing is transport efficiency only; it does not create durable AICC project state.
- Runtime remains ephemeral observation evidence only.
- AICC does not approve, merge, deploy, switch branches, start executors, ping machines or control machines.
- `Suggested Next` remains advisory and GPT must reconcile GitHub again before action.
- This work package does not deploy V4 or cut production over from V3.