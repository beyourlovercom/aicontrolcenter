## ADDED Requirements

### Requirement: V4 has one canonical current roadmap

The repository SHALL identify V4.0 as current development after the sealed V3 production baseline and SHALL NOT present historical M4.1 as current execution authority.

#### Scenario: Legacy roadmap is read
- **WHEN** a reader opens the legacy Living Roadmap
- **THEN** it points to the canonical V4 roadmap and marks M4.1 as historical/superseded

### Requirement: V4 effort budget is explicit

The canonical V4 roadmap SHALL list V4.0 through V4.8 with separate engineering and CI/UAT/closure ranges and the aggregate `103–160h` planning budget.

#### Scenario: Owner reviews the V4 plan
- **WHEN** the canonical V4 roadmap is read
- **THEN** each phase has an explicit effort range and the engineering, verification, and total subtotals are present

### Requirement: Future implementation remains separately authorized

`AICC-CONTROL-LOOP-001B` SHALL remain `PLANNED / NOT_AUTHORIZED` through V4.0 closure, and every later implementation phase SHALL require its own explicit Owner Gate.

#### Scenario: V4.0 completes before V4.1 authorization
- **WHEN** the V4.0 documentation package reaches its exit gate
- **THEN** 001B is still non-executable until a separate explicit Owner authorization is recorded

### Requirement: V3 production evidence is preserved

The rebaseline SHALL NOT rewrite sealed V3 merge, cutover, smoke, or production-baseline evidence and SHALL NOT modify runtime source under `v3/`, `src/`, or `src-tauri/`.

#### Scenario: Rebaseline diff is reviewed
- **WHEN** V4.0 changes are compared with its authority base
- **THEN** V3 evidence remains intact and no changed file is under the runtime source roots
