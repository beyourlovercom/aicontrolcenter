# AICC Web Bridge UI Standard v1.0

- Document ID: `AICC-WEB-BRIDGE-UI-STANDARD-001`
- Status: `FROZEN / APPROVED_BASELINE`
- Effective date: `2026-08-14`
- Scope: AICC Chrome Extension, AICC GPT Web Bridge, ChatGPT executable action
  overlay, ChatGPT composer AICC action, and the AICC Bridge floating side panel.

This is the specialized Web Bridge UI authority. It extends, and does not
replace, the general `AICC-V2-UI-INTERACTION-STANDARD-001` baseline:

`AICC-V2-UI-INTERACTION-STANDARD-001`
`└── AICC-WEB-BRIDGE-UI-STANDARD-001`
`    └── Chrome Extension / GPT Web Bridge implementation`

For Web Bridge UI-specific behavior, this document is authoritative.

## 1. Product principle: overlay, not layout owner

AICC enhances ChatGPT through an independent overlay and auxiliary interaction
layer. AICC is not the owner of ChatGPT's native layout. Implementations should
prefer overlays, fixed or absolute positioning, anchor measurement, external
action rails, and a floating side panel. They must avoid taking ownership of
ChatGPT's native DOM layout.

`CHATGPT_NATIVE_LAYOUT_PRESERVED = YES`

AICC must not normally insert controls into assistant prose or code text,
alter message widths or composer height, modify native flex/grid ownership,
force wrapping, introduce horizontal scrolling, shift native controls, or
reserve large permanent layout space.

## 2. Executable action rail

Only explicitly recognized executable surfaces may receive an AICC action,
including `AICC_EXECUTION_V1` blocks, approved executable code/command blocks,
and approved executable Writing Blocks. Ordinary assistant prose never receives
an AICC action.

Each executable surface has at most one compact `✦ AICC` action. The action is
in a separate floating rail aligned to the right of the executable surface,
outside the executable block and native content flow. It may track the surface
using anchor measurement without changing message width or code dimensions.

`NORMAL_ASSISTANT_AICC_BUTTON = NO`
`EXECUTABLE_BLOCK_BUTTON_DUPLICATES = 0`

## 3. Composer action

The ChatGPT composer remains visually intact. AICC's composer action is an
independent right-side action-area control with the approved label
`✦ AICC 执行`. It must not enter the textarea/content flow, force wrapping,
reduce usable text width unnecessarily, or alter native composer controls.
There is at most one composer action:

`COMPOSER_AICC_DUPLICATE_BUTTONS = 0`
`COMPOSER_AICC_ACTION_PLACEMENT = RIGHT_ACTION_CLUSTER`

## 4. Floating Bridge panel

The AICC Bridge panel is a separate floating surface on the far right and must
not masquerade as native ChatGPT UI. It may contain the AICC Bridge title,
connection/status, `发送到 AICC`, `插入运行报告`, execution/delivery status,
recent operation status, and an AICC Control Center link where applicable.

The panel is collapsible:

`EXPANDED → collapse → COLLAPSED → right-edge handle → EXPANDED`

The expanded state shows the panel and a clear collapse control. The collapsed
state retracts to the far right with a narrow clickable handle. Collapse and
expand must not reset bridge, execution, or connection state, shift native
layout, or introduce horizontal scrolling. The selected state is persisted via
extension storage or equivalent durable UI state.

`RIGHT_PANEL_COLLAPSIBLE = YES`
`RIGHT_PANEL_COLLAPSED_WIDTH = MINIMAL`

## 5. Visual and interaction states

Enabled actionable controls use a dark filled surface with high-contrast
text/icon. Disabled or unavailable controls use a transparent/ghost treatment
with subdued text/icon:

`ENABLED_BUTTON_STYLE = DARK_FILLED`
`DISABLED_BUTTON_STYLE = TRANSPARENT_GHOST`

The visual direction is clean, compact, neutral, low-noise, professional SaaS
UI with restrained radius, subtle border/shadow, clear hierarchy, and no
excessive purple button repetition or full-width injected action bars.

Every actionable AICC control has immediate visible feedback such as `READY`,
`SUBMITTING`, `SUBMITTED`, `RUNNING`, or `ERROR`. Visible controls must have a
real canonical Bridge Action binding; decorative shells, blocked pointer
events, synthetic keyboard execution as the primary protocol, and synthetic
clicks on hidden AICC controls are prohibited.

## 6. Duplication, placement, and accessibility

Repeated MutationObserver scans, ChatGPT rerenders, React node replacement,
extension reconnects, and repeated content-script initialization must not
duplicate controls:

- one executable surface → max one `✦ AICC` action;
- one composer → max one `✦ AICC 执行` action;
- one page → max one Bridge panel;
- one collapsed panel → max one expand handle.

Overlays must adapt to viewport changes. At narrower widths, prefer collapsing
the panel, preserve the native composer, avoid critical native controls and
horizontal scrolling, and degrade gracefully without restructuring ChatGPT.
Interactive controls should provide visible hover/focus states, accessible
labels/tooltips where practical, sufficient hit targets, and keyboard-safe
behavior. The collapsed handle remains discoverable.

## 7. Frozen reference composition

The approved composition is:

- left: ChatGPT native navigation;
- center: ChatGPT native conversation;
- right of chat content: AICC floating executable action rail;
- composer right: one `✦ AICC 执行` action;
- far right: collapsible AICC Bridge floating panel.

The panel may show `发送到 AICC`, `插入运行报告`, and status, while executable
actions remain in the independent rail.

## 8. Forbidden regressions

The following are explicit regressions:

- ordinary prose receiving an AICC button;
- duplicate executable or composer buttons;
- visible AICC controls that cannot be clicked;
- composer wrapping or native content-flow changes caused by AICC;
- a permanently expanded panel without collapse control;
- indistinguishable enabled and disabled styling;
- multiple panels or handles after rerender/reconnect;
- repeated return insertion or a frozen ChatGPT page.

Exactly-once result return, origin conversation binding, Owner draft
preservation, and no automatic ChatGPT Send remain protected contracts.

## 9. Future development contract

Any future Chrome Extension or Web Bridge Work Package affecting UI must read
this standard before implementation, preserve it by default, explicitly
declare any intended deviation, obtain Owner approval before changing frozen
visual/interaction behavior, and include regression checks against this
document. No implementation may silently redesign the Bridge UI.

## 10. Acceptance checklist

- [ ] Normal prose has no AICC button.
- [ ] Executable block has at most one `✦ AICC`.
- [ ] AICC button is outside native content flow and clickable.
- [ ] Composer has at most one `✦ AICC 执行`; composer layout is unchanged.
- [ ] AICC Bridge is independently floating and collapses to the right edge.
- [ ] Collapse state persists.
- [ ] Enabled controls are dark filled; disabled controls are ghost/transparent.
- [ ] No horizontal scrolling or native ChatGPT layout ownership.
- [ ] No duplicate controls after rerender/reconnect.
- [ ] Exactly-once result return remains protected.
