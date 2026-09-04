# AICC Global Execution Composer Dock V1

- Document ID: `AICC-GLOBAL-EXECUTION-COMPOSER-DOCK-V1`
- Status: `APPROVED_IMPLEMENTATION_CONTRACT`

## Role

The Global Execution Composer Dock is the sole AICC instruction-entry surface.
It is mounted once in the App Shell center workspace and remains available in
Blueprint, WP, PR, and Task workspaces. It is a UI relocation only; canonical
Bridge submission, context binding, authorization, runtime creation, and
result handling remain unchanged.

## Layout Contract

`center workspace scroll context → sticky composer shell → width container → composer form → composer surface`

- `GLOBAL_COMPOSER_INSTANCE_COUNT = 1`
- `POSITION = sticky`
- `BOTTOM = 0`
- `MAX_WIDTH = 48rem`
- `IDLE_MIN_HEIGHT = 52px`
- `BORDER_RADIUS = 28px`
- `MAX_INPUT_HEIGHT = 208px`
- `GRID = auto | minmax(0, 1fr) | auto`

The dock is scoped to the center workspace, never spans either side rail, and
reserves a compact bottom safe area for readable center content. Multiline
text expands upward; the input scrolls after its maximum height.

## Interaction Contract

The dock preserves paste, import, execute, model selection, current-context
binding, keyboard submission, and exactly-once behavior through the existing
canonical AICC execution path. The selected context is resolved at submission
time. Workspace navigation preserves the unsent draft.

Compact icon controls require accessible labels and tooltips. The primary send
control remains disabled for empty input and must not create a second execution
implementation.

## Boundaries

The dock does not redesign Task navigation, PR Lifecycle/Binding UI, the Web
Bridge canonical composer, Roadmap projection, or AICC governance authority.

`AICC_DECISION_AUTHORITY = 0`
