# AICC-V2-VISUAL-IDENTITY-UNIFICATION-001: Visual Identity Unification

Work Package ID: `AICC-V2-VISUAL-IDENTITY-UNIFICATION-001`
Status: `READY_FOR_OWNER_AUTHORIZATION`
Formalization: `FORMAL_READY`
Type: `VISUAL_PRESENTATION_REMEDIATION`

## Authority

Visual authority: `APPROVED_OWNER_DESIGN`

The approved Owner design is the visual authority. The current implementation
is the presentation to be corrected toward that authority. This Work Package
does not authorize independent product redesign.

## Goal

Unify the AICC Local Web UI into a readable, clean, desktop-application visual
system with coherent typography, density, hierarchy, controls, cards, panels,
status colors, Roadmap presentation, Center Workspace, and Evidence sidebar.

Product truth and behavior must remain unchanged.

## Scope

- Define one global typography system using Inter / system UI / Chinese system fonts.
- Establish canonical CSS visual tokens for type, spacing, surfaces, borders, radii, shadows, and status colors.
- Restore the approved visual hierarchy for the application header, compact three-level Roadmap, Center Workspace, Owner Action Zone, workflows, tabs, cards, and Evidence sidebar.
- Keep normal UI typography non-monospace; reserve monospace for technical evidence.
- Keep Roadmap rows readable, dense, single-line where practical, and use a compact `DEMO` badge while retaining full fixture labeling in PR content and evidence.
- Establish reusable visual primitives for the future Runtime Observer design without implementing Runtime Observer functionality or fake runtime data.
- Validate desktop, resizable, and mobile presentation without changing layout behavior.

## Required Owner UAT

Owner visual UAT must cover:

- Milestone page and expanded M1 → Work Package → Demo PR Roadmap.
- Work Package page, WP workflow, and WP tabs.
- Demo PR page, PR workflow, and all PR tabs.
- Runtime evidence visibility and truthful technical-value presentation.
- Three-column desktop layout, resizing, and mobile drawers.

Owner acceptance questions:

- Is normal text comfortable to read?
- Does the Roadmap match the approved design direction?
- Is information hierarchy immediately obvious?
- Does the product feel visually unified?
- Are technical values confined to technical evidence?
- Are spacing and density efficient?
- Are all three columns visually coherent?

## Non-goals and protected behavior

This Work Package does not change:

- Entity Context Foundation or SelectedEntity behavior.
- Roadmap source truth or WP/PR data model semantics.
- Authorization, Execution Contract, Codex Runtime, Writer Lock, Safe Main Sync, or lifecycle resolution.
- Demo PR truth model, PR tab routing, GitHub integration, PR Runner, or Runtime Observer functionality.
- Roadmap truth, WP/PR lifecycle semantics, or future delivery/merge behavior.

Do not implement Runtime Observer functionality, GitHub integration, PR automation,
or fake production evidence.

## Dependencies

- `AICC-V2-DUAL-PANEL-001` functional implementation and Owner UAT are complete; global visual UAT remains failed.
- Approved Owner visual design is available as the visual authority.
- Explicit Owner authorization is required before implementation.
- Repository, branch, worktree, and runtime safety gates must pass.

## Acceptance Criteria

- Global font system, typography hierarchy, and canonical visual token source are implemented.
- Roadmap density, scanability, selection states, status system, and compact Demo badge match the approved visual direction.
- Center Workspace, Action Zone, workflows, tabs, cards, and Evidence sidebar form one coherent visual system.
- Runtime Observer visual primitives are reusable and contain no fabricated runtime data.
- Three-column, resize, and mobile behavior regressions remain absent.
- Functional behavior, entity context, authorization, runtime, Writer Lock, lifecycle, and evidence truth remain unchanged.
- Final Owner visual UAT passes for Milestone, Work Package, Demo PR, Roadmap, Runtime Evidence, WP workflow/tabs, and PR workflow/tabs.

## Execution boundary

This document formalizes the Work Package only. It does not mark implementation
started and does not authorize execution.
