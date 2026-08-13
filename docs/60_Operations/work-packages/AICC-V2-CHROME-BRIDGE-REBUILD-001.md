# AICC-V2-CHROME-BRIDGE-REBUILD-001

Status: `IMPLEMENTED / MACHINE_VALIDATED / HUMAN_UAT_PENDING`

This Work Package defines the minimal Chrome Bridge V2. The legacy extension
at `web-adapter/chrome-extension/` is frozen and remains available only for
compatibility. V2 is an independent MV3 extension at
`web-adapter/chrome-extension-v2/`.

## Scope

- exactly one fixed toolbar with `发送到 AICC` and `插入运行报告`;
- capture exactly one complete `AICC_EXECUTION_V1` block from the current
  Assistant message;
- transport the block to the local AICC service;
- observe READY reports without side effects;
- insert one report only after an explicit Owner click.

`AUTO_REPORT_INSERT = 0`, `AUTO_SEND_CHATGPT_MESSAGE = 0`, and system
notifications are deferred. Runtime, Pass-Through, Auto Execute, and Codex
execution authority are outside this Work Package.

## Acceptance

Machine validation covers single-block capture, rejection of ambiguous or
incomplete targets, fixed toolbar rendering, READY button state, polling
side-effect freedom, same-Run duplicate protection, and DOM rerender toolbar
restoration. Human UAT must verify the unpacked V2 extension in a real
ChatGPT conversation before this Work Package can be closed.
