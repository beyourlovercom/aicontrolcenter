## ADDED Requirements

### Requirement: Owner authorization is persisted and evidence-bound

The system SHALL require explicit Owner confirmation and persist the Work Package ID, Authority SHA, branch, worktree, scope, allowed capabilities, forbidden capabilities, and authorization timestamp. Drift or missing evidence SHALL fail closed.

#### Scenario: Owner authorizes a formal package

- **WHEN** the Owner confirms authorization for a formal Work Package and repository evidence is valid
- **THEN** the system persists `AUTHORIZED_FOR_IMPLEMENTATION` with every required binding and exposes it to the Owner

#### Scenario: Binding drifts

- **WHEN** the Authority SHA, branch, worktree, or Work Package no longer matches the authorization record
- **THEN** START remains blocked and the mismatch is visible

### Requirement: Codex runtime is typed and observable

The runtime SHALL support `IDLE`, `WAITING_OWNER_AUTHORIZATION`, `STARTING`, `RUNNING`, `TESTING`, `REVIEWING`, `PR_OPEN`, `CI_RUNNING`, `MERGING`, `BUILDING_UAT`, `READY_FOR_HUMAN_UAT`, `BLOCKED`, `FAILED`, and `PAUSED`. It SHALL expose active Work Package, session state, branch, worktree, phase, last activity, current task, test state, review state, PR, CI state, blocker, and next action without fabricated values.

#### Scenario: No runtime evidence exists

- **WHEN** the observer has no persisted run
- **THEN** it reports `IDLE` or `WAITING_OWNER_AUTHORIZATION` and uses `UNKNOWN` or empty evidence rather than demo values

### Requirement: Owner controls are bounded

The UI SHALL expose only START, PAUSE, RESUME, STOP AFTER CURRENT STEP, and RETRY. The backend SHALL reject invalid transitions and SHALL NOT accept arbitrary shell commands.

#### Scenario: Unauthorized start

- **WHEN** START is requested without a matching valid authorization
- **THEN** the runtime reports `WAITING_OWNER_AUTHORIZATION` or `BLOCKED` and does not start Codex

### Requirement: Delivery preserves independent gates

Builder evidence SHALL NOT approve independent review. Normal-risk squash merge SHALL require tests PASS, independent review PASS, exact-head CI PASS, no unresolved blocker, and no scope widening. Human UAT SHALL remain pending after the SHA-bound artifact is built.

#### Scenario: Main artifact succeeds

- **WHEN** the scoped PR is merged and main CI plus the macOS build pass for the merge SHA
- **THEN** the delivery state becomes `READY_FOR_HUMAN_UAT` without marking Human UAT PASS
