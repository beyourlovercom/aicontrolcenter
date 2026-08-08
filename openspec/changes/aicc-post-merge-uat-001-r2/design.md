# Design

The Rust read model parses milestone declarations from the formal Living Roadmap and joins them with machine-readable Work Package front matter. Milestone and project percentages are calculated from `CLOSED` package evidence; no UI progress constants are used.

Workspace sync keeps the existing fail-closed evaluation and fixed `fetch`, revalidate, `switch main`, `merge --ff-only` sequence. The frontend maps blocker codes to Owner-readable Chinese explanations and actionable next steps, while rendering the original code as secondary evidence.

The resolver remains a read-only governance calculation. Its result is rendered as `下一工作包执行判定`, with status, execution allowance, blocker explanation, next step, and raw technical status.
