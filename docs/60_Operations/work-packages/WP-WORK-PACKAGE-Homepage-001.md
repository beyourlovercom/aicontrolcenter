# WP-WORK-PACKAGE-Homepage-001: Work Package Homepage

Work Package ID: `WP-WORK-PACKAGE-Homepage-001`
Title: `Work Package Homepage`
Parent Milestone: `M3.86 — Work Package Lifecycle`
Status: `PLANNED`
Formalization: `FORMAL_READY`
Type: `ROADMAP_STRUCTURE_REGISTRATION`

## Objective

Redesign and formalize the AICC top-level Work Package workspace using the
Root → Selection → Detail → Evidence interaction grammar established for PR
and Task, while preserving Work Package as the canonical entity.

The planned workspace has three coordinated panels:

- Left: WP Quick List
- Center: Global WP Workspace or the existing WP Operations Workspace
- Right: WP Context / Evidence

This document registers the structure only. Implementation has not started.

## Scope

- Freeze and reuse the existing App-level canonical Work Package selection
  authority.
- Define the compact left WP Quick List with local search over WP ID, title,
  milestone, and phase.
- Define the root center as a pure Work Package summary and list workspace.
- Synchronize left, center, and detail routing through one selected WP.
- Reuse the existing Work Package Operations Workspace and context/evidence
  surface.
- Validate root, selection, evidence, navigation, search, and workspace
  transitions through Owner UAT.

## Out of Scope

- Production UI implementation during this registration.
- App routing, Global Composer, PR Workspace behavior, or Task Workspace
  behavior changes.
- New Work Package selection authorities or duplicate detail/inspector
  surfaces.
- Runtime semantics, execution semantics, authorization, or governance
  changes.
- Automatic phase execution, Work Package completion, or Human UAT PASS.

## Canonical Interaction Model

The top-level WP interaction is root-first:

- Top-level WP click clears concrete WP selection to `NONE`.
- Root state shows the Global WP Workspace in the center and the WP Root
  default / Empty State on the right.
- `AUTO_SELECT_FIRST_WP = NO`.
- Selecting a concrete WP from the left or root center directly rebinds the
  existing WP Operations Workspace and the existing WP Context / Evidence.
- `LEFT_SELECTED_WP = CENTER_SELECTED_WP = canonical selected WP authority`.
- WP-to-WP selection rebinds directly and does not route through root.
- Leaving WP unmounts WP center detail and right evidence, restoring the target
  workspace's existing surfaces.

The root center is a pure Work Package summary/list workspace with All,
Active, Blocked, Completed, and Unmapped summary/filter states and a table of
Work Package, Status, Milestone, Phase, PR, Task, Branch, and Updated. It does
not contain an Entity Hero, Runtime Monitor, Current Execution, Execution
Provider, Delivery surface, or concrete WP Operations Workspace.

The left list is a WP-specific list, not an expandable WP → Phase hierarchy.
Its search filters only the list and does not mutate canonical selection or
center statistics. The right context is normal workspace slot replacement,
with overflow containment for long identifiers and no mutation of canonical
copy values through visual ellipsis.

## Six Phases

### Phase 1 — Canonical Selection + Root Contract [PLANNED]

Audit and freeze the canonical Work Package selection authority, preferring
reuse of the existing App-level authority. Establish root selection as
`selected WP = NONE`, with no automatic first WP selection, and distinguish
the Global WP Workspace from the existing selected-WP Operations Workspace.

### Phase 2 — Left WP Quick List [PLANNED]

Replace the WP-mode left Roadmap tree with a compact WP Quick List. Rows show
status, WP ID/title, an informational phase badge, and a selection affordance.
Add local search for WP ID, title, milestone, and phase; search filters only
the left list.

### Phase 3 — Center Global WP Workspace [PLANNED]

Make the top-level WP Root center a pure Work Package summary/list workspace
with All, Active, Blocked, Completed, and Unmapped states and the required
Work Package detail table. Preserve `WP_ROOT != WP_DETAIL`.

### Phase 4 — Selection Sync + Existing WP Detail Routing [PLANNED]

Establish one canonical selected WP across left, center, and detail routing.
Left selection and root-center selection directly open the existing selected WP
Operations Workspace, with no duplicate Selected WP Detail implementation and
no routing through root for WP-to-WP changes.

### Phase 5 — Right WP Context / Evidence [PLANNED]

Bind the existing WP context/evidence surface to the canonical selected WP via
normal right-column workspace replacement. Preserve canonical identity,
status, milestone, phase, PR/task relationships, Owner UAT, evidence, and
delivery/result facts where available, plus right-panel overflow containment.

### Phase 6 — Integration UAT + Freeze [PLANNED]

Perform complete Owner UAT across WP Root, selection, detail, evidence,
navigation, search, and workspace transitions. The required UAT cases are
UAT-01 through UAT-06 covering root state, left selection, root-center
selection, direct WP-to-WP rebind, root return, and WP-to-Blueprint/PR/Task
restoration. No UAT result is preselected during registration.

## Dependencies

- M3.86 — Work Package Lifecycle remains the canonical parent milestone.
- Existing canonical Work Package selection authority and existing WP
  Operations Workspace.
- Existing Work Package context/evidence surface.
- Frozen AICC V2 UI / Interaction Standard and the canonical task and feed
  interaction contracts where their shared interaction grammar applies.

## Owner UAT Contract

Owner UAT must prove:

1. Top WP opens root state without selecting the first WP.
2. Left WP A selection highlights A and binds existing A Operations and
   Evidence workspaces.
3. Root-center WP B selection highlights B and binds existing B workspaces.
4. WP A → WP B rebinds all three panels without stale A information.
5. Returning to top-level WP clears concrete selection and restores root state.
6. WP → Blueprint / PR / Task restores the target center and right surfaces.

The final closure evidence may declare
`AICC_WP_WORKSPACE_V1_OWNER_UAT = PASS` only after Owner evidence exists.
Human UAT PASS does not occur during registration.

## Freeze / Closure Criteria

The Work Package may be marked complete only after all six phases have
evidence-backed `PASS` results, Owner UAT is `PASS`, the expected WP workspace
behavior is frozen, and the canonical lifecycle permits closure. This
registration records six total phases and zero closed implementation phases.
`WP-WORK-PACKAGE-Homepage-001` remains `PLANNED` and is not complete.
