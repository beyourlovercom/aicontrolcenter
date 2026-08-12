# AICC V2 UI / Interaction Standard

- Document ID: `AICC-V2-UI-INTERACTION-STANDARD-001`
- Version: `1.1`
- Status: `APPROVED_BASELINE`

## Shell and language

The primary shell is Roadmap/Navigation on the left, selected entity and Owner
actions in the center, and Status & Evidence on the right. Feature Work
Packages must not redesign this shell independently. Roadmap hierarchy is
`Milestone → Work Package → PR`.

Owner-facing UI is Chinese-first. SHA, HEAD, Run ID, paths, reason codes, and
internal states remain available as secondary evidence.

## Interaction rules

Button enabled state is advisory UX only. Every consequential action performs a
fresh live canonical decision on click. Normal operation must not require
manual refresh, repeated identical authorization, terminal use, or service
restart. Failures visibly include state, reason, impact, and next action.

Runtime COMPLETED, Validation PASS, Human UAT PASS, Bridge CONSUMED, and WP
CLOSED remain separate domains. Human UAT rounds contain at most seven items;
only the current round is expanded by default.

The approved AICC V2 visual system—spacing, cards, badges, actions, evidence
typography, and Chinese-first labels—is shared across features.

## Owner action principle

The Owner Action Zone is contextual, not a command toolbar. Owner-facing
Chinese terminology is `当前操作区` / `当前操作`; `Owner Action Zone` remains
an internal component name when technical context requires it.

- `PRIMARY OWNER ACTION <= 1` at any moment.
- Only actions relevant to the current canonical state may be exposed.
- Actions appear and disappear contextually: ready exposes `启动执行`, an
  authorization-required state exposes `确认授权并启动`, a running state
  exposes `查看运行` and may expose `停止` as a secondary action, a failed
  state exposes `重试`, and a machine-completed state waiting for manual work
  exposes `开始人工 UAT`.
- All possible actions must not remain permanently visible together.
- Refresh, local-main sync, service logs, service restart, repository
  maintenance, and diagnostics do not permanently occupy the primary action
  area. They belong in contextual overflow, repository/status tools, a
  diagnostic area, or the appropriate Operations Tab.
- Authorization appears only when Canonical Execution Decision requires Owner
  action. Stop appears only while a stoppable runtime is active. Retry appears
  only after a retry-eligible failed or stopped state.
- The action surface consumes canonical state and remains a projection; it
  must not create execution authority.

The normal Owner path is intentionally compact:

`启动执行 → 查看运行 → 人工 UAT`

Authorization, lease, HEAD, worktree, scope, Writer Lock, and runtime
eligibility remain background concerns unless Canonical Authority explicitly
requires Owner intervention. This complexity rule applies consistently to WP
and PR pages; entity-specific actions may differ, but both use contextual
visibility and `PRIMARY OWNER ACTION <= 1`.

## Change history

### v1.1 — OWNER_APPROVED_BASELINE_CHANGE

- Owner Action Zone becomes a contextual Current Action area.
- `PRIMARY OWNER ACTION <= 1`.
- Permanent command-toolbar behavior is prohibited.
- Diagnostic, maintenance, and repository actions are removed from the
  permanent primary action area.
- WP and PR share the contextual Owner action principle.

Reason: simplify the Owner workflow after Canonical Execution convergence and
prevent the primary action area from reverting into a permanent command
toolbar.
