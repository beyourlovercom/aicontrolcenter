# BeYourLover Remote GUI — G15 Windows Backup Owner UAT gate

Date: 2026-10-10. Scope: Windows Backup MCP only, `mcp-win-uat.beyourlover.com/mcp`, not US primary or China main Operator.

## Verified
- Backup MCP independent canary bound to 127.0.0.1:8893; bearer auth denied anonymous requests, `tools/list` registered `gui_dev_cart_home_canary`, native GUI navigation on Dev passed.
- Windows Backup MCP service on 127.0.0.1:8892 was updated after file backup and guarded process cutover, with rollback file `windows-gateway.pre-gui-20261010.mjs`.
- New Windows Backup service PID at cutover: 21476; old backup tools `hostname`, `read_file`, `write_file`, `edit_block`, `start_process` remained discoverable.
- Existing backup MCP regression: unauthorized denied; MCP initialize, tools discovery, project file read/write/edit, command, health, and out-of-root path rejection all PASS.
- 8892 `tools/call gui_dev_cart_home_canary` produced `LIVE_GUI_REAL_DEV_E2E=PASS`, exit 0, with an isolated Chrome profile and verified Dev cart → homepage UI Automation navigation.
- Public backup domain returned HTTPS 302 with TLS verification 0, consistent with Cloudflare Access redirect. This does NOT prove authenticated ChatGPT plugin discovery.
- Three devices' separate native GUI E2E already demonstrated. China Mac standalone tests reached 80/80, Windows and US Mac mini previously 77/77.
- No READY machine reboot; US primary MCP, Production data, payment, real orders unchanged.

## Strict tool limits
`gui_dev_cart_home_canary` only opens a dedicated Windows Chrome profile at `https://dev.beyourlover.com/cart/`, identifies one address bar and one `BeYourLover home` accessibility link, invokes it once, and requires homepage URL readback. This is NOT arbitrary-site GUI automation.

## Owner UAT remains necessary
1. Verify the actual ChatGPT-connected Windows Backup MCP plugin refreshes its `tools/list` and exposes `gui_dev_cart_home_canary`.
2. Authorize a single invocation; observe successful Dev-only navigation receipt. No payments, orders, or staff permissions.
3. Record Owner PASS/FAIL and whether public OAuth/Cloudflare Access session is valid.
4. Leave PR #52 unmerged until independent CI/Owner review. Production-general GUI capability is not claimed.

## Rollback
Only the Windows Backup MCP binary was cut over. Original gateway file is backed up under the same folder. Restore original gateway source and restart only the backup process if tool discovery/auth regression occurs. Do not touch the US primary MCP.
