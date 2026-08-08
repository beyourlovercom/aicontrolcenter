## ADDED Requirements

### Requirement: Formal roadmap hierarchy
The application MUST display Project → Milestones → Work Packages and derive overall and milestone progress from formal Work Package evidence.

#### Scenario: Owner sees evidence hierarchy
- **WHEN** formal roadmap evidence is available
- **THEN** the UI groups Work Packages under milestones and displays derived project and milestone progress

### Requirement: Actionable sync state
The application MUST display `UP_TO_DATE`, `SYNC_REQUIRED`, or `BLOCKED`, with Chinese blocker explanation, raw technical code, and actionable next step. Existing fail-closed guards and mutation sequence MUST remain enforced.

#### Scenario: Blocked sync is actionable
- **WHEN** a sync guard blocks synchronization
- **THEN** the UI displays `BLOCKED`, the Chinese reason, raw blocker code, and next step

### Requirement: Self-explanatory execution decision
The application MUST present the next Work Package gate as `下一工作包执行判定`, including candidate, status, allowance, blocker, next step, and raw technical evidence.

#### Scenario: Unauthorized candidate remains blocked
- **WHEN** the formal candidate is `PLANNED` and `NOT_AUTHORIZED`
- **THEN** the UI shows `WORK_PACKAGE_NOT_AUTHORIZED` and does not allow execution

### Requirement: Chinese-first Owner UI
Owner-facing navigation, titles, actions, explanations, statuses, empty states, and error guidance MUST be Chinese-first. Engineering identifiers MUST remain unchanged and visible.

#### Scenario: Raw engineering evidence remains visible
- **WHEN** an Owner-facing status is localized
- **THEN** its Work Package ID, status code, SHA, branch, or path remains available as secondary evidence
