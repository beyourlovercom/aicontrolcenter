# Primary MCP GUI Canary — G15 failure repair evidence (2026-10-10)

## Event and immediate safety response
- PR #52 was merged to `main` at `0280f58945cef5e9c9139886539cb8ff08464da0` with CI PASS.
- A code-only primary MCP cutover was performed on the US Mac mini, restarting **only** `com.byl.remote-mcp-standard`, not the device, agent, or gateway.
- Authenticated `https://mcp.beyourlover.com/mcp` tool listing returned the original four tools plus `gui_dev_cart_home_canary`; anonymous calls returned HTTP 401.
- The first real GUI tool invocation returned `GUI_NAVIGATION_FAILED`, so the standard MCP source was immediately restored from the verified predeploy backup and service-only restarted.
- Public post-rollback `tools/list` returned the original four tools; original runtime source SHA-256 `3f3d28e0d1902fed9ba1044f6dd30e91f7c0b201dcb7fc35189903623248a0f7`.

## Root cause
- Windows local tool history showed pre-click failure `ADDRESS_BAR_NOT_UNIQUE` while Chrome had not finished exposing the address bar; subsequent read-only inspection saw the reused test Profile already at the Dev homepage.
- A fixed Profile was being reused across independent canary invocations, so a prior navigation could contaminate the next source-window check.
- The bridge correctly returned failure and did not automatically repeat the click.

## Fix
- `gui-windows-dev-owner-uat.ps1` now uses a fresh GUID-suffixed isolated Chrome Profile for every invocation, a nonblocking named Windows Mutex for its own concurrency, bounded waits for one exact Dev cart address bar and one exact `BeYourLover home` link, source URL recheck immediately before `InvokePattern.Invoke()`, and exact Dev home URL readback.
- Post-invoke uncertainty reports `POST_CLICK_RESULT_UNKNOWN` and must **not** be automatically retried.
- On US Mac mini, static contract tests 11/11 PASS and full Node regression 91/91 PASS.
- Windows native script run #1: `WINDOWS_GUI_NAVIGATION_PASS pid=20956 verified=true`, exit 0; run #2: `WINDOWS_GUI_NAVIGATION_PASS pid=19724 verified=true`, exit 0.
- Independent US Mac mini scoped MCP on loopback 8798 (pointing to the *temporary* Windows fixed script) E2E PASS: `ok=true`, `verified=true`, exit 0.

## Remaining exact release gate
- Merge the follow-up fix PR into GitHub main only on separate exact-head authorization and CI PASS.
- Copy **only** the new Windows GUI script from merged main to the fixed runtime script path after a checksum backup of the existing script.
- Redeploy the unchanged main-sourced primary MCP candidate/bridge to US Mac mini with verified backup and service-only restart.
- Validate live public tool list (original four plus GUI), authentication and **real public-domain E2E** before Owner UAT; if any check fails, restore the standard endpoint and Windows script and stop.
- Keep the US primary gateway, all READY devices, Production order/payment data and authorization policies unchanged.
