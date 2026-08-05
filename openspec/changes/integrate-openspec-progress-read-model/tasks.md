## 1. Repository Discovery And Contracts

- [x] 1.1 Define the current-repository scope and read-only adapter boundary for `openspec/` and local Git evidence
- [x] 1.2 Define normalized entities for Roadmap, Work Package, source files, diagnostics, task progress, lifecycle status, Evidence, Verification Evidence, and Authority
- [x] 1.3 Define the supported Markdown structure and the diagnostic contract for missing, malformed, and empty inputs
- [x] 1.4 Identify the repository's existing verification-report locations and formats without introducing remote access

## 2. OpenSpec Parsing

- [x] 2.1 Discover approved specifications under `openspec/specs/` and preserve repository-relative source paths
- [x] 2.2 Discover active Changes under `openspec/changes/` and archived Changes, distinguishing active Work Packages from history
- [x] 2.3 Parse `proposal.md`, delta specs, `design.md`, and `tasks.md` into source-backed model sections
- [x] 2.4 Emit structured diagnostics for missing files, malformed Markdown, and tasks files with no checkbox items

## 3. Progress And Status

- [x] 3.1 Parse checked and unchecked task checkboxes and calculate total, completed, remaining, and percentage progress
- [x] 3.2 Implement lifecycle normalization for `PROPOSED`, `PLANNING`, `READY`, `IMPLEMENTING`, `BLOCKED`, `VERIFYING`, `VERIFIED`, `ARCHIVED`, `INVALID`, and `UNKNOWN`
- [x] 3.3 Detect multiple active Changes and prevent silent Work Package selection when the context is ambiguous
- [x] 3.4 Compare OpenSpec lifecycle signals with task, verification, and Git evidence and preserve explicit inconsistency diagnostics

## 4. Local Evidence And Authority

- [x] 4.1 Read local Git HEAD, branch, and working-tree cleanliness without fetch or remote mutation
- [x] 4.2 Read available test results and verification reports as source-backed Verification Evidence
- [x] 4.3 Represent unavailable remote Authority separately from available local Git Evidence
- [x] 4.4 Ensure all evidence, files, and diagnostics retain provenance and cannot trigger repository writes or process execution

## 5. Frozen Three-Column Mapping

- [x] 5.1 Map Roadmap and Work Package hierarchy to the left-column view model
- [x] 5.2 Map the selected Work Package's proposal, specifications, design, tasks, status, progress, and implementation details to the center-column view model
- [x] 5.3 Map Evidence, verification results, source files, Git status, Authority, and diagnostics to the right-column view model
- [x] 5.4 Preserve partial and invalid data in the view model while surfacing its diagnostic context

## 6. Verification

- [x] 6.1 Add focused tests for valid parsing, archived Changes, partial task completion, and all required lifecycle states
- [x] 6.2 Add focused tests for missing and malformed files, empty tasks, multiple active Changes, dirty working trees, and unavailable remote Authority
- [x] 6.3 Add tests proving read-model construction performs no fetch, write, PR, deployment, or arbitrary command operation
- [x] 6.4 Run the repository's lint, typecheck, and test commands and record the resulting Verification Evidence format
