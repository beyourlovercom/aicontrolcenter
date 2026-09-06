# AICC-V4-PROJECT-SWITCHER-DASHBOARD-001

Status: IMPLEMENTATION COMPLETE / DRAFT PR GATE
Phase: V4.2 — Project Switcher + All Projects Dashboard
Authority base: `main@60854a04be8d22f6d6f741943140c46d1ed343f8`

## Scope

Implement the Owner-accepted top-right Project Switcher and All Projects dashboard on top of V4.1 GitHub project facts.

## Hard boundaries

- GitHub remains the only project Source of Truth.
- `viewProjectId` is presentation state only.
- Project switching MUST NOT switch branches, start execution, mutate GitHub, or change machine state.
- The dashboard MUST NOT invent completion percentages when no GitHub-backed canonical progress fact exists.
- V3 production runtime remains unchanged.

## Acceptance

- one-click switching among registered project views and All Projects;
- All Projects renders current GitHub repo/main/PR/CI/roadmap facts;
- single-project view renders exact GitHub provenance;
- refresh is GET-only;
- browser may persist the selected view id, never project facts;
- V4 tests and V3 regression pass.
