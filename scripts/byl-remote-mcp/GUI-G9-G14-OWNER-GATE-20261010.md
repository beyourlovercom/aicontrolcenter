# BeYourLover self-hosted DC GUI — G9–G14 evidence / Owner gate
Date: 2026-10-10. All tests ran against isolated profiles, Dev site or offline fixture. No live payment, order, Production writes or READY device restarts.

## G9 — Chrome process and URL identity
- Native snapshot binds PID and address-bar URL; Node verifies an isolated `--user-data-dir=/tmp/byl-gui-*` Chrome process and Dev `/cart` HTTPS origin.
- Duplicate windows, malformed PID, host mismatch and lost window fail closed.

## G10 — Actual Dev GUI navigation
- China Mac: standalone MCP stdio client → isolated Chrome PID 98621 → Dev cart inspect → AX Press `BeYourLover home` → verified homepage URL, exit 0.
- Link readiness polling addresses initial page hydration without retrying an already-sent click.

## G11/G12 — Standalone tool packaging and canary
- Separate `package.json` pins MCP SDK v1.30.0; avoids absolute machine-specific imports.
- China Mac isolated token-protected HTTP canary bound ONLY to 127.0.0.1:8793, PID 99836; test Dev cart PID 99892 read-only inspect and navigate-home both `verified=true`.
- Existing China self-hosted Agent remains PID 9918, bound to 100.102.15.40:8791. Not restarted, replaced, redirected or modified.
- **Actual ChatGPT plugin/Operator hosted GUI tool registration remains NOT DONE.** Local sidecar/stdio is not a deployed first-class plugin tool.

## G13 — three-device validation
- China Mac: real Dev GUI stdio E2E PASS.
- US Mac mini: isolated Dev GUI stdio E2E PASS at PID 61118 after accessibility link readiness fix; Swift compiler and 77/77 tests PASS on SHA 34461a0.
- Windows: separate Chrome profile via UI Automation; address check and `BeYourLover home` InvokePattern navigation PASS; repeatable script returned `WINDOWS_DEV_CART_INSPECT_PASS` and `WINDOWS_DEV_HOME_NAVIGATION_PASS` at PID 22532.
- Windows 77/77 Node tests PASS on SHA 34461a0; no persistent PowerShell ExecutionPolicy change.

## G14 — negative/security
- Wrong host, PID drift, URL/query mismatch, duplicate windows, unexpected arguments, lock collision and unverified receipt rejected in regression.
- Windows non-isolated profile request rejected (`WINDOWS_PROFILE_DENY_PASS`).
- Running loopback canary rejects unauthenticated requests with HTTP 401.
- After adding canary authenticated-route and pre/post-click outcome tests, China Mac total: 80/80 tests PASS.
- Failures before AXPress report executed=false; failures after AXPress remain indeterminate and are never automatically retried.
- Shared lock coordinates clients using this GUI implementation, **not** unrelated desktop applications. Focus theft still fails closed, but multi-application arbitration is not fully proven.

## Remaining release gate
- PR #52 remains unmerged; GitHub main is authoritative for production.
- Register the new named GUI tools in the actual remote Operator deployment, verify signed auth and plugin discovery, perform controlled release/rollback, then Owner UAT.
- Do not call G11/G12 formal deployment or full G14 release closure PASS until hosted Connector and CI are verified.
