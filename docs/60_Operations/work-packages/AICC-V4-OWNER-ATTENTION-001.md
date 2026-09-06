# AICC-V4-OWNER-ATTENTION-001

Status: `AUTHORIZED / IMPLEMENTATION COMPLETE`
Source of Truth: `GitHub`
Phase: `V4.5 — Owner Attention Center`

## Goal
Aggregate only explicit GitHub-backed Owner gates across registered projects and surface them globally and in the selected project tree.

## Evidence contract
- Roadmap evidence: unchecked checklist items under `Owner Attention` / `Owner Gates`, or exact `Owner Attention:` / `Owner Gate:` labels.
- PR evidence: explicit labels `owner-attention`, `owner-uat`, `owner-merge`, `owner-deploy`, `owner-production`, or `owner-decision`.
- Completed / PASS / CLOSED / DONE / APPROVED items are not attention.
- Draft PR, CI state, headings, percentages, or runtime state never create Owner Attention by inference.

## UI
- Top-right alert button shows the global explicit-gate count and opens Owner Attention Center.
- Each project card shows its gate count.
- Left Development Tree expands explicit Owner Attention items with GitHub evidence detail.

## Boundaries
AICC does not approve, pass, merge, deploy, release, or mutate a project. GPT must reconcile the cited GitHub evidence before any action.
