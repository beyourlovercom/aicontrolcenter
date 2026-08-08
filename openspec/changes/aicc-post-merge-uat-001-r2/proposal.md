# R2 Human UAT Remediation

## Why

Human UAT still cannot see the formal project hierarchy, understand a disabled sync action, interpret the next Work Package gate, or use the control panel as a Chinese-first Owner surface.

## What Changes

- Add formal milestone grouping and evidence-derived progress to the Living Roadmap read model.
- Add explicit sync state, Chinese blocker explanation, raw code, and next action to the UI.
- Rename the Owner-facing resolver presentation to `下一工作包执行判定`.
- Localize Owner-facing navigation, cards, actions, explanations, and empty/error states while preserving engineering identifiers.

## Exclusions

001B remains `PLANNED` / `NOT_AUTHORIZED`. This change does not alter resolver governance, add runtime control, execute OpenSpec actions, deploy, release, or mark Human UAT passed.
